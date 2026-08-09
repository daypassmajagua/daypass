import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Los pasajeros con nombre propio de una reserva.
 * Mientras la reserva no exista (formulario nuevo), se trabaja en memoria y
 * se guardan al crearla — la asesora puede pegar la lista antes de guardar.
 */
export function usePasajeros(registroId) {
  const [pasajeros, setPasajeros] = useState([])
  const [cargando, setCargando] = useState(Boolean(registroId))

  // Sin setState síncrono: en una reserva nueva no hay nada que traer y el
  // estado ya arranca vacío.
  const recargar = useCallback(async () => {
    if (!registroId) return
    const { data } = await supabase
      .from('pasajeros')
      .select('*, paises (id, codigo, nombre)')
      .eq('registro_id', registroId)
      .order('created_at', { ascending: true })
    setPasajeros(data || [])
    setCargando(false)
  }, [registroId])

  useEffect(() => { recargar() }, [recargar])

  return { pasajeros, setPasajeros, cargando, recargar }
}

/** Campos que acepta la tabla; el resto (marcas del parser) no viaja a la base. */
function aFilaDeBase(p, registroId) {
  return {
    registro_id: registroId,
    nombre: (p.nombre || '').trim(),
    tipo_documento: p.tipo_documento || null,
    documento: (p.documento || '').trim() || null,
    pais_id: p.pais_id || null,
    categoria: p.categoria || 'adulto',
    opcion_plato_id: p.opcion_plato_id || null,
    restriccion_alimentaria: (p.restriccion_alimentaria || '').trim() || null,
  }
}

/**
 * Guarda la lista de una reserva emparejando por id.
 *
 * **No borra y reinserta**, aunque sea más corto de escribir. `embarques`
 * apunta a `pasajeros` con `on delete set null`, y ese `set null` es un UPDATE
 * que el trigger de inmutabilidad rechaza: borrar a alguien que ya subió a la
 * lancha hacía fallar el guardado entero. Pasa a diario si alguien corrige una
 * reserva después de las 8:30.
 *
 * Además, reinsertar cambia los `id` de todos los pasajeros, y con ellos el
 * enlace a su persona y el `almuerza` que alguien marcó a mano.
 *
 * Es la misma forma que usa `guardar_pasajeros_por_token` desde la 018.
 */
export async function guardarPasajeros(registroId, lista) {
  if (!registroId) return { error: null }

  const conNombre = lista.filter(p => (p.nombre || '').trim())

  const { data: previos, error: errorLectura } = await supabase
    .from('pasajeros')
    .select('id')
    .eq('registro_id', registroId)
  if (errorLectura) return { error: errorLectura }

  const vigentes = new Set(conNombre.map(p => p.id).filter(Boolean))
  const sobran = (previos || []).map(p => p.id).filter(id => !vigentes.has(id))

  const nuevos = conNombre.filter(p => !p.id).map(p => aFilaDeBase(p, registroId))
  if (nuevos.length) {
    const { error } = await supabase.from('pasajeros').insert(nuevos)
    if (error) return { error }
  }

  for (const p of conNombre.filter(p => p.id)) {
    const { error } = await supabase
      .from('pasajeros')
      .update(aFilaDeBase(p, registroId))
      .eq('id', p.id)
    if (error) return { error }
  }

  if (sobran.length) {
    const { error } = await supabase.from('pasajeros').delete().in('id', sobran)
    if (error) {
      // El mensaje crudo de Postgres aquí es «Los embarques no se corrigen»,
      // que no le dice nada a quien está editando una reserva.
      return { error: { ...error, message:
        'No se pudo quitar a alguien de la lista: ya embarcó. En el muelle se corrige.' } }
    }
  }

  return { error: null }
}

/** Cuántos nombres tiene cada reserva del día, para la columna del listado. */
export async function contarPorRegistro(registroIds) {
  if (!registroIds?.length) return {}
  const { data } = await supabase
    .from('pasajeros')
    .select('registro_id')
    .in('registro_id', registroIds)
  const conteo = {}
  ;(data || []).forEach(p => { conteo[p.registro_id] = (conteo[p.registro_id] || 0) + 1 })
  return conteo
}
