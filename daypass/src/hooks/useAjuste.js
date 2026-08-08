import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Una constante de la operación, leída de la base.
 *
 * Regla 22: ningún horario, correo, texto ni dato del hotel escrito en el
 * código. La edad del infante estaba a mano en tres pantallas y en los textos
 * ES/EN de la página del cliente; cambiarla obligaba a tocar cinco archivos y
 * a desplegar.
 *
 * El valor por defecto no es una segunda fuente de verdad: es lo que se
 * muestra mientras llega la respuesta, y lo que salva la pantalla si la
 * migración que crea el ajuste todavía no corrió. Un número viejo en pantalla
 * es mejor que un hueco.
 */

// Los ajustes cambian una vez al año. Pedirlos en cada pantalla que los use
// sería una consulta por render; con esto se piden una vez por sesión.
const cache = new Map()
let cargando = null

async function cargarTodos() {
  if (cache.size) return cache
  if (!cargando) {
    cargando = supabase.from('ajustes').select('clave, valor').then(({ data, error }) => {
      if (!error) (data || []).forEach(a => cache.set(a.clave, a.valor))
      cargando = null
      return cache
    })
  }
  return cargando
}

/** Vacía la memoria: la llama Configuración al guardar. */
export function olvidarAjustes() {
  cache.clear()
}

export function useAjuste(clave, defecto) {
  const [valor, setValor] = useState(() => cache.get(clave) ?? defecto)

  useEffect(() => {
    let vigente = true
    cargarTodos().then(m => {
      if (vigente && m.has(clave)) setValor(m.get(clave))
    })
    return () => { vigente = false }
  }, [clave])

  return valor
}

/** La edad hasta la que alguien cuenta como infante. Número, no texto. */
export function useEdadMaxInfante() {
  const bruto = useAjuste('edad_max_infante', '3')
  const n = Number(bruto)
  return Number.isFinite(n) && n > 0 ? n : 3
}
