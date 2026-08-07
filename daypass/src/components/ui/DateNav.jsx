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
    <div className="flex items-center bg-white rounded-xl shadow-[0_1px_2px_rgba(22,24,44,.06),0_2px_8px_rgba(22,24,44,.05)]">
      <button
        onClick={() => move(-1)}
        className="w-11 h-11 flex items-center justify-center shrink-0 text-tinta-2 hover:bg-blue-50 hover:text-blue-700 rounded-l-xl transition-colors"
        aria-label="Día anterior"
      >
        <ChevronLeft size={20} />
      </button>
      <DatePicker value={value} onChange={onChange} bare className="w-40 sm:w-48" />
      <button
        onClick={() => move(1)}
        className="w-11 h-11 flex items-center justify-center shrink-0 text-tinta-2 hover:bg-blue-50 hover:text-blue-700 rounded-r-xl transition-colors"
        aria-label="Día siguiente"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
