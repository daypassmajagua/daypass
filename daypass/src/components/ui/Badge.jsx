import { ESTADO_LABELS, ESTADO_COLORS, classNames } from '../../lib/utils'

export default function Badge({ estado, className = '' }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        ESTADO_COLORS[estado] || 'bg-gray-100 text-gray-600',
        className
      )}
    >
      {ESTADO_LABELS[estado] || estado}
    </span>
  )
}
