import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/offline/db'
import { encolar, alCambiarLaCola } from '../lib/offline/cola'
import { leerDiaLocal, leerCatalogoLocal } from '../lib/offline/precarga'

/**
 * El embarque de un zarpe.
 *
 * El muelle no edita: registra hechos. Aquí se arma la lista de quién se
 * espera y se deriva su estado del último evento registrado.
 */

/** Identificador estable de una persona dentro del zarpe. */
export function claveDe(fila) {
  return fila.pasajero_id || fila.client_id || `${fila.registro_id}#${fila.indice}`
}

/**
 * Misma regla que la vista estado_embarques de Postgres: el último evento de
 * cada persona manda. Se usa cuando se trabaja sin red o para sumar lo que
 * todavía está en la cola.
 */
function derivarDeEmbarques(eventos) {
  const ultimo = new Map()
  ;[...eventos]
    .sort((a, b) => new Date(a.ocurrido_at) - new Date(b.ocurrido_at))
    .forEach(e => ultimo.set(`${e.pasajero_id || e.client_id}`, e))
  return [...ultimo.values()].map(e => ({
    zarpe_id: e.zarpe_id,
    pasajero_id: e.pasajero_id || null,
    registro_id: e.registro_id || null,
    client_id: e.client_id,
    estado: e.evento || e.estado,
    nombre: e.nombre || null,
    documento: e.documento || null,
    // El manifiesto los pide, y sin red esta es la única fuente que hay.
    tipo_documento: e.tipo_documento || null,
    pais_id: e.pais_id || null,
    categoria: e.categoria || null,
    ocurrido_at: e.ocurrido_at,
  }))
}

function nuevoClientId() {
  return (crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.floor(performance.now() * 1000)}`)
}

/** Nombre del dispositivo, para saber desde dónde se marcó. */
function dispositivo() {
  const ua = navigator.userAgent
  if (/iPad/i.test(ua)) return 'iPad'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/Android/i.test(ua)) return 'Android'
  return 'Computador'
}

export function useZarpesDelDia(fecha) {
  const [zarpes, setZarpes] = useState([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    if (!fecha) return
    const { data } = await supabase
      .from('zarpes')
      .select('*, lanchas (id, nombre, codigo, capacidad)')
      .eq('fecha', fecha)
      .order('hora_programada', { ascending: true })
    setZarpes(data || [])
    setCargando(false)
  }, [fecha])

  useEffect(() => { recargar() }, [recargar])

  useEffect(() => {
    if (!fecha) return
    const canal = supabase
      .channel(`zarpes:${fecha}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zarpes' }, recargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [fecha, recargar])

  const programar = useCallback(async (hora = '09:00') => {
    const { error } = await supabase.rpc('programar_zarpes', { p_fecha: fecha, p_hora: hora })
    await recargar()
    return { error }
  }, [fecha, recargar])

  return { zarpes, cargando, recargar, programar }
}

/**
 * Lo que va a bordo sin ser pasadía: empleados, huéspedes de alojamiento, el
 * piloto y el catálogo de países. Solo el manifiesto lo necesita, así que vive
 * aparte de useEmbarque en vez de engordarlo.
 *
 * Con red se lee del servidor; sin red, de la copia local. Es lo mismo que
 * hace el embarque, y por la misma razón: el manifiesto se imprime en el
 * muelle, donde puede no haber señal.
 */
export function useDatosManifiesto(zarpe) {
  const [datos, setDatos] = useState({
    empleados: [], zarpeEmpleados: [], alojamiento: [], pilotos: [], paises: [],
  })

  const cargar = useCallback(async () => {
    if (!zarpe?.id) return

    if (navigator.onLine) {
      const [ze, za, emp, pil, pai] = await Promise.all([
        supabase.from('zarpe_empleados').select('*').eq('zarpe_id', zarpe.id),
        supabase.from('zarpe_alojamiento').select('*').eq('zarpe_id', zarpe.id),
        supabase.from('empleados').select('*'),
        supabase.from('pilotos').select('*'),
        supabase.from('paises').select('*'),
      ])
      if (!ze.error && !za.error) {
        setDatos({
          zarpeEmpleados: ze.data || [],
          alojamiento: za.data || [],
          empleados: emp.data || [],
          pilotos: pil.data || [],
          paises: pai.data || [],
        })
        return
      }
    }

    const local = await leerDiaLocal(zarpe.fecha)
    const [empleados, pilotos, paises] = await Promise.all([
      leerCatalogoLocal('empleados'),
      leerCatalogoLocal('pilotos'),
      leerCatalogoLocal('paises'),
    ])
    setDatos({
      zarpeEmpleados: (local.zarpeEmpleados || []).filter(z => z.zarpe_id === zarpe.id),
      alojamiento: (local.zarpeAlojamiento || []).filter(z => z.zarpe_id === zarpe.id),
      empleados, pilotos, paises,
    })
  }, [zarpe?.id, zarpe?.fecha])

  useEffect(() => { cargar() }, [cargar])

  return { ...datos, recargar: cargar }
}

/**
 * La lista de embarque de un zarpe: personas esperadas, su estado actual, y
 * las acciones que registran hechos nuevos.
 */
export function useEmbarque(zarpe) {
  const [registros, setRegistros] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [estados, setEstados] = useState([])
  const [cargando, setCargando] = useState(true)

  /**
   * Con red, del servidor; sin red, de la copia local que se precargó al
   * cerrar el tentativo. En ambos casos se suman los hechos que todavía
   * están en la cola: lo que la asesora acaba de marcar tiene que verse ya.
   */
  const cargar = useCallback(async () => {
    if (!zarpe?.id) return

    let vivos = []
    let pax = []
    let est = []

    if (navigator.onLine) {
      const { data: regs, error } = await supabase
        .from('registros')
        .select('*, lanchas (id, nombre), planes (id, nombre)')
        .eq('fecha', zarpe.fecha)
        .eq('lancha_id', zarpe.lancha_id)

      if (!error) {
        vivos = (regs || []).filter(r => r.estado !== 'cancelada')
        if (vivos.length) {
          const { data } = await supabase.from('pasajeros').select('*')
            .in('registro_id', vivos.map(r => r.id))
          pax = data || []
        }
        const { data: e } = await supabase.from('estado_embarques').select('*')
          .eq('zarpe_id', zarpe.id)
        est = e || []
        // La copia local se refresca con lo que se acaba de leer.
        if (vivos.length) await db.registros.bulkPut(vivos)
        if (pax.length) await db.pasajeros.bulkPut(pax)
      }
    }

    if (!vivos.length) {
      const local = await leerDiaLocal(zarpe.fecha)
      vivos = local.registros
        .filter(r => r.lancha_id === zarpe.lancha_id && r.estado !== 'cancelada')
      pax = local.pasajeros.filter(p => vivos.some(r => r.id === p.registro_id))
      if (!est.length) est = derivarDeEmbarques(local.embarques.filter(e => e.zarpe_id === zarpe.id))
    }

    // Los hechos que aún no salieron del iPad cuentan igual.
    const enCola = await db.cola.where('tabla').equals('embarques').toArray()
    const propios = enCola.map(c => c.fila).filter(f => f.zarpe_id === zarpe.id)
    if (propios.length) {
      est = derivarDeEmbarques([
        ...est.map(e => ({ ...e, evento: e.estado, ocurrido_at: e.ocurrido_at })),
        ...propios,
      ])
    }

    setRegistros(vivos)
    setPasajeros(pax)
    setEstados(est)
    setCargando(false)
  }, [zarpe?.id, zarpe?.fecha, zarpe?.lancha_id])

  useEffect(() => { cargar() }, [cargar])

  // Si la cola cambia (se encoló algo o se drenó), la lista se repinta.
  useEffect(() => alCambiarLaCola(cargar), [cargar])

  // Lo que marque otro dispositivo aparece aquí.
  useEffect(() => {
    if (!zarpe?.id) return
    const canal = supabase
      .channel(`embarque:${zarpe.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'embarques' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [zarpe?.id, cargar])

  const porClave = useMemo(() => {
    const mapa = new Map()
    estados.forEach(e => mapa.set(e.pasajero_id || e.client_id, e))
    return mapa
  }, [estados])

  /**
   * La lista agrupada por reserva. Una reserva sin nombres cargados no puede
   * quedarse fuera —son justo los grupos grandes— así que se muestra como
   * plazas sin nombre, que igual se embarcan.
   */
  const grupos = useMemo(() => {
    return registros.map(r => {
      const suyos = pasajeros.filter(p => p.registro_id === r.id)
      const plan = r.adultos + r.ninos + r.infantes + r.cortesias

      const filas = suyos.map(p => ({
        tipo: 'nominal',
        pasajero_id: p.id,
        registro_id: r.id,
        nombre: p.nombre,
        documento: p.documento,
        categoria: p.categoria,
        estado: porClave.get(p.id)?.estado || null,
      }))

      // Plazas de la reserva que todavía no tienen nombre.
      const anonimos = estados.filter(e => e.registro_id === r.id && !e.pasajero_id)
      const sinNombre = Math.max(0, plan - suyos.length)
      for (let i = 0; i < Math.max(sinNombre, anonimos.length); i++) {
        const ev = anonimos[i]
        filas.push({
          tipo: 'sin_nombre',
          registro_id: r.id,
          indice: i,
          client_id: ev?.client_id,
          nombre: `Persona ${suyos.length + i + 1} de ${plan}`,
          estado: ev?.estado || null,
        })
      }

      const embarcados = filas.filter(f => ['check_in', 'walk_in'].includes(f.estado)).length
      return { registro: r, filas, plan, embarcados, faltan: filas.length - embarcados }
    })
  }, [registros, pasajeros, porClave, estados])

  // Los que llegaron sin reserva.
  const walkIns = useMemo(
    () => estados.filter(e => e.estado === 'walk_in' && !e.registro_id),
    [estados]
  )

  const contador = useMemo(() => {
    const esperados = grupos.reduce((s, g) => s + g.filas.length, 0)
    const embarcados = grupos.reduce((s, g) => s + g.embarcados, 0) + walkIns.length
    const noLlegaron = grupos.reduce(
      (s, g) => s + g.filas.filter(f => f.estado === 'no_show').length, 0)
    return { esperados, embarcados, noLlegaron, faltan: Math.max(0, esperados - embarcados - noLlegaron) }
  }, [grupos, walkIns])

  /**
   * Registra un hecho. Nunca corrige: siempre inserta.
   *
   * Se escribe PRIMERO en la cola local y se devuelve de inmediato: en el
   * muelle nadie espera a la red para seguir embarcando. El envío ocurre
   * detrás, y reenviarlo es inofensivo gracias al client_id.
   */
  const registrarEvento = useCallback(async (fila, evento, extra = {}) => {
    if (!zarpe?.id) return { error: { message: 'Sin zarpe activo' } }
    const { data: sesion } = await supabase.auth.getSession().catch(() => ({ data: null }))

    const evt = {
      zarpe_id: zarpe.id,
      pasajero_id: fila?.pasajero_id || null,
      registro_id: fila?.registro_id || null,
      evento,
      nombre: extra.nombre || null,
      documento: extra.documento || null,
      tipo_documento: extra.tipo_documento || null,
      pais_id: extra.pais_id || null,
      categoria: extra.categoria || null,
      ocurrido_at: new Date().toISOString(),
      registrado_por: sesion?.session?.user?.id || null,
      dispositivo: dispositivo(),
      client_id: nuevoClientId(),
    }

    const quien = extra.nombre || fila?.nombre || 'Alguien'
    const ETIQUETA = {
      check_in: 'embarcó', no_show: 'no llegó',
      walk_in: 'sin reserva', desembarque: 'desembarcó',
    }
    await encolar('embarques', evt, `${quien} — ${ETIQUETA[evento] || evento}`)

    // La copia local guarda el hecho aunque el servidor todavía no lo sepa.
    await db.embarques.put(evt)
    await cargar()
    return { error: null }
  }, [zarpe?.id, cargar])

  const cerrar = useCallback(async () => {
    const { data, error } = await supabase.rpc('cerrar_zarpe', { p_zarpe_id: zarpe.id })
    return { zarpe: Array.isArray(data) ? data[0] : data, error }
  }, [zarpe?.id])

  return {
    grupos, walkIns, contador, cargando, registrarEvento, cerrar, recargar: cargar,
    // Crudos, para el manifiesto: lo arma armarManifiesto() y no esta pantalla.
    registros, pasajeros, estados,
  }
}
