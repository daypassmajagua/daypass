import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LineaDeTiempo } from '../patrones'

/**
 * Qué le ha pasado a esta reserva.
 *
 * ── Por qué aquí y no en un panel aparte ────────────────────────────────────
 *
 * La reserva ya tiene su página, y es esta. Abrirle un perfil al lado sería
 * mantener dos sitios que muestran lo mismo y decidir cada vez a cuál se
 * entra. Lo que de verdad faltaba no era otro sitio: era **la historia**, que
 * la base guarda desde la 003 en `cambios_estado` y nadie mostraba.
 *
 * ── Lo que cuenta, y por qué importa ────────────────────────────────────────
 *
 * Cada cambio de estado con su hora, su origen y quién lo hizo. El origen es
 * la parte que vale: la regla 3 dice que **los estados los dispara la
 * operación y el cambio manual es la excepción auditada**. Aquí eso se ve —lo
 * manual va destacado, lo del sistema no— y esa distinción es justamente la
 * que se necesita cuando algo salió raro y hay que entender por qué.
 *
 * ── El nombre de quién ──────────────────────────────────────────────────────
 *
 * `cambios_estado.registrado_por` guarda el `user_id`, no el nombre, y la
 * llave apunta a `auth.users`, así que PostgREST no puede traer el perfil de
 * un salto. Se piden los perfiles aparte —son diez filas— y se cruzan aquí.
 * Antes de la 024 muchos quedaron en null: eso no se disimula, se dice.
 */

/** Desde cuándo la base guarda quién hizo cada cosa (migración 024). */
const HAY_FIRMA_DESDE = '2026-08-10'

const COMO_SE_LLAMA = {
  tentativa: 'tentativa',
  confirmada: 'confirmada',
  completada: 'completada',
  cancelada: 'cancelada',
  noshow: 'no se presentó',
}

export default function HistoriaDeLaReserva({ registroId }) {
  const [eventos, setEventos] = useState(null)

  useEffect(() => {
    if (!registroId) return
    let vigente = true

    Promise.all([
      supabase.from('cambios_estado').select('*')
        .eq('registro_id', registroId)
        .order('ocurrido_at', { ascending: false }),
      supabase.from('perfiles').select('user_id, nombre'),
    ]).then(([cambios, perfiles]) => {
      if (!vigente) return
      const nombreDe = new Map((perfiles.data || []).map(p => [p.user_id, p.nombre]))
      setEventos((cambios.data || []).map(c => ({
        cuando: c.ocurrido_at,
        texto: c.estado_anterior
          ? `Pasó de ${COMO_SE_LLAMA[c.estado_anterior] || c.estado_anterior} a ${COMO_SE_LLAMA[c.estado_nuevo] || c.estado_nuevo}`
          : `Nació ${COMO_SE_LLAMA[c.estado_nuevo] || c.estado_nuevo}`,
        motivo: c.motivo || null,
        quien: nombreDe.get(c.registrado_por) || null,
        // Solo lo manual se destaca: es la excepción de la regla 3, y es por
        // lo que alguien abre esta sección a preguntar.
        destacado: c.origen === 'manual',
      })))
    })

    return () => { vigente = false }
  }, [registroId])

  if (!registroId) return null

  return (
    <section className="bg-white rounded-2xl p-5 shadow-[0_1px_2px_rgba(22,24,44,.05)]">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-tinta mb-1">
        <History size={17} className="text-blue-700" />
        Qué le ha pasado a esta reserva
      </h2>
      <p className="text-[13px] text-tinta-2 mb-3">
        Lo que hizo una persona va en negrita; lo demás lo disparó la operación.
      </p>

      {eventos === null ? (
        <p className="text-[15px] text-tinta-2">Cargando…</p>
      ) : (
        <LineaDeTiempo
          eventos={eventos}
          agruparPor="dia"
          desdeCuandoHayFirma={HAY_FIRMA_DESDE}
          vacio={{
            titulo: 'Sin cambios',
            detalle: 'Nació como está y nadie la ha movido.',
          }}
        />
      )}
    </section>
  )
}
