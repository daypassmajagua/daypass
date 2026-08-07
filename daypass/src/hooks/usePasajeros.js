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
    restriccion_alimentaria: (p.restriccion_alimentaria || '').trim() || null,
  }
}

/** Guarda la lista completa de una reserva: reemplaza lo que hubiera. */
export async function guardarPasajeros(registroId, lista) {
  if (!registroId) return { error: null }

  const { error: errorBorrado } = await supabase
    .from('pasajeros')
    .delete()
    .eq('registro_id', registroId)
  if (errorBorrado) return { error: errorBorrado }

  const filas = lista
    .filter(p => (p.nombre || '').trim())
    .map(p => aFilaDeBase(p, registroId))

  if (!filas.length) return { error: null }

  const { error } = await supabase.from('pasajeros').insert(filas)
  return { error }
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
