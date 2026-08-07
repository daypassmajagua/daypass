import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ChefHat, Lock, Printer, Ship, TriangleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { usePendientes } from '../hooks/usePendientes'
import { useDiaOperativo, cerrarTentativo } from '../hooks/useDiaOperativo'
import { classNames, fraseFecha, hora12, plural } from '../lib/utils'
import { openPrintWindow, buildTentativoHTML, buildCocinaHTML } from '../lib/printDoc'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PageHeader from '../components/layout/PageHeader'

/**
 * El ritual de las 7 p.m.
 *
 * Cerrar el tentativo es el momento más importante de la jornada de oficina y
 * estaba repartido entre tres pantallas y nada. Aquí es un solo flujo: mirar
 * todo junto, y un botón.
 *
 * Los pendientes se listan pero no bloquean: la idea es que cierre con los
 * ojos abiertos, no que el sistema le impida trabajar.
 */
export default function CerrarDia() {
  const navigate = useNavigate()
  const { fechaActiva } = useAppStore()
  const { registros, loading, refetch } = useRegistros(fechaActiva)
  const { dia, enPlaneacion } = useDiaOperativo(fechaActiva)
  const { lista } = usePendientes(registros, { enPlaneacion })

  const [lanchas, setLanchas] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    supabase.from('lanchas').select('*').eq('activa', true)
      .then(({ data }) => setLanchas(data || []))
  }, [])

  useEffect(() => {
    if (!registros.length) { return }
    let vigente = true
    supabase
      .from('pasajeros')
      .select('*')
      .in('registro_id', registros.map(r => r.id))
      .then(({ data }) => { if (vigente) setPasajeros(data || []) })
    return () => { vigente = false }
  }, [registros])

  const activos = useMemo(
    () => registros.filter(r => !['cancelada', 'noshow'].includes(r.estado)),
    [registros]
  )

  // ── Resumen por lancha, con el sobrecupo en rojo
  const porLancha = useMemo(() => {
    const mapa = {}
    activos.forEach(r => {
      const l = r.lanchas || lanchas.find(x => x.id === r.lancha_id)
      const clave = l?.id || 'sin'
      if (!mapa[clave]) mapa[clave] = { nombre: l?.nombre || 'Sin lancha', capacidad: l?.capacidad || 0, pax: 0, reservas: 0 }
      mapa[clave].pax += r.adultos + r.ninos
      mapa[clave].reservas += 1
    })
    return Object.values(mapa).sort((a, b) => b.pax - a.pax)
  }, [activos, lanchas])

  const sobrecupo = porLancha.filter(l => l.capacidad > 0 && l.pax > l.capacidad)

  // ── Conteo de cocina
  const cocina = useMemo(() => {
    const porPlan = {}
    activos.forEach(r => {
      const nombre = r.planes?.nombre || 'Sin plan'
      if (!porPlan[nombre]) porPlan[nombre] = 0
      porPlan[nombre] += r.adultos + r.ninos + r.cortesias
    })
    const idsActivos = new Set(activos.map(r => r.id))
    const restricciones = pasajeros.filter(
      p => idsActivos.has(p.registro_id) && (p.restriccion_alimentaria || '').trim()
    )
    return {
      filas: Object.entries(porPlan).sort((a, b) => b[1] - a[1]),
      total: Object.values(porPlan).reduce((s, n) => s + n, 0),
      infantes: activos.reduce((s, r) => s + r.infantes, 0),
      restricciones,
    }
  }, [activos, pasajeros])

  function imprimirTentativo() {
    openPrintWindow(`Tentativo — ${fechaActiva}`, buildTentativoHTML(registros, fechaActiva))
  }
  function imprimirCocina() {
    openPrintWindow(`Conteo de cocina — ${fechaActiva}`, buildCocinaHTML(registros, pasajeros, fechaActiva))
  }

  async function cerrarYEnviar() {
    setCerrando(true)
    const { error } = await cerrarTentativo(fechaActiva)
    setCerrando(false)
    if (error) {
      toast.error('No se pudo cerrar el día. ' + error.message)
      return
    }
    await refetch()
    toast.success('Día cerrado. Las reservas tentativas quedaron confirmadas.')
    // Los dos documentos salen de una, que es para lo que se cierra.
    imprimirTentativo()
    setTimeout(imprimirCocina, 600)
  }

  if (loading) {
    return <p className="max-w-3xl mx-auto px-4 py-10 text-tinta-2">Preparando el cierre…</p>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-tinta-2 hover:text-blue-700 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Volver a Hoy
      </button>

      <PageHeader
        title={`Cerrar ${fraseFecha(fechaActiva).toLowerCase()}`}
        subtitle="Revisa todo antes de avisarle a cocina y a la isla"
      />

      {!enPlaneacion && (
        <div className="flex items-center gap-3 rounded-2xl bg-verde-50 px-4 py-3.5 mb-5">
          <Lock size={18} className="text-verde-500 shrink-0" />
          <p className="text-[15px] font-bold text-verde-600">
            Este día ya está cerrado
            {dia?.cerrado_tentativo_at && ` — a las ${hora12(dia.cerrado_tentativo_at)}`}
            {dia?.cerrado_tentativo_por_nombre && ` por ${dia.cerrado_tentativo_por_nombre}`}.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* ── Lanchas ── */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-tinta mb-4">
            <Ship size={18} className="text-blue-700" />
            Cómo quedan las lanchas
          </h2>

          {porLancha.length === 0 ? (
            <p className="text-tinta-2 text-sm">No hay reservas para este día.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {porLancha.map(l => {
                const excede = l.capacidad > 0 && l.pax > l.capacidad
                const justa = l.capacidad > 0 && l.pax === l.capacidad
                const pct = l.capacidad ? Math.min(100, (l.pax / l.capacidad) * 100) : 0
                return (
                  <li key={l.nombre} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold text-[15px] text-tinta">{l.nombre}</span>
                      <span className={classNames(
                        'text-sm font-bold tabular',
                        excede ? 'text-[#d2322d]' : justa ? 'text-coral-600' : 'text-tinta-2'
                      )}>
                        {l.capacidad ? `${l.pax}/${l.capacidad} pax` : `${l.pax} pax`}
                        {excede && ` · sobrecupo de ${l.pax - l.capacidad}`}
                        {justa && ' · llena'}
                      </span>
                    </div>
                    {l.capacidad > 0 && (
                      <span className="h-2 rounded-full bg-fondo overflow-hidden">
                        <span
                          className={classNames(
                            'block h-full rounded-full',
                            excede ? 'bg-[#d2322d]' : justa ? 'bg-coral-500' : 'bg-blue-600'
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {sobrecupo.length > 0 && (
            <p className="mt-4 text-sm text-[#d2322d] bg-[#fce9e8] rounded-xl px-3 py-2 font-bold">
              {plural(sobrecupo.length, 'lancha va', 'lanchas van')} por encima de su capacidad.
              Puedes cerrar igual, pero revísalo con el capitán.
            </p>
          )}
        </Card>

        {/* ── Cocina ── */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-tinta">
              <ChefHat size={18} className="text-blue-700" />
              Lo que va a cocina
            </h2>
            <span className="text-[15px] font-bold text-tinta tabular shrink-0">
              {plural(cocina.total, 'almuerzo', 'almuerzos')}
            </span>
          </div>

          <ul className="flex flex-col gap-1.5">
            {cocina.filas.map(([plan, n]) => (
              <li key={plan} className="flex justify-between gap-3 text-sm">
                <span className="text-tinta-2 truncate">{plan}</span>
                <span className="font-bold text-tinta tabular shrink-0">{n}</span>
              </li>
            ))}
          </ul>

          {cocina.infantes > 0 && (
            <p className="text-[13px] text-tinta-2 mt-3">
              {plural(cocina.infantes, 'infante', 'infantes')} sin almuerzo (menores de 3 años).
            </p>
          )}

          {cocina.restricciones.length > 0 ? (
            <div className="mt-4 rounded-xl bg-coral-50 px-3.5 py-3">
              <p className="font-bold text-coral-700 text-sm mb-1.5">
                {plural(cocina.restricciones.length, 'restricción alimentaria', 'restricciones alimentarias')}
              </p>
              <ul className="flex flex-col gap-0.5">
                {cocina.restricciones.map(p => (
                  <li key={p.id} className="text-[13px] text-coral-700">
                    <b>{p.restriccion_alimentaria}</b> · {p.nombre}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px] text-tinta-2 mt-3">
              Sin restricciones reportadas. Solo aparecen las de pasajeros con nombre cargado.
            </p>
          )}
        </Card>

        {/* ── Pendientes que decide dejar pendientes ── */}
        {lista.length > 0 && (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-tinta mb-1">
              <TriangleAlert size={18} className="text-coral-600" />
              Vas a cerrar con esto pendiente
            </h2>
            <p className="text-sm text-tinta-2 mb-3">
              No te bloquea. Es para que cierres sabiendo qué queda.
            </p>
            <ul className="flex flex-col gap-1.5">
              {lista.map(p => (
                <li key={p.id} className="text-sm text-tinta">· {p.texto}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* ── El botón ── */}
      <div className="sticky bottom-0 bg-fondo/95 backdrop-blur mt-5 py-3 -mx-4 px-4 border-t border-linea flex items-center gap-3 flex-wrap">
        {enPlaneacion ? (
          <>
            <Button size="lg" onClick={cerrarYEnviar} loading={cerrando} disabled={registros.length === 0}>
              <Lock size={18} />
              Cerrar y enviar
            </Button>
            <span className="text-[13px] text-tinta-2">
              Se generan el tentativo y el conteo de cocina.
            </span>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={imprimirTentativo}>
              <Printer size={16} />
              Imprimir el tentativo
            </Button>
            <Button variant="secondary" onClick={imprimirCocina}>
              <Printer size={16} />
              Imprimir el conteo de cocina
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
