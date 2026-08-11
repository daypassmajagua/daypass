import { useEffect, useMemo, useState } from 'react'
import { ChefHat, Printer, TriangleAlert, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { EstadoError, Esqueleto } from '../components/patrones'
import { useRegistrosEnVivo } from '../hooks/useDiaOperativo'
import { calcularConteoCocina } from '../lib/conteoCocina'
import { openPrintWindow, buildCocinaHTML } from '../lib/printDoc'
import { formatDate, hora12, plural } from '../lib/utils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import DateNav from '../components/ui/DateNav'
import PageHeader from '../components/layout/PageHeader'
import RevisionCocina from '../components/cocina/RevisionCocina'
import { useEdadMaxInfante } from '../hooks/useAjuste'

/**
 * El pronóstico de almuerzos.
 *
 * Ojo con el nombre: esto NO es lo que se va a servir. El almuerzo lo comanda
 * el mesero en la mesa, y esa comanda es la que manda. Lo de aquí es lo que
 * los clientes eligieron en su check-in, que sirve para que cocina prepare y
 * compre, no para obligar a nadie.
 *
 * Por eso el número no se congela: sigue moviéndose hasta que zarpa la lancha.
 * Un cliente que elige a las nueve de la mañana suma información; cerrarle la
 * puerta solo haría el pronóstico peor.
 *
 * Cocina no tiene perfil propio, así que esta pantalla la abre quien trabaja
 * en la isla y le pasa el número. Ese traspaso se marca arriba, y desde
 * entonces la pantalla dice cuánto se movió — que es lo que el mesero necesita
 * saber antes de comandar.
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
        <span className={'block text-[1.1875rem] font-bold ' + (coral ? 'text-coral-700' : 'text-tinta')}>
          {nombre}
        </span>
        {detalle && (
          <span className={'block text-[0.875rem] ' + (coral ? 'text-coral-700/80' : 'text-tinta-2')}>
            {detalle}
          </span>
        )}
      </span>
      <span className={
        'shrink-0 tabular text-[2.125rem] leading-none font-bold ' +
        (coral ? 'text-coral-700' : 'text-tinta')
      }>
        {cantidad}
      </span>
    </li>
  )
}

export default function Cocina() {
  const { fechaActiva, setFechaActiva } = useAppStore()
  const { registros, loading, error, refetch } = useRegistros(fechaActiva)

  const [pasajeros, setPasajeros] = useState([])
  const [opcionesPlato, setOpcionesPlato] = useState([])
  const [actualizado, setActualizado] = useState(() => new Date())
  const edadMaxInfante = useEdadMaxInfante()

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
        title="Almuerzos"
        subtitle={`Lo que eligieron en el check-in · ${formatDate(fechaActiva)}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DateNav value={fechaActiva} onChange={setFechaActiva} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openPrintWindow(
                `Conteo de cocina — ${fechaActiva}`,
                buildCocinaHTML(registros, pasajerosDelDia, opcionesPlato, fechaActiva, edadMaxInfante)
              )}
            >
              <Printer size={14} />
              Imprimir
            </Button>
          </div>
        }
      />

      {loading ? (
        <Esqueleto filas={3} />
      ) : error ? (
        <EstadoError error={error} onReintentar={refetch} />
      ) : activos.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-tinta-2 text-[1.0625rem]">No hay pasadía este día.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Arriba del número: el mesero comanda en la mesa, así que esto es
              un pronóstico. Lo que hay que saber antes de usarlo es si cocina
              ya lo vio y cuánto se movió desde entonces. */}
          <RevisionCocina fecha={fechaActiva} cocina={cocina} onCambio={refetch} />

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="flex items-center gap-2 text-[1.0625rem] font-bold text-tinta">
                <ChefHat size={20} className="text-blue-700" />
                Almuerzos
              </h2>
              <span className="tabular text-[2.5rem] leading-none font-bold text-tinta">
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
              {/* Su propia línea: comen, pero no eligen del menú. Cocina
                  necesita el número aunque no sea un plato. */}
              {cocina.infantes > 0 && (
                <Linea
                  nombre={cocina.infantes === 1 ? 'Infante' : 'Infantes'}
                  detalle={`Menores de ${edadMaxInfante} años — comen, no eligen plato`}
                  cantidad={cocina.infantes}
                />
              )}
            </ul>

            <p className="flex items-center gap-2 text-[0.875rem] text-tinta-2 mt-4">
              <Users size={15} className="shrink-0" />
              {cocina.totalAdultos} adultos · {cocina.totalNinos} niños · {cocina.totalCortesias} cortesías
              {cocina.totalInfantes > 0 &&
                ` · ${plural(cocina.totalInfantes, 'infante', 'infantes')}`}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[1.0625rem] font-bold text-tinta mb-3">
              <TriangleAlert size={20} className={cocina.restricciones.length ? 'text-coral-600' : 'text-tinta-2'} />
              Restricciones alimentarias
            </h2>
            {cocina.restricciones.length ? (
              <ul className="flex flex-col gap-2">
                {cocina.restricciones.map(p => (
                  <li key={p.id} className="rounded-xl bg-coral-50 px-4 py-3">
                    <p className="text-[1.1875rem] font-bold text-coral-700">{p.nota}</p>
                    <p className="text-[0.875rem] text-coral-700/80">
                      {p.nombre}
                      {p.plato && ` · pidió ${p.plato}`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.9375rem] text-tinta-2">
                Ninguna reportada. Solo aparecen las de pasajeros con nombre cargado.
              </p>
            )}
          </Card>

          <p className="text-[0.8125rem] text-tinta-2 text-center">
            Se actualiza solo · última lectura {hora12(actualizado)}
          </p>
        </div>
      )}
    </div>
  )
}
