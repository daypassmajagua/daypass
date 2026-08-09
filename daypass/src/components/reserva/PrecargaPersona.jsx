import { useEffect, useState } from 'react'
import { UserCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { plural } from '../../lib/utils'

/**
 * "Esta persona ya vino": el aviso que ahorra volver a digitar todo.
 *
 * Mira lo que la asesora está escribiendo en el documento del titular y, si
 * coincide con alguien de `personas` (migración 020), lo ofrece. **No rellena
 * solo**: una coincidencia de documento puede ser un error de digitación, y
 * pisar el nombre que ella acaba de escribir sería peor que no ayudar. Se
 * muestra quién es, y ella decide con un toque.
 *
 * Solo busca desde tres caracteres y con un respiro entre teclas: la lista de
 * personas va a tener miles de filas y esto corre mientras alguien escribe.
 *
 * ⚠ Esto es de la oficina, **no** de la página del cliente. Dejar que
 * cualquiera con un enlace escriba un documento y vea a quién pertenece sería
 * regalar la base de datos: `buscar_personas` exige sesión del equipo y por eso
 * el check-in público no la llama.
 */
export default function PrecargaPersona({ documento, onUsar }) {
  // El texto viaja junto con sus resultados: así una respuesta que llega tarde
  // —porque la asesora siguió escribiendo— se descarta sola al pintar, sin
  // tener que limpiar el estado a mano cada vez que cambia el campo.
  const [hallazgo, setHallazgo] = useState({ texto: '', filas: [] })
  const [descartado, setDescartado] = useState('')

  const texto = (documento || '').trim()

  useEffect(() => {
    const buscado = (documento || '').trim()
    if (buscado.length < 3) return

    let vigente = true
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('buscar_personas', { p_texto: buscado, p_limite: 3 })
      if (vigente) setHallazgo({ texto: buscado, filas: data || [] })
    }, 350)

    return () => { vigente = false; clearTimeout(t) }
  }, [documento])

  const visibles = hallazgo.texto === texto
    ? hallazgo.filas.filter(p => p.documento !== descartado)
    : []
  if (!visibles.length) return null

  return (
    <div className="rounded-xl bg-verde-50 px-3 py-2.5 flex flex-col gap-2">
      {visibles.map(p => (
        <div key={p.id} className="flex items-center gap-2 flex-wrap">
          <UserCheck size={16} className="text-verde-600 shrink-0" aria-hidden="true" />
          <span className="text-[14px] text-tinta">
            <b>{p.nombre_completo}</b>
            {p.veces > 0 && (
              <span className="text-tinta-2"> · ya vino {plural(p.veces, 'vez', 'veces')}</span>
            )}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => onUsar(p)}
              className="text-[13px] font-bold text-verde-600 px-2 py-1 rounded-lg hover:bg-verde-100"
            >
              Usar sus datos
            </button>
            <button
              type="button"
              onClick={() => setDescartado(p.documento)}
              className="text-[13px] text-tinta-2 px-2 py-1 rounded-lg hover:bg-fondo"
            >
              No es
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
