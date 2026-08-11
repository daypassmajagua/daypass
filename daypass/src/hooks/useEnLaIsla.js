import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { leerDiaLocal } from '../lib/offline/precarga'
import { enLaIsla } from '../lib/enLaIsla'

/**
 * Cuánta gente hay en la isla, para quien lo quiera mostrar.
 *
 * Lo usan dos pantallas que no se parecen en nada —la isla, de pie y sin
 * señal; la franja del día, en la oficina— y el número tiene que ser el mismo
 * en las dos. Con la consulta escrita dos veces, en un mes serían dos números.
 *
 * ── Primero la copia local, después el servidor ─────────────────────────────
 *
 * Siempre en ese orden, aunque en la oficina haya señal de sobra: es el orden
 * que hace que la isla funcione sin red, y tener dos caminos según dónde estés
 * es tener dos comportamientos que probar. Lo del servidor solo completa.
 *
 * `mirado` es cuándo se miró. Va junto al número porque un número viejo que se
 * sabe viejo es información, y uno viejo que parece fresco es una mentira.
 */
export function useEnLaIsla(fecha, activo = true) {
  const [conteo, setConteo] = useState(null)
  const [mirado, setMirado] = useState(null)

  const mirar = useCallback(async () => {
    if (!activo || !fecha) return

    const local = await leerDiaLocal(fecha)
    let datos = {
      zarpes: local.zarpes,
      embarques: local.embarques,
      alojamiento: local.zarpeAlojamiento,
      equipo: local.zarpeEmpleados,
    }

    if (navigator.onLine) {
      const { data: zarpes } = await supabase.from('zarpes')
        .select('id, sentido').eq('fecha', fecha)
      const ids = (zarpes || []).map(z => z.id)
      if (ids.length) {
        const [emb, alo, emp] = await Promise.all([
          supabase.from('embarques').select('zarpe_id, evento').in('zarpe_id', ids),
          supabase.from('zarpe_alojamiento').select('zarpe_id').in('zarpe_id', ids),
          supabase.from('zarpe_empleados').select('zarpe_id').in('zarpe_id', ids),
        ])
        datos = {
          zarpes,
          embarques: emb.data || datos.embarques,
          alojamiento: alo.data || datos.alojamiento,
          equipo: emp.data || datos.equipo,
        }
      } else if (zarpes) {
        datos = { ...datos, zarpes }
      }
    }

    setConteo(enLaIsla(datos))
    setMirado(Date.now())
  }, [fecha, activo])

  useEffect(() => { mirar() }, [mirar])

  return { conteo, mirado, remirar: mirar }
}
