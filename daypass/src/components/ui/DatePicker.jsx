import { useCallback, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { classNames, hoyLocal, aFechaLocal } from '../../lib/utils'
import useClickOutside from '../../hooks/useClickOutside'

/**
 * Calendario propio de la plataforma — reemplaza a <input type="date"> para
 * que el picker respete el diseño (regla del proyecto: TODOS los dropdowns,
 * sobre todo los calendarios).
 *
 * Valor: string 'YYYY-MM-DD' (hora local Colombia, ver utils.js) o ''.
 *   <DatePicker label value onChange={str => ...} />
 */

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

function parseFecha(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDisplay(str) {
  const d = parseFecha(str)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(d)
}

const sizes = {
  sm: 'px-2 py-1 text-xs rounded-md',
  md: 'px-3 py-2 text-sm rounded-lg',
}

export default function DatePicker({
  label,
  error,
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  size = 'md',
  disabled = false,
  align = 'left',
  bare = false, // sin borde propio, para incrustar en contenedores (ej. DateNav)
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => {
    const d = value ? parseFecha(value) : new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const wrapRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])
  useClickOutside(wrapRef, close, open)

  // Al abrir, posicionar la vista en el mes del valor actual
  function toggleOpen() {
    if (!open) {
      const d = value ? parseFecha(value) : new Date()
      setView({ y: d.getFullYear(), m: d.getMonth() })
    }
    setOpen(!open)
  }

  function moveMonth(delta) {
    setView(v => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  function pick(day) {
    onChange(aFechaLocal(new Date(view.y, view.m, day)))
    setOpen(false)
  }

  const hoy = hoyLocal()
  const diasEnMes = new Date(view.y, view.m + 1, 0).getDate()
  const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7 // semana inicia lunes

  return (
    <div className={classNames('flex flex-col gap-1', className)} ref={wrapRef}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggleOpen}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
          className={classNames(
            'w-full flex items-center justify-between gap-2 text-left transition-colors',
            sizes[size],
            bare
              ? 'border-0 bg-transparent hover:bg-brand-50 focus:outline-none'
              : classNames(
                  'border bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                  error ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-brand-400'
                ),
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className={classNames('truncate capitalize', value ? 'text-gray-900' : 'text-gray-500')}>
            {value ? formatDisplay(value) : placeholder}
          </span>
          <CalendarDays size={size === 'sm' ? 14 : 16} className="shrink-0 text-gray-400" />
        </button>

        {open && (
          <div
            role="dialog"
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
            className={classNames(
              'absolute z-50 mt-1 w-72 rounded-xl border border-brand-100 bg-white shadow-lg shadow-brand-900/10 p-3',
              align === 'right' && 'right-0'
            )}
          >
            {/* Encabezado: mes + navegación */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-brand-50 hover:text-brand-900 transition-colors"
                aria-label="Mes anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-brand-900">
                {MESES[view.m]} {view.y}
              </span>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-brand-50 hover:text-brand-900 transition-colors"
                aria-label="Mes siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 mb-1">
              {DIAS.map(d => (
                <span key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase py-1">
                  {d}
                </span>
              ))}
            </div>

            {/* Grilla de días */}
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: offset }).map((_, i) => <span key={`b${i}`} />)}
              {Array.from({ length: diasEnMes }).map((_, i) => {
                const day = i + 1
                const fecha = aFechaLocal(new Date(view.y, view.m, day))
                const isSel = fecha === value
                const isHoy = fecha === hoy
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pick(day)}
                    className={classNames(
                      'h-9 w-full rounded-lg text-sm transition-colors',
                      isSel
                        ? 'bg-brand-900 text-white font-semibold'
                        : isHoy
                          ? 'ring-1 ring-inset ring-brand-400 text-brand-900 font-semibold hover:bg-brand-50'
                          : 'text-gray-700 hover:bg-brand-50'
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Pie: atajo a hoy */}
            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-center">
              <button
                type="button"
                onClick={() => { onChange(hoy); setOpen(false) }}
                className="px-3 py-1 text-xs font-medium text-brand-700 rounded-lg hover:bg-brand-50 transition-colors"
              >
                Hoy · {formatDisplay(hoy)}
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
