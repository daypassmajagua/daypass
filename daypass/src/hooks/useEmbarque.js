import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

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
 * La lista de embarque de un zarpe: personas esperadas, su estado actual, y
 * las acciones que registran hechos nuevos.
 */
export function useEmbarque(zarpe) {
  const [registros, setRegistros] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [estados, setEstados] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!zarpe?.id) return
    const { data: regs } = await supabase
      .from('registros')
      .select('*, lanchas (id, nombre), planes (id, nombre)')
      .eq('fecha', zarpe.fecha)
      .eq('lancha_id', zarpe.lancha_id)

    const vivos = (regs || []).filter(r => !['cancelada'].includes(r.estado))
    setRegistros(vivos)

    if (vivos.length) {
      const { data: pax } = await supabase
        .from('pasajeros')
        .select('*')
        .in('registro_id', vivos.map(r => r.id))
      setPasajeros(pax || [])
    } else {
      setPasajeros([])
    }

    const { data: est } = await supabase
      .from('estado_embarques')
      .select('*')
      .eq('zarpe_id', zarpe.id)
    setEstados(est || [])
    setCargando(false)
  }, [zarpe?.id, zarpe?.fecha, zarpe?.lancha_id])

  useEffect(() => { cargar() }, [cargar])

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

  /** Registra un hecho. Nunca corrige: siempre inserta. */
  const registrarEvento = useCallback(async (fila, evento, extra = {}) => {
    if (!zarpe?.id) return { error: { message: 'Sin zarpe activo' } }
    const { data: sesion } = await supabase.auth.getSession()

    const evt = {
      zarpe_id: zarpe.id,
      pasajero_id: fila?.pasajero_id || null,
      registro_id: fila?.registro_id || null,
      evento,
      nombre: extra.nombre || null,
      documento: extra.documento || null,
      pais_id: extra.pais_id || null,
      categoria: extra.categoria || null,
      ocurrido_at: new Date().toISOString(),
      registrado_por: sesion?.session?.user?.id || null,
      dispositivo: dispositivo(),
      client_id: nuevoClientId(),
    }

    const { error } = await supabase.from('embarques').insert(evt)
    if (!error) await cargar()
    return { error }
  }, [zarpe?.id, cargar])

  const cerrar = useCallback(async () => {
    const { data, error } = await supabase.rpc('cerrar_zarpe', { p_zarpe_id: zarpe.id })
    return { zarpe: Array.isArray(data) ? data[0] : data, error }
  }, [zarpe?.id])

  return { grupos, walkIns, contador, cargando, registrarEvento, cerrar, recargar: cargar }
}
