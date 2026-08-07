import { ESTADO_LABELS, ESTADO_COLORS, classNames } from '../../lib/utils'

export default function Badge({ estado, className = '' }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center px-3 py-1.5 rounded-[10px] text-[13px] font-bold',
        ESTADO_COLORS[estado] || 'bg-gray-100 text-gray-600',
        className
      )}
    >
      {ESTADO_LABELS[estado] || estado}
    </span>
  )
}
