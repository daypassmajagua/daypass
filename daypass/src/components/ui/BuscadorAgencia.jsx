import { useCallback, useMemo, useRef, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { classNames } from '../../lib/utils'
import useClickOutside from '../../hooks/useClickOutside'

/**
 * Escribir y filtrar, no un desplegable de cincuenta.
 *
 * Las agencias que más reservan aparecen de primeras: la asesora escribe dos
 * letras y ya está. Y acepta un nombre que no esté en la lista, porque
 * siempre entra una agencia nueva antes de que alguien la cree en el catálogo.
 */
export default function BuscadorAgencia({
  label = 'Agencia',
  value = '',
  onChange,
  agencias = [],
  frecuentes = [],
  placeholder = 'Escribe para buscar…',
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const wrapRef = useRef(null)

  const cerrar = useCallback(() => { setAbierto(false); setTexto('') }, [])
  useClickOutside(wrapRef, cerrar, abierto)

  const opciones = useMemo(() => {
    const busqueda = texto.trim().toLowerCase()
    const ordenadas = [...agencias].sort((a, b) => {
      const fa = frecuentes.indexOf(a.nombre)
      const fb = frecuentes.indexOf(b.nombre)
      if (fa !== fb) return (fa === -1 ? 999 : fa) - (fb === -1 ? 999 : fb)
      return a.nombre.localeCompare(b.nombre)
    })
    if (!busqueda) return ordenadas.slice(0, 8)
    return ordenadas.filter(a => a.nombre.toLowerCase().includes(busqueda)).slice(0, 8)
  }, [agencias, frecuentes, texto])

  const textoLimpio = texto.trim()
  const esNueva = textoLimpio &&
    !agencias.some(a => a.nombre.toLowerCase() === textoLimpio.toLowerCase())

  function elegir(nombre) {
    onChange(nombre)
    cerrar()
  }

  return (
    <div className="flex flex-col gap-1" ref={wrapRef}>
      <label className="text-sm font-medium text-tinta">{label}</label>

      {value && !abierto ? (
        <div className="flex items-center gap-2 rounded-xl border border-linea bg-white px-3 py-2.5 min-h-[44px]">
          <span className="flex-1 truncate text-sm font-bold text-tinta">{value}</span>
          <button
            type="button"
            onClick={() => onChange('')}
            className="icono-tactil w-8 h-8 flex items-center justify-center rounded-lg text-tinta-2 hover:bg-fondo"
            aria-label="Quitar la agencia"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-2 pointer-events-none" />
          <input
            value={texto}
            onChange={e => { setTexto(e.target.value); setAbierto(true) }}
            onFocus={() => setAbierto(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && textoLimpio) { e.preventDefault(); elegir(textoLimpio) }
              if (e.key === 'Escape') cerrar()
            }}
            placeholder={placeholder}
            className="w-full rounded-xl border border-linea bg-white pl-9 pr-3 py-2.5 min-h-[44px] text-sm focus:outline-none focus:border-blue-600"
          />

          {abierto && (
            <div className="absolute z-50 mt-1 w-full max-h-[min(50vh,18rem)] overflow-y-auto overscroll-contain rounded-xl bg-white shadow-[0_12px_32px_rgba(22,24,44,.18)] ring-1 ring-black/5 py-1.5">
              {!texto && frecuentes.length > 0 && (
                <p className="px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-wider text-tinta-2">
                  Las que más reservan
                </p>
              )}

              {opciones.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => elegir(a.nombre)}
                  className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[44px] text-left text-[15px] text-tinta hover:bg-blue-50 focus:outline-none focus:bg-blue-50"
                >
                  <span className="truncate">{a.nombre}</span>
                  {a.nombre === value && <Check size={16} className="text-blue-600 shrink-0" />}
                </button>
              ))}

              {esNueva && (
                <button
                  type="button"
                  onClick={() => elegir(textoLimpio)}
                  className={classNames(
                    'w-full px-3.5 py-2.5 min-h-[44px] text-left text-[15px] font-bold text-blue-700 hover:bg-blue-50',
                    opciones.length > 0 && 'border-t border-linea mt-1 pt-2.5'
                  )}
                >
                  Usar “{textoLimpio}”
                </button>
              )}

              {!opciones.length && !esNueva && (
                <p className="px-3.5 py-3 text-sm text-tinta-2">
                  Ninguna agencia coincide. Escribe el nombre completo para usarlo igual.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
