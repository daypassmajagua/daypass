import { useEffect, useMemo, useState } from 'react'
import { ChefHat, Printer, TriangleAlert, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { useRegistrosEnVivo } from '../hooks/useDiaOperativo'
import { calcularConteoCocina } from '../lib/conteoCocina'
import { openPrintWindow, buildCocinaHTML } from '../lib/printDoc'
import { formatDate, hora12, plural } from '../lib/utils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import DateNav from '../components/ui/DateNav'
import PageHeader from '../components/layout/PageHeader'
import CierreCocina from '../components/cocina/CierreCocina'

/**
 * El conteo de cocina, para cocina.
 *
 * Existe porque el número se mira en pantalla y no en papel. Cocina revisa los
 * platos el mismo día en la mañana, después del desayuno, y para entonces el
 * check-in del cliente ya cerró: lo que ve aquí es definitivo.
 *
 * Pero entre el cierre de la noche anterior y esa revisión el número todavía
 * se mueve —cada cliente que elige almuerzo a las 11 p.m. lo cambia—, así que
 * la pantalla se actualiza sola. Un papel impreso anoche diría otra cosa.
 *
 * Números grandes a propósito: esto se lee de pie, de lejos y con las manos
 * ocupadas.
 */

/** Una línea del conteo, en tamaño de cocina. */
function Linea({ nombre, detalle, cantidad, tono = 'normal' }) {
  const coral = tono === 'alerta'
  return (
    <li className={
      'flex items-center justify-between gap-4 py-3 px-4 rounded-xl ' +
      (coral ? 'bg-coral-50' : 'odd:bg-fondo')
    }>
      <span className="min-w-0">
        <span className={'block text-[19px] font-bold ' + (coral ? 'text-coral-700' : 'text-tinta')}>
          {nombre}
        </span>
        {detalle && (
          <span className={'block text-[14px] ' + (coral ? 'text-coral-700/80' : 'text-tinta-2')}>
            {detalle}
          </span>
        )}
      </span>
      <span className={
        'shrink-0 tabular text-[34px] leading-none font-bold ' +
        (coral ? 'text-coral-700' : 'text-tinta')
      }>
        {cantidad}
      </span>
    </li>
  )
}

export default function Cocina() {
  const { fechaActiva, setFechaActiva } = useAppStore()
  const { registros, loading, refetch } = useRegistros(fechaActiva)

  const [pasajeros, setPasajeros] = useState([])
  const [opcionesPlato, setOpcionesPlato] = useState([])
  const [actualizado, setActualizado] = useState(() => new Date())

  // Lo que el cliente elija desde su celular tiene que aparecer aquí sin que
  // nadie recargue: en la cocina nadie va a apretar F5.
  useRegistrosEnVivo(fechaActiva, refetch)

  useEffect(() => {
    supabase.from('opciones_plato').select('*').eq('activo', true)
      .then(({ data }) => setOpcionesPlato(data || []))
  }, [])

  useEffect(() => {
    if (!registros.length) return
    let vigente = true
    supabase
      .from('pasajeros')
      .select('*')
      .in('registro_id', registros.map(r => r.id))
      .then(({ data }) => {
        if (!vigente) return
        setPasajeros(data || [])
        setActualizado(new Date())
      })
    return () => { vigente = false }
  }, [registros])

  // Los pasajeros no viajan por realtime: se vuelven a pedir cada minuto.
  // Un minuto de retraso no le cambia el trabajo a nadie; una pantalla
  // congelada sí.
  useEffect(() => {
    const t = setInterval(refetch, 60000)
    return () => clearInterval(t)
  }, [refetch])

  // Se filtra en vez de limpiarse al cambiar de día: si se vaciara dentro del
  // efecto, entre que llega la fecha nueva y llegan sus pasajeros la pantalla
  // contaría los de ayer. Derivarlo no tiene ese hueco.
  const idsDelDia = useMemo(() => new Set(registros.map(r => r.id)), [registros])
  const pasajerosDelDia = useMemo(
    () => pasajeros.filter(p => idsDelDia.has(p.registro_id)),
    [pasajeros, idsDelDia]
  )

  const cocina = useMemo(
    () => calcularConteoCocina(registros, pasajerosDelDia, opcionesPlato),
    [registros, pasajerosDelDia, opcionesPlato]
  )

  const activos = registros.filter(r => !['cancelada', 'noshow'].includes(r.estado))

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader
        title="Cocina"
        subtitle={formatDate(fechaActiva)}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DateNav value={fechaActiva} onChange={setFechaActiva} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openPrintWindow(
                `Conteo de cocina — ${fechaActiva}`,
                buildCocinaHTML(registros, pasajerosDelDia, opcionesPlato, fechaActiva)
              )}
            >
              <Printer size={14} />
              Imprimir
            </Button>
          </div>
        }
      />

      {loading ? (
        <p className="text-tinta-2 py-10">Cargando el conteo…</p>
      ) : activos.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-tinta-2 text-[17px]">No hay pasadía este día.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Arriba del número: quien lo mira tiene que saber si todavía se
              mueve antes de ponerse a cocinar con él. */}
          <CierreCocina fecha={fechaActiva} onCambio={refetch} />

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-tinta">
                <ChefHat size={20} className="text-blue-700" />
                Almuerzos
              </h2>
              <span className="tabular text-[40px] leading-none font-bold text-tinta">
                {cocina.totalAlmuerzos}
              </span>
            </div>

            <ul className="flex flex-col gap-1">
              {cocina.filasPlato.map(f => (
                <Linea key={f.nombre + f.plan} nombre={f.nombre} detalle={f.plan} cantidad={f.cantidad} />
              ))}
              {cocina.filasMenuFijo.map(f => (
                <Linea key={f.plan} nombre="Menú fijo" detalle={f.plan} cantidad={f.cantidad} />
              ))}
              {cocina.sinElegir > 0 && (
                <Linea
                  tono="alerta"
                  nombre="Sin plato elegido"
                  detalle="No alcanzaron a elegir. Prepara según lo de siempre."
                  cantidad={cocina.sinElegir}
                />
              )}
            </ul>

            <p className="flex items-center gap-2 text-[14px] text-tinta-2 mt-4">
              <Users size={15} className="shrink-0" />
              {cocina.totalAdultos} adultos · {cocina.totalNinos} niños · {cocina.totalCortesias} cortesías
              {cocina.totalInfantes > 0 &&
                ` · ${plural(cocina.totalInfantes, 'infante', 'infantes')} sin almuerzo (menores de 3)`}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-tinta mb-3">
              <TriangleAlert size={20} className={cocina.restricciones.length ? 'text-coral-600' : 'text-tinta-2'} />
              Restricciones alimentarias
            </h2>
            {cocina.restricciones.length ? (
              <ul className="flex flex-col gap-2">
                {cocina.restricciones.map(p => (
                  <li key={p.id} className="rounded-xl bg-coral-50 px-4 py-3">
                    <p className="text-[19px] font-bold text-coral-700">{p.nota}</p>
                    <p className="text-[14px] text-coral-700/80">
                      {p.nombre}
                      {p.plato && ` · pidió ${p.plato}`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-tinta-2">
                Ninguna reportada. Solo aparecen las de pasajeros con nombre cargado.
              </p>
            )}
          </Card>

          <p className="text-[13px] text-tinta-2 text-center">
            Se actualiza solo · última lectura {hora12(actualizado)}
          </p>
        </div>
      )}
    </div>
  )
}
