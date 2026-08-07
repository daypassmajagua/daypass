import { Minus, Plus } from 'lucide-react'
import { classNames } from '../../lib/utils'

/**
 * Contador de personas. Con el dedo, en el iPad o de pie: los dos botones
 * son objetivos grandes y el número se puede escribir directo si son muchos.
 */
export default function Stepper({ label, ayuda, value, onChange, min = 0, max = 400 }) {
  const n = Number(value) || 0
  const fijar = v => onChange(Math.max(min, Math.min(max, v)))

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {ayuda && <span className="block text-[13px] text-tinta-2 font-normal">{ayuda}</span>}
      </label>
      <div className="flex items-center rounded-xl border border-linea bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => fijar(n - 1)}
          disabled={n <= min}
          className="w-12 h-12 flex items-center justify-center shrink-0 text-tinta-2 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          aria-label={`Quitar un${label ? ' ' + label.toLowerCase() : ''}`}
        >
          <Minus size={20} />
        </button>
        <input
          value={n}
          onChange={e => fijar(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
          inputMode="numeric"
          className={classNames(
            'flex-1 min-w-0 h-12 text-center text-xl font-bold tabular bg-transparent',
            'focus:outline-none focus:bg-blue-50',
            n === 0 ? 'text-tinta-2' : 'text-tinta'
          )}
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => fijar(n + 1)}
          disabled={n >= max}
          className="w-12 h-12 flex items-center justify-center shrink-0 text-tinta-2 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30 transition-colors"
          aria-label={`Agregar un${label ? ' ' + label.toLowerCase() : ''}`}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  )
}
