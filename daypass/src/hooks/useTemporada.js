import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useTemporada(fecha) {
  const [temporada, setTemporada] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!fecha) return
    async function fetchTemporada() {
      setLoading(true)
      const { data } = await supabase
        .from('temporadas')
        .select('*')
        .lte('fecha_inicio', fecha)
        .gte('fecha_fin', fecha)
        .single()
      setTemporada(data?.tipo || 'baja')
      setLoading(false)
    }
    fetchTemporada()
  }, [fecha])

  return { temporada, loading }
}
