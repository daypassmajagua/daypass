import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function usePlanes() {
  const [planes, setPlanes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('planes')
      .select('*')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        setPlanes(data || [])
        setLoading(false)
      })
  }, [])

  return { planes, loading }
}
