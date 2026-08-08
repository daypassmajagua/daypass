import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, ChefHat, Copy, Download, Lock, MessageCircle, Printer, Ship, TriangleAlert,
} from 'lucide-react'
import EnviarTarjetas from '../components/hoy/EnviarTarjetas'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { usePendientes } from '../hooks/usePendientes'
import { useDiaOperativo, cerrarTentativo } from '../hooks/useDiaOperativo'
import { classNames, fraseFecha, hora12, plural } from '../lib/utils'
import {
  openPrintWindow, buildTentativoHTML, buildCocinaHTML, buildTentativoTexto,
} from '../lib/printDoc'
import { calcularConteoCocina } from '../lib/conteoCocina'
import { precargarDia } from '../lib/offline/precarga'
import { usePrecarga, haceCuanto } from '../lib/offline/useOffline'
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

  const [lanchas, setLanchas] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [opcionesPlato, setOpcionesPlato] = useState([])
  const [tiposIngreso, setTiposIngreso] = useState([])
  const [cerrando, setCerrando] = useState(false)

  // Va después de los estados: leerlo antes lo dejaba en zona muerta y
  // tumbaba la pantalla entera.
  const { lista } = usePendientes(registros, { enPlaneacion, tiposIngreso })
  const { precarga, refrescar: refrescarPrecarga } = usePrecarga(fechaActiva)
  const [enviandoTarjetas, setEnviandoTarjetas] = useState(false)

  useEffect(() => {
    supabase.from('lanchas').select('*').eq('activa', true)
      .then(({ data }) => setLanchas(data || []))
    supabase.from('opciones_plato').select('*').eq('activo', true)
      .then(({ data }) => setOpcionesPlato(data || []))
    supabase.from('tipos_ingreso').select('*')
      .then(({ data }) => setTiposIngreso(data || []))
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

  // ── Conteo de cocina: mismo cálculo que el documento impreso
  const cocina = useMemo(
    () => calcularConteoCocina(registros, pasajeros, opcionesPlato),
    [registros, pasajeros, opcionesPlato]
  )

  function imprimirTentativo() {
    openPrintWindow(`Tentativo — ${fechaActiva}`, buildTentativoHTML(registros, fechaActiva))
  }
  function imprimirCocina() {
    openPrintWindow(
      `Conteo de cocina — ${fechaActiva}`,
      buildCocinaHTML(registros, pasajeros, opcionesPlato, fechaActiva)
    )
  }
  /** Para pegarlo en el grupo de WhatsApp. */
  function copiarTexto() {
    navigator.clipboard.writeText(buildTentativoTexto(registros, fechaActiva))
    toast.success('Tentativo copiado — pégalo en WhatsApp')
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

    // Los dispositivos se llevan la lista: esto pasa aquí, en la oficina y
    // con wifi, porque en el muelle ya no habrá señal.
    const { resumen, error: errPrecarga } = await precargarDia(fechaActiva)
    if (errPrecarga) {
      toast.error('El día cerró, pero la copia para el muelle no se pudo guardar. Vuelve a intentarlo desde el indicador.')
    } else {
      await refrescarPrecarga()
      toast.success(`Lista guardada en este dispositivo: ${resumen.pax} pax en ${plural(resumen.zarpes, 'zarpe', 'zarpes')}.`)
    }

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
              {plural(cocina.totalAlmuerzos, 'almuerzo', 'almuerzos')}
            </span>
          </div>

          {/* Cocina no cocina planes: cocina platos. */}
          <ul className="flex flex-col gap-1.5">
            {cocina.filasPlato.map(f => (
              <li key={f.nombre + f.plan} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-bold text-tinta">{f.nombre}</span>
                  {f.plan && <span className="text-tinta-2"> · {f.plan}</span>}
                </span>
                <span className="font-bold text-tinta tabular shrink-0">{f.cantidad}</span>
              </li>
            ))}

            {cocina.filasMenuFijo.map(f => (
              <li key={f.plan} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-bold text-tinta">Menú fijo</span>
                  <span className="text-tinta-2"> · {f.plan}</span>
                </span>
                <span className="font-bold text-tinta tabular shrink-0">{f.cantidad}</span>
              </li>
            ))}

            {cocina.sinElegir > 0 && (
              <li className="flex items-baseline justify-between gap-3 text-sm rounded-lg bg-coral-50 px-2.5 py-1.5 -mx-2.5">
                <span className="min-w-0">
                  <span className="font-bold text-coral-700">Sin plato elegido</span>
                  <span className="text-coral-700/80"> · se confirma en el check-in</span>
                </span>
                <span className="font-bold text-coral-700 tabular shrink-0">{cocina.sinElegir}</span>
              </li>
            )}
          </ul>

          <p className="text-[13px] text-tinta-2 mt-3">
            {cocina.totalAdultos} adultos · {cocina.totalNinos} niños · {cocina.totalCortesias} cortesías.
            {cocina.totalInfantes > 0 && ` ${plural(cocina.totalInfantes, 'infante', 'infantes')} sin almuerzo (menores de 3 años).`}
          </p>

          {cocina.restricciones.length > 0 ? (
            <div className="mt-4 rounded-xl bg-coral-50 px-3.5 py-3">
              <p className="font-bold text-coral-700 text-sm mb-1.5">
                {plural(cocina.restricciones.length, 'restricción alimentaria', 'restricciones alimentarias')}
              </p>
              <ul className="flex flex-col gap-0.5">
                {cocina.restricciones.map(p => (
                  <li key={p.id} className="text-[13px] text-coral-700">
                    <b>{p.nota}</b> · {p.nombre}
                    {p.plato && <span className="opacity-80"> · pidió {p.plato}</span>}
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
            <Button variant="secondary" onClick={copiarTexto}>
              <Copy size={16} />
              Copiar para WhatsApp
            </Button>
            <Button onClick={() => setEnviandoTarjetas(true)}>
              <MessageCircle size={16} />
              Enviar las tarjetas
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const { resumen, error } = await precargarDia(fechaActiva)
                if (error) toast.error('No se pudo guardar la lista. ' + error.message)
                else { await refrescarPrecarga(); toast.success(`Lista guardada: ${resumen.pax} pax.`) }
              }}
            >
              <Download size={16} />
              Volver a guardar la lista
            </Button>
          </>
        )}

        {precarga && (
          <span className="text-[13px] text-tinta-2 w-full sm:w-auto">
            Lista guardada en este dispositivo {haceCuanto(precarga.en)} · {precarga.resumen?.pax} pax
          </span>
        )}
      </div>

      {enviandoTarjetas && (
        <EnviarTarjetas
          fecha={fechaActiva}
          registros={registros}
          onCerrar={() => { setEnviandoTarjetas(false); refetch() }}
        />
      )}
    </div>
  )
}
