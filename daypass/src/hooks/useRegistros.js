import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useRegistros(fecha) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRegistros = useCallback(async () => {
    if (!fecha) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('registros')
      .select(`
        *,
        lanchas (id, codigo, nombre, capacidad),
        planes (id, nombre, categoria, nivel),
        canales (id, codigo, nombre),
        paises (id, codigo, nombre),
        agencias (id, nombre)
      `)
      .eq('fecha', fecha)
      .order('created_at', { ascending: true })

    if (err) setError(err.message)
    else setRegistros(data || [])
    setLoading(false)
  }, [fecha])

  useEffect(() => {
    fetchRegistros()
  }, [fetchRegistros])

  async function createRegistro(payload) {
    const { data, error } = await supabase
      .from('registros')
      .insert(payload)
      .select()
      .single()
    if (!error) await fetchRegistros()
    return { data, error }
  }

  async function updateRegistro(id, payload) {
    const { data, error } = await supabase
      .from('registros')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (!error) await fetchRegistros()
    return { data, error }
  }

  async function deleteRegistro(id) {
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('id', id)
    if (!error) await fetchRegistros()
    return { error }
  }

  return {
    registros,
    loading,
    error,
    refetch: fetchRegistros,
    createRegistro,
    updateRegistro,
    deleteRegistro,
  }
}
