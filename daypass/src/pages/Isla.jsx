import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, Ship, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { useRegistrosEnVivo } from '../hooks/useDiaOperativo'
import { leerDiaLocal, leerCatalogoLocal } from '../lib/offline/precarga'
import { comoSeCobra, coincideEnIsla, COBROS } from '../lib/cobroEnIsla'
import { classNames, fraseFecha, plural } from '../lib/utils'
import IndicadorSync from '../components/layout/IndicadorSync'
import NavegacionMinima from '../components/layout/NavegacionMinima'
import { EstadoError, ContadorVivo } from '../components/patrones'
import { edadDe } from '../lib/enLaIsla'
import { useEnLaIsla } from '../hooks/useEnLaIsla'
import { reservaCon, CON_LANCHA } from '../lib/columnas'

/**
 * La isla: a qué cuenta va este almuerzo.
 *
 * El mesero toma la comanda en papel y la digita en Zeus contra una cuenta.
 * Esta pantalla existe para una sola pregunta, la que se hace de pie junto a
 * la mesa: ¿a nombre de quién cargo esto?
 *
 * No hay comanda aquí a propósito —eso vive en Zeus— ni precios ni nada que
 * no sirva para responder esa pregunta. Buscar y leer un número, nada más.
 *
 * Misma vara física que el muelle: se usa de pie, a pleno sol y con una mano
 * ocupada. El folio en grande y en monoespaciada, porque hay que copiarlo a
 * otra pantalla sin equivocarse.
 */

/**
 * Cómo se pinta cada forma de cobro.
 *
 * Todas las tarjetas van en blanco y la diferencia está en el borde y en el
 * texto de la derecha. A media mañana casi nadie tiene folio todavía —Daniela
 * los va creando— y pintar de ámbar el fondo dejaba la pantalla entera de un
 * solo color: cuando todo grita, nada se oye. El único que resalta de verdad
 * es el que sí se puede cobrar, que es el que el mesero busca.
 */
const ESTILO = {
  [COBROS.folio]:       { caja: 'bg-white ring-sol-tinta',  texto: 'text-sol-tinta' },
  [COBROS.falta_folio]: { caja: 'bg-white ring-aviso-300',  texto: 'text-aviso-700' },
  [COBROS.cortesia]:    { caja: 'bg-white ring-mar-300',  texto: 'text-mar-900' },
  [COBROS.habitacion]:  { caja: 'bg-white ring-mar-300',  texto: 'text-mar-900' },
  [COBROS.empleado]:    { caja: 'bg-white ring-sol-linea',  texto: 'text-sol-tinta-2' },
  [COBROS.revisar]:     { caja: 'bg-white ring-alarma-300',  texto: 'text-alarma-900' },
}

function Fila({ registro, tiposIngreso }) {
  const cobro = comoSeCobra(registro, tiposIngreso)
  const estilo = ESTILO[cobro.modo] || ESTILO[COBROS.empleado]
  const quien = registro.nombre_grupo || registro.nombre_pasajero
  const pax = registro.adultos + registro.ninos + registro.infantes + registro.cortesias
  const llego = registro.estado === 'en_isla' || registro.estado === 'completada'

  return (
    <li className={classNames('rounded-2xl px-5 py-4 ring-2 flex flex-wrap items-center gap-x-5 gap-y-3', estilo.caja)}>
      <div className="min-w-0 flex-1">
        <p className="text-[1.25rem] font-bold text-sol-tinta truncate">{quien}</p>
        <p className="text-[1rem] text-sol-tinta-2">
          {plural(pax, 'persona', 'personas')}
          {registro.lanchas?.nombre ? ` · ${registro.lanchas.nombre}` : ''}
          {registro.nombre_grupo ? ` · ${registro.nombre_pasajero}` : ''}
        </p>
        {/* Quien todavía no aparece embarcado casi siempre es que el muelle no
            cerró el zarpe, no que no vino. Se dice, sin alarmar. */}
        {!llego && (
          <p className="text-[0.9375rem] text-aviso-700 flex items-center gap-1.5 mt-0.5">
            <AlertTriangle size={15} className="shrink-0" />
            El muelle todavía no confirmó que embarcó
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {cobro.folio ? (
          <>
            <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-sol-tinta-3">
              {cobro.titulo}
            </p>
            <p className="text-[1.875rem] leading-tight font-black font-mono text-sol-tinta">
              {cobro.folio}
            </p>
          </>
        ) : (
          <>
            <p className={classNames('text-[1.1875rem] font-bold', estilo.texto)}>{cobro.titulo}</p>
            {cobro.nota && (
              <p className={classNames('text-[0.875rem] max-w-[15rem]', estilo.texto, 'opacity-85')}>
                {cobro.nota}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  )
}

/**
 * El número de ahora, en el encabezado de la isla.
 *
 * ── Por qué el grande es solo el de pasadía ─────────────────────────────────
 *
 * Es el único de los tres que registra el regreso, así que es el único que se
 * puede restar y afirmar. Alojamiento y equipo van en el manifiesto pero no
 * tienen un hecho por persona: se dicen al lado, en pequeño, sin sumarse. Un
 * total que mezclara lo contado con lo supuesto sería un total que nadie puede
 * defender cuando la Capitanía pregunte.
 *
 * Antes de que zarpe la primera lancha el número es cero y eso es correcto,
 * pero un cero grande a las siete de la mañana parece un error: mientras nadie
 * haya subido, el bloque no aparece.
 */
function EnLaIslaAhora({ conteo, mirado }) {
  if (!conteo || conteo.subieron === 0) return null

  const aparte = [
    conteo.alojamiento ? `${conteo.alojamiento} de alojamiento` : null,
    conteo.equipo ? `${conteo.equipo} del equipo` : null,
  ].filter(Boolean)

  return (
    <div className="shrink-0 text-right">
      <ContadorVivo
        valor={conteo.pasadia}
        etiqueta="de pasadía, en la isla"
        edad={edadDe(mirado)}
        tamano="lg"
      />
      {aparte.length > 0 && (
        <p className="text-[0.8125rem] text-sol-tinta-2">{aparte.join(' · ')}, aparte</p>
      )}
    </div>
  )
}

export default function Isla() {
  const fechaActiva = useAppStore(s => s.fechaActiva)
  const [registros, setRegistros] = useState([])
  const [tiposIngreso, setTiposIngreso] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  // Cuánta gente hay ahora, y de cuándo es ese número. Los dos van juntos: sin
  // la hora, un número viejo se lee como fresco.
  const { conteo, mirado, remirar } = useEnLaIsla(fechaActiva)

  /**
   * Con red del servidor, sin red de la copia local. En la isla la señal va y
   * viene, y una pantalla que se queda en blanco cuando se cae es peor que una
   * que muestre la copia de hace un rato.
   */
  const cargar = useCallback(async () => {
    let filas = []
    let tipos = []
    let fallo = null

    if (navigator.onLine) {
      const [reg, ti] = await Promise.all([
        supabase.from('reservas')
          .select(reservaCon({ nivel: 'pago', relaciones: [CON_LANCHA] }))
          .eq('fecha', fechaActiva),
        supabase.from('tipos_ingreso').select('*'),
      ])
      if (reg.error) fallo = reg.error.message
      else { filas = reg.data || []; tipos = ti.data || [] }
    }

    if (!filas.length) {
      const local = await leerDiaLocal(fechaActiva)
      filas = local.registros
      tipos = await leerCatalogoLocal('tipos_ingreso')
      // La copia local sostiene la pantalla: con filas no hay error que mostrar.
      if (filas.length) fallo = null
    }

    setError(fallo)
    setRegistros(filas.filter(r => !['cancelada', 'noshow'].includes(r.estado)))
    setTiposIngreso(tipos)
    setCargando(false)
  }, [fechaActiva])

  useEffect(() => { cargar() }, [cargar])

  // Cuando cambia una reserva del día, la lista se recarga y el conteo también:
  // una que pasa a `en_isla` es alguien que acaba de llegar.
  const alCambiar = useCallback(() => { cargar(); remirar() }, [cargar, remirar])
  useRegistrosEnVivo(fechaActiva, alCambiar)

  useEffect(() => {
    document.body.style.background = '#f4f4f0'
    return () => { document.body.style.background = '' }
  }, [])

  // Los que ya embarcaron primero: son los que están sentados en una mesa.
  const lista = useMemo(() => {
    const orden = r => (r.estado === 'en_isla' ? 0 : r.estado === 'completada' ? 1 : 2)
    return registros
      .filter(r => coincideEnIsla(r, busqueda))
      .sort((a, b) => orden(a) - orden(b) ||
        (a.nombre_grupo || a.nombre_pasajero).localeCompare(b.nombre_grupo || b.nombre_pasajero, 'es'))
  }, [registros, busqueda])

  const sinFolio = registros.filter(
    r => comoSeCobra(r, tiposIngreso).modo === COBROS.falta_folio).length

  return (
    <div className="min-h-screen bg-sol-fondo flex flex-col">
      <header className="sticky top-0 z-30 bg-sol-fondo border-b-2 border-sol-linea-2 px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.375rem] font-bold text-sol-tinta">¿A qué cuenta va?</h1>
            <p className="text-[1rem] text-sol-tinta-2 first-letter:uppercase">
              {fraseFecha(fechaActiva)}
            </p>
          </div>
          <EnLaIslaAhora conteo={conteo} mirado={mirado} />
          <IndicadorSync muelle />
        </div>

        {/* La isla lleva navegación mínima, no ninguna: quien trabaja aquí
            puede tener dos o tres pantallas, y sin esto queda encerrado. Al
            mesero, que tiene una sola, no le aparece. */}
        <NavegacionMinima />

        <div className="relative">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-sol-tinta-3 pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, grupo o folio"
            className="w-full rounded-2xl border-2 border-sol-linea bg-white pr-4 min-h-[3.75rem] text-[1.125rem] focus:outline-none focus:border-blue-600"
            style={{ paddingLeft: '3.25rem' }}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-sol-tinta-2"
              aria-label="Limpiar la búsqueda"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* A media mañana esto es normal: Daniela va creando los folios en
            Zeus. Se avisa para que el mesero sepa por qué falta, no para
            alarmarlo. */}
        {sinFolio > 0 && (
          <p className="text-[0.9375rem] font-bold text-aviso-700">
            {plural(sinFolio, 'reserva todavía sin folio', 'reservas todavía sin folio')}
            {' — '}Daniela los va creando en Zeus durante la mañana.
          </p>
        )}
      </header>

      <main className="flex-1 px-4 py-4">
        {cargando ? (
          <p className="text-[1.125rem] text-sol-tinta-2 py-8">Buscando la lista del día…</p>
        ) : error ? (
          <EstadoError error={error} onReintentar={cargar} />
        ) : !lista.length ? (
          <p className="text-[1.125rem] text-sol-tinta-2 py-8 text-center">
            {busqueda
              ? 'Nadie coincide con esa búsqueda.'
              : (
                <span className="flex flex-col items-center gap-2">
                  <Ship size={32} className="text-sol-tinta-3" />
                  No hay pasadía este día.
                </span>
              )}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {lista.map(r => (
              <Fila key={r.id} registro={r} tiposIngreso={tiposIngreso} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
