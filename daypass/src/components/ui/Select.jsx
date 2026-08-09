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
// En iPad todo control se toca con el dedo: mínimo 44px de alto.
//
// `sol` es el muelle y la isla: de pie, una mano, a pleno sol. 60px y texto
// grande. Existe aquí y no como un control aparte a propósito — el muelle
// tenía dos `<select>` nativos porque el de la oficina le quedaba chico, y esa
// es exactamente la excusa con la que un sistema de diseño se empieza a
// deshacer. Es la misma pieza en otro tamaño, no otra pieza.
const sizes = {
  sm:  'px-2.5 py-1.5 text-xs rounded-lg min-h-[36px] [@media(pointer:coarse)]:min-h-[44px]',
  md:  'px-3 py-2.5 text-sm rounded-xl min-h-[44px]',
  sol: 'px-4 text-[18px] rounded-xl min-h-[60px]',
}

export default function Select({
  label,
  // En filas tipo tabla la etiqueta se muestra en iPad (donde la fila se
  // apila) y se oculta desde 1280px, donde manda el encabezado de columna.
  labelOculta = false,
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
      {label && (
        <label
          className={classNames(
            labelOculta
              ? 'xl:hidden text-[12px] font-bold uppercase tracking-wider text-tinta-2'
              : 'text-sm font-medium text-tinta'
          )}
        >
          {label}
        </label>
      )}
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
            'w-full flex items-center justify-between gap-2 bg-white text-left transition-colors',
            sizes[size],
            // Afuera el borde es de 2px: a pleno sol un borde fino desaparece.
            size === 'sol' ? 'border-2' : 'border',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            error
              ? 'border-peligro-500 bg-peligro-50'
              : size === 'sol' ? 'border-sol-linea' : 'border-linea hover:border-brand-400',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className={classNames(
            'truncate',
            selected && selected.label && String(selected.value) !== ''
              ? (size === 'sol' ? 'text-sol-tinta' : 'text-tinta')
              : (size === 'sol' ? 'text-sol-tinta-3' : 'text-tinta-2')
          )}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={size === 'sm' ? 14 : size === 'sol' ? 22 : 16}
            className={classNames('shrink-0 text-tinta-3 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div
            ref={listRef}
            role="listbox"
            onKeyDown={onListKeyDown}
            className={classNames(
              'absolute z-50 mt-1 w-full max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain rounded-xl bg-white shadow-[0_12px_32px_rgba(22,24,44,.18)] ring-1 ring-black/5 py-1.5',
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
                    'w-full flex items-center justify-between gap-2 px-3.5 text-left transition-colors',
                    // Afuera la fila es de 60px, como todo lo que se toca de pie.
                    size === 'sol' ? 'py-3 min-h-[60px] text-[18px]' : 'py-2.5 min-h-[44px]',
                    size === 'sm' ? 'text-[13px]' : size === 'sol' ? '' : 'text-[15px]',
                    isSel ? 'bg-blue-50 text-blue-700 font-bold' : 'text-tinta hover:bg-blue-50/60',
                    'focus:outline-none focus:bg-blue-50'
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check size={16} className="shrink-0 text-blue-600" />}
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
