import { useEffect, useRef, useState, useCallback } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { classNames } from '../../lib/utils'
import useClickOutside from '../../hooks/useClickOutside'

/**
 * Select propio de la plataforma — reemplaza a <select> nativo para que el
 * dropdown respete el diseño (regla del proyecto: TODOS los dropdowns).
 *
 * API controlada:
 *   <Select label value onChange={v => ...} options={[{ value, label }]} />
 *
 * `onChange` recibe el VALOR directamente (no un evento).
 * Para react-hook-form, envolver en <Controller> y pasar field.value/field.onChange.
 */
const sizes = {
  sm: 'px-2 py-1 text-xs rounded-md',
  md: 'px-3 py-2 text-sm rounded-lg',
}

export default function Select({
  label,
  error,
  value,
  onChange,
  options = [],
  placeholder = '— Seleccionar —',
  size = 'md',
  disabled = false,
  align = 'left',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const listRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])
  useClickOutside(wrapRef, close, open)

  const selected = options.find(o => String(o.value) === String(value ?? ''))

  function pick(v) {
    onChange(v)
    setOpen(false)
  }

  // Al abrir, enfocar la opción seleccionada (o la primera)
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector('[data-selected="true"]') || listRef.current.firstElementChild
    el?.focus()
  }, [open])

  function onListKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const items = [...listRef.current.querySelectorAll('button')]
      const i = items.indexOf(document.activeElement)
      const next = e.key === 'ArrowDown' ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, 0)
      items[next]?.focus()
    }
  }

  return (
    <div className={classNames('flex flex-col gap-1', className)} ref={wrapRef}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          className={classNames(
            'w-full flex items-center justify-between gap-2 border bg-white text-left transition-colors',
            sizes[size],
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            error ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-brand-400',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className={classNames('truncate', selected && selected.label && String(selected.value) !== '' ? 'text-gray-900' : 'text-gray-500')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={size === 'sm' ? 14 : 16}
            className={classNames('shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div
            ref={listRef}
            role="listbox"
            onKeyDown={onListKeyDown}
            className={classNames(
              'absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-brand-100 bg-white shadow-lg shadow-brand-900/10 py-1',
              align === 'right' && 'right-0'
            )}
          >
            {options.map(o => {
              const isSel = String(o.value) === String(value ?? '')
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  data-selected={isSel}
                  onClick={() => pick(o.value)}
                  className={classNames(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
                    size === 'sm' ? 'text-xs' : 'text-sm',
                    isSel ? 'bg-brand-50 text-brand-900 font-medium' : 'text-gray-700 hover:bg-gray-50',
                    'focus:outline-none focus:bg-brand-50'
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check size={14} className="shrink-0 text-brand-700" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
