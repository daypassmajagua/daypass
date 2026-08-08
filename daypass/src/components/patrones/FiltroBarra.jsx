import { X } from 'lucide-react'
import { classNames } from '../../lib/utils'

/**
 * Los filtros, como fichas que se tocan.
 *
 * Informes tiene ocho filtros y hoy son ocho `<select>` en fila, que es lo que
 * hace que esa pantalla parezca un panel de administración y no una
 * herramienta. Con fichas se ve **qué está filtrado ahora mismo** sin abrir
 * nada: el estado del filtro es el estado de la pantalla, y esconderlo dentro
 * de un desplegable obliga a recordarlo.
 *
 * Dos decisiones que vienen de la operación:
 *
 *  · **Lo activo se puede quitar desde la ficha**, con su × propia. Quitar un
 *    filtro no debería obligar a abrir el menú y buscar la opción "Todos".
 *  · **"Limpiar" solo aparece si hay algo que limpiar.** Un botón permanente
 *    que casi nunca hace nada es ruido.
 *
 * Objetivos de 44 px: esto también se usa en iPad.
 */

function Ficha({ activa, onClick, onQuitar, children }) {
  return (
    <span className={classNames(
      'inline-flex items-center rounded-xl text-sm font-bold transition-colors',
      activa ? 'bg-blue-600 text-white' : 'bg-white text-tinta-2 ring-1 ring-linea hover:bg-blue-50'
    )}>
      <button
        onClick={onClick}
        className={classNames(
          'px-4 min-h-[44px] rounded-xl',
          activa && onQuitar && 'pr-2'
        )}
      >
        {children}
      </button>
      {activa && onQuitar && (
        <button
          onClick={onQuitar}
          aria-label={`Quitar el filtro ${children}`}
          className="pr-3 pl-1 min-h-[44px] flex items-center"
        >
          <X size={16} />
        </button>
      )}
    </span>
  )
}

export default function FiltroBarra({ grupos, onLimpiar, className = '' }) {
  // Solo se ofrece limpiar si hay algo puesto.
  const hayFiltro = grupos.some(g => g.valor)

  return (
    <div className={classNames('flex flex-wrap items-center gap-2', className)}>
      {grupos.map(grupo => (
        <span key={grupo.id} className="inline-flex flex-wrap items-center gap-1.5">
          {grupo.etiqueta && (
            <span className="text-[13px] font-bold uppercase tracking-wide text-tinta-2 mr-0.5">
              {grupo.etiqueta}
            </span>
          )}
          {grupo.opciones.map(op => {
            const activa = grupo.valor === op.valor
            return (
              <Ficha
                key={op.valor}
                activa={activa}
                onClick={() => grupo.onCambiar(activa ? '' : op.valor)}
                onQuitar={activa ? () => grupo.onCambiar('') : undefined}
              >
                {op.etiqueta}
              </Ficha>
            )
          })}
        </span>
      ))}

      {hayFiltro && onLimpiar && (
        <button
          onClick={onLimpiar}
          className="text-sm font-bold text-blue-700 underline min-h-[44px] px-2"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
