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
import { EstadoError } from '../components/patrones'
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
  [COBROS.folio]:       { caja: 'bg-white ring-[#101223]',  texto: 'text-[#101223]' },
  [COBROS.falta_folio]: { caja: 'bg-white ring-[#e8c76a]',  texto: 'text-[#6b4d05]' },
  [COBROS.cortesia]:    { caja: 'bg-white ring-[#7da2e8]',  texto: 'text-[#1b3a75]' },
  [COBROS.habitacion]:  { caja: 'bg-white ring-[#7da2e8]',  texto: 'text-[#1b3a75]' },
  [COBROS.empleado]:    { caja: 'bg-white ring-[#c8c9d4]',  texto: 'text-[#3a3d52]' },
  [COBROS.revisar]:     { caja: 'bg-white ring-[#e08a8a]',  texto: 'text-[#7a1f1f]' },
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
        <p className="text-[20px] font-bold text-[#101223] truncate">{quien}</p>
        <p className="text-[16px] text-[#3a3d52]">
          {plural(pax, 'persona', 'personas')}
          {registro.lanchas?.nombre ? ` · ${registro.lanchas.nombre}` : ''}
          {registro.nombre_grupo ? ` · ${registro.nombre_pasajero}` : ''}
        </p>
        {/* Quien todavía no aparece embarcado casi siempre es que el muelle no
            cerró el zarpe, no que no vino. Se dice, sin alarmar. */}
        {!llego && (
          <p className="text-[15px] text-[#6b4d05] flex items-center gap-1.5 mt-0.5">
            <AlertTriangle size={15} className="shrink-0" />
            El muelle todavía no confirmó que embarcó
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {cobro.folio ? (
          <>
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#6a6d80]">
              {cobro.titulo}
            </p>
            <p className="text-[30px] leading-tight font-black font-mono text-[#101223]">
              {cobro.folio}
            </p>
          </>
        ) : (
          <>
            <p className={classNames('text-[19px] font-bold', estilo.texto)}>{cobro.titulo}</p>
            {cobro.nota && (
              <p className={classNames('text-[14px] max-w-[15rem]', estilo.texto, 'opacity-85')}>
                {cobro.nota}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  )
}

export default function Isla() {
  const fechaActiva = useAppStore(s => s.fechaActiva)
  const [registros, setRegistros] = useState([])
  const [tiposIngreso, setTiposIngreso] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

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
  useRegistrosEnVivo(fechaActiva, cargar)

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
    <div className="min-h-screen bg-[#f4f4f0] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#f4f4f0] border-b-2 border-[#d8d8d2] px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold text-[#101223]">¿A qué cuenta va?</h1>
            <p className="text-[16px] text-[#3a3d52] first-letter:uppercase">
              {fraseFecha(fechaActiva)}
            </p>
          </div>
          <IndicadorSync muelle />
        </div>

        {/* La isla lleva navegación mínima, no ninguna: quien trabaja aquí
            puede tener dos o tres pantallas, y sin esto queda encerrado. Al
            mesero, que tiene una sola, no le aparece. */}
        <NavegacionMinima />

        <div className="relative">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6a6d80] pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, grupo o folio"
            className="w-full rounded-2xl border-2 border-[#c8c9d4] bg-white pr-4 min-h-[60px] text-[18px] focus:outline-none focus:border-blue-600"
            style={{ paddingLeft: '3.25rem' }}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-[#3a3d52]"
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
          <p className="text-[15px] font-bold text-[#6b4d05]">
            {plural(sinFolio, 'reserva todavía sin folio', 'reservas todavía sin folio')}
            {' — '}Daniela los va creando en Zeus durante la mañana.
          </p>
        )}
      </header>

      <main className="flex-1 px-4 py-4">
        {cargando ? (
          <p className="text-[18px] text-[#3a3d52] py-8">Buscando la lista del día…</p>
        ) : error ? (
          <EstadoError error={error} onReintentar={cargar} />
        ) : !lista.length ? (
          <p className="text-[18px] text-[#3a3d52] py-8 text-center">
            {busqueda
              ? 'Nadie coincide con esa búsqueda.'
              : (
                <span className="flex flex-col items-center gap-2">
                  <Ship size={32} className="text-[#6a6d80]" />
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
