import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Qué temporada es una fecha, y si de verdad se sabe.
 *
 * ── El respaldo que no se puede callar ──────────────────────────────────────
 *
 * Cuando ninguna temporada cubre la fecha, se asume «baja». Eso está bien como
 * respaldo —`registros.temporada` es NOT NULL y no puede quedar en blanco—
 * pero **callarlo es peligroso**: el precio se congela al crear la reserva
 * (regla 4), así que un día de temporada alta sin cargar quedaría vendido al
 * precio bajo para siempre, y nadie lo vería hasta facturar.
 *
 * Por eso el hook devuelve también `supuesta`: la pantalla decide cómo
 * decirlo, pero ya no puede no saberlo.
 */
export function useTemporada(fecha) {
  const [temporada, setTemporada] = useState(null)
  const [supuesta, setSupuesta] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!fecha) return
    async function fetchTemporada() {
      setLoading(true)
      // `maybeSingle` y no `single`: sin temporada que cubra la fecha, `single`
      // devuelve error y aquí el caso normal de una base recién montada es
      // justamente ese.
      const { data } = await supabase
        .from('temporadas')
        .select('*')
        .lte('fecha_inicio', fecha)
        .gte('fecha_fin', fecha)
        .maybeSingle()
      setTemporada(data?.tipo || 'baja')
      setSupuesta(!data?.tipo)
      setLoading(false)
    }
    fetchTemporada()
  }, [fecha])

  return { temporada, supuesta, loading }
}
