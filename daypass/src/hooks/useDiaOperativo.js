import { useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'

/**
 * El estado del día y su sincronización entre los tres puntos.
 *
 * Lo que se busca: cuando el muelle marca un pasajero como embarcado, la
 * oficina y la isla lo ven sin que nadie recargue. Cuando la oficina agrega
 * una reserva de última hora, aparece en el iPad del muelle.
 */

export const ESTADO_DIA_LABELS = {
  planeando: 'En planeación',
  tentativo_cerrado: 'Tentativo cerrado',
  en_operacion: 'En operación',
  cerrado: 'Día cerrado',
}

/** Un día sin fila todavía se comporta como si estuviera en planeación. */
const DIA_NUEVO = { estado: 'planeando', cerrado_tentativo_at: null, cerrado_at: null }

/**
 * Trae el día y lo mantiene al día. Se llama UNA sola vez, en el layout:
 * si cada pantalla se suscribiera por su cuenta habría canales duplicados
 * sobre el mismo tema.
 */
export function useSincronizarDia(fecha) {
  const setDia = useAppStore(s => s.setDia)

  const recargar = useCallback(async () => {
    if (!fecha) return
    const { data } = await supabase
      .from('dias_operativos')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle()
    setDia(data || { ...DIA_NUEVO, fecha })
  }, [fecha, setDia])

  useEffect(() => { recargar() }, [recargar])

  useEffect(() => {
    if (!fecha) return
    const canal = supabase
      .channel(`dia:${fecha}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dias_operativos', filter: `fecha=eq.${fecha}` },
        payload => { if (payload.new) setDia(payload.new) }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [fecha, setDia])

  return { recargar }
}

/** Lee el día que ya está sincronizado. Sin suscripciones propias. */
export function useDiaOperativo(fecha) {
  const dia = useAppStore(s => s.dia)
  const vigente = dia && (!fecha || dia.fecha === fecha) ? dia : { ...DIA_NUEVO, fecha }

  return {
    dia: vigente,
    estado: vigente.estado || 'planeando',
    enPlaneacion: (vigente.estado || 'planeando') === 'planeando',
    cerrado: vigente.estado === 'cerrado',
  }
}

/** Cierra el tentativo del día. Dispara cocina y folios: por eso confirma antes. */
export async function cerrarTentativo(fecha) {
  const { data, error } = await supabase.rpc('cerrar_tentativo', { p_fecha: fecha })
  return { dia: Array.isArray(data) ? data[0] : data, error }
}

export async function cerrarDia(fecha) {
  const { data, error } = await supabase.rpc('cerrar_dia', { p_fecha: fecha })
  return { dia: Array.isArray(data) ? data[0] : data, error }
}

/**
 * Cambio de estado a mano, con motivo. Existe porque hasta el sprint del muelle
 * no hay operación que dispare los estados; queda registrado en la bitácora.
 */
export async function cambiarEstadoManual(registroId, estado, motivo) {
  const { data, error } = await supabase.rpc('cambiar_estado_manual', {
    p_registro_id: registroId,
    p_estado: estado,
    p_motivo: motivo || null,
  })
  return { registro: Array.isArray(data) ? data[0] : data, error }
}

/**
 * Se vuelve a pedir la lista cuando algo cambia en otro punto.
 * `alCambiar` debe ser estable (useCallback) o la suscripción se rehace.
 */
export function useRegistrosEnVivo(fecha, alCambiar) {
  useEffect(() => {
    if (!fecha) return
    const canal = supabase
      .channel(`registros:${fecha}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registros', filter: `fecha=eq.${fecha}` },
        alCambiar
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pasajeros' },
        alCambiar
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [fecha, alCambiar])
}

/**
 * Quién está conectado ahora mismo. Sirve para saber si el iPad del muelle
 * está en línea o está acumulando eventos sin señal.
 */
export const PUNTO_LABELS = { oficina: 'Oficina', muelle: 'Muelle', isla: 'Isla' }

export function usePresencia(punto = 'oficina') {
  const setPuntosEnLinea = useAppStore(s => s.setPuntosEnLinea)

  useEffect(() => {
    const canal = supabase.channel('daypass-presencia', {
      config: { presence: { key: `${punto}-${Math.floor(performance.now())}` } },
    })

    canal
      .on('presence', { event: 'sync' }, () => {
        const estado = canal.presenceState()
        const vistos = new Set()
        Object.values(estado).forEach(entradas =>
          entradas.forEach(e => { if (e.punto) vistos.add(e.punto) })
        )
        setPuntosEnLinea([...vistos])
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await canal.track({ punto, desde: new Date().toISOString() })
        }
      })

    return () => { supabase.removeChannel(canal) }
  }, [punto, setPuntosEnLinea])
}
