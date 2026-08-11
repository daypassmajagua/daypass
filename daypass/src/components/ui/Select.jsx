import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
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
// `\p{Diacritic}` y no el rango U+0300–U+036F: el rango habría que escribirlo
// con caracteres que en el archivo no se ven, y lo que no se ve se pierde en
// el primer guardado con otra codificación.
function sinTildes(str) {
  return String(str).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

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
  /**
   * Buscar dentro del desplegable. Se enciende solo cuando la lista es larga:
   * lo pidieron los 249 países de la 028, donde llegar a Kiribati bajando con
   * el dedo no es elegir, es rendirse. Por debajo de trece opciones estorba
   * —un campo más entre el dedo y lo que se ve— así que no aparece.
   */
  buscable,
}) {
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const wrapRef = useRef(null)
  const listRef = useRef(null)
  const buscadorRef = useRef(null)

  // Cerrar limpia lo escrito. Va aquí y no en un efecto sobre `open` porque un
  // efecto que solo sirve para borrar un campo es un render de más.
  const close = useCallback(() => { setOpen(false); setBusqueda('') }, [])
  useClickOutside(wrapRef, close, open)

  const conBuscador = buscable ?? options.length > 12

  const selected = options.find(o => String(o.value) === String(value ?? ''))

  // Sin tildes y sin mayúsculas: nadie escribe "Türkiye" ni "Panamá" con la
  // tilde puesta cuando está buscando de afán.
  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim())
    if (!q || !conBuscador) return options
    return options.filter(o => sinTildes(String(o.label)).includes(q))
  }, [options, busqueda, conBuscador])

  function pick(v) {
    onChange(v)
    close()
  }

  // Al abrir: si hay buscador, el cursor va ahí —abrir para escribir es lo
  // normal en una lista larga—; si no, a la opción elegida.
  useEffect(() => {
    if (!open) return
    if (conBuscador) { buscadorRef.current?.focus(); return }
    if (!listRef.current) return
    const el = listRef.current.querySelector('[data-selected="true"]') || listRef.current.firstElementChild
    el?.focus()
  }, [open, conBuscador])

  function onListKeyDown(e) {
    if (e.key === 'Escape') { close(); return }
    if (!listRef.current) return
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
          onClick={() => (open ? close() : setOpen(true))}
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
            onKeyDown={onListKeyDown}
            className={classNames(
              'absolute z-50 mt-1 w-full rounded-xl bg-white shadow-[0_12px_32px_rgba(22,24,44,.18)] ring-1 ring-black/5 overflow-hidden',
              align === 'right' && 'right-0'
            )}
          >
            {conBuscador && (
              <div className="flex items-center gap-2 px-3 border-b border-linea">
                <Search size={size === 'sol' ? 20 : 15} className="shrink-0 text-tinta-3" />
                <input
                  ref={buscadorRef}
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={e => {
                    // Enter escoge lo primero que quedó: escribir "col" y darle
                    // Enter tiene que bastar.
                    if (e.key === 'Enter' && visibles.length) { e.preventDefault(); pick(visibles[0].value) }
                  }}
                  placeholder="Buscar"
                  className={classNames(
                    'w-full bg-transparent text-tinta placeholder-tinta-3 focus:outline-none',
                    size === 'sol' ? 'py-3.5 text-[18px]' : 'py-2.5 text-[15px]'
                  )}
                />
              </div>
            )}

            <div
              ref={listRef}
              role="listbox"
              className="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain py-1.5"
            >
            {visibles.length === 0 && (
              <p className="px-3.5 py-3 text-[15px] text-tinta-2">
                Nada con «{busqueda.trim()}».
              </p>
            )}
            {visibles.map(o => {
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
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
