import { ChevronLeft, ChevronRight } from 'lucide-react'
import DatePicker from './DatePicker'
import { aFechaLocal } from '../../lib/utils'

/**
 * Navegador de fecha compartido: ‹ [calendario propio] ›
 * Usado en los encabezados de Dashboard, Listado del Día, Tentativo y Folios.
 */
export default function DateNav({ value, onChange }) {
  function move(delta) {
    const [y, m, d] = value.split('-').map(Number)
    onChange(aFechaLocal(new Date(y, m - 1, d + delta)))
  }

  return (
    <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
      <button
        onClick={() => move(-1)}
        className="p-2 text-gray-500 hover:bg-brand-50 hover:text-brand-900 rounded-l-lg transition-colors"
        aria-label="Día anterior"
      >
        <ChevronLeft size={16} />
      </button>
      <DatePicker value={value} onChange={onChange} bare className="w-44" />
      <button
        onClick={() => move(1)}
        className="p-2 text-gray-500 hover:bg-brand-50 hover:text-brand-900 rounded-r-lg transition-colors"
        aria-label="Día siguiente"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
