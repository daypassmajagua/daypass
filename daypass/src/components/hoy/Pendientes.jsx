import { Link } from 'react-router-dom'
import { Check, TriangleAlert } from 'lucide-react'
import { classNames, fraseFecha } from '../../lib/utils'

/**
 * Lo pendiente, como lista de tareas con nombre propio.
 * Cada línea dice qué pasa y trae el botón que lo resuelve.
 */
export default function Pendientes({ lista, fecha }) {
  if (!lista.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-verde-50 px-5 py-4">
        <Check size={20} className="text-verde-500 shrink-0" />
        <p className="font-bold text-verde-600 text-[15px]">
          Todo listo para {fraseFecha(fecha).toLowerCase()}.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {lista.map(p => (
        <li
          key={p.id}
          className={classNames(
            'flex items-center gap-3 flex-wrap rounded-2xl px-4 py-3',
            p.tono === 'tardio' ? 'bg-coral-50 ring-1 ring-coral-100' : 'bg-white shadow-[0_1px_2px_rgba(22,24,44,.05)]'
          )}
        >
          {p.tono === 'tardio' && (
            <TriangleAlert size={18} className="text-coral-600 shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <p className={classNames(
              'text-[15px] font-bold',
              p.tono === 'tardio' ? 'text-coral-700' : 'text-tinta'
            )}>
              {p.texto}
            </p>
            {p.detalle && (
              <p className={classNames(
                'text-sm',
                p.tono === 'tardio' ? 'text-coral-700/80' : 'text-tinta-2'
              )}>
                {p.detalle}
              </p>
            )}
            {/* El porqué, cuando el pendiente no se explica solo. */}
            {p.porque && (
              <p className="text-[13px] text-tinta-2 mt-0.5">{p.porque}</p>
            )}
          </div>

          {p.accion && (
            <Link
              to={p.accion.a}
              className={classNames(
                'shrink-0 inline-flex items-center rounded-xl px-4 min-h-[44px] text-sm font-bold transition-colors',
                p.tono === 'tardio'
                  ? 'bg-coral-600 text-white hover:bg-coral-700'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              )}
            >
              {p.accion.etiqueta}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}
