import { Link } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { classNames } from '../../lib/utils'

/**
 * Un pendiente con nombre propio: qué falta, por qué importa, y el botón que
 * lo resuelve.
 *
 * Sale tal cual de "Hoy", que es la pantalla que sí pasó por diseño. Las tres
 * líneas de texto no son decoración, son tres preguntas distintas:
 *
 *   texto    →  qué falta            "Faltan 14 nombres en 7 reservas"
 *   detalle  →  cuáles               "Roberto Guzmán (0 de 2) · Familia Rodríguez…"
 *   porque   →  por qué importa      "La Capitanía pide nombre y documento"
 *
 * El `porque` se agregó cuando el dueño dijo «no entiendo lo de los nombres»:
 * un aviso que no explica su motivo se aprende a ignorar. Y se muestra una
 * sola vez por grupo de pendientes del mismo tipo — repetido en cada línea
 * deja de leerse a la tercera.
 *
 * **Coral solo para lo tardío.** Es la regla 3 del sistema visual: si todo
 * grita, nada grita. Un pendiente normal va en blanco; solo lo que cambió
 * después del cierre —y que por tanto ya le costó trabajo a alguien más— se
 * pinta de coral.
 */
export default function TarjetaPendiente({ pendiente, className = '' }) {
  const { texto, detalle, porque, accion, tono } = pendiente
  const tardio = tono === 'tardio'

  return (
    <li
      className={classNames(
        'flex items-center gap-3 flex-wrap rounded-2xl px-4 py-3',
        tardio
          ? 'bg-coral-50 ring-1 ring-coral-100'
          : 'bg-white shadow-[0_1px_2px_rgba(22,24,44,.05)]',
        className
      )}
    >
      {tardio && <TriangleAlert size={18} className="text-coral-600 shrink-0" aria-hidden="true" />}

      <div className="min-w-0 flex-1">
        <p className={classNames('text-[15px] font-bold', tardio ? 'text-coral-700' : 'text-tinta')}>
          {texto}
        </p>
        {detalle && (
          <p className={classNames('text-sm', tardio ? 'text-coral-700/80' : 'text-tinta-2')}>
            {detalle}
          </p>
        )}
        {porque && <p className="text-[13px] text-tinta-2 mt-0.5">{porque}</p>}
      </div>

      {accion && (
        <Link
          to={accion.a}
          className={classNames(
            'shrink-0 inline-flex items-center rounded-xl px-4 min-h-[44px] text-sm font-bold transition-colors',
            tardio
              ? 'bg-coral-600 text-white hover:bg-coral-700'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          )}
        >
          {accion.etiqueta}
        </Link>
      )}
    </li>
  )
}
