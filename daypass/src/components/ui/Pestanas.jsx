import { classNames } from '../../lib/utils'

/**
 * Elegir entre dos o tres vistas de lo mismo.
 *
 * Estaba escrito tres veces con tres aspectos: las píldoras de Equipo (44 px,
 * fondo blanco), las de Config (40 px, fondo `brand-50`) y el segmented gris de
 * Informes. Las tres hacen lo mismo —cambiar qué se mira, sin cambiar de
 * pantalla— y las tres se veían distinto, así que había que aprenderlas por
 * separado.
 *
 * **No es un filtro.** Un filtro se limpia y se combina; esto elige una vista y
 * siempre hay una elegida. Por eso no usa `FiltroBarra`: forzar ahí un patrón
 * que promete un botón de «limpiar» sería prometer algo que no existe.
 *
 * **Una pestaña sola no es una elección** y no se dibuja: cuando el catálogo de
 * una sección tiene un solo tipo, la barra desaparece en vez de mostrar un
 * control que no hace nada.
 *
 * `conteo` es opcional y va donde de verdad ayuda: saber que hay 3 pilotos y 12
 * empleados antes de tocar la pestaña ahorra el viaje.
 */
export default function Pestanas({
  opciones,      // [{ id, etiqueta, conteo? }]
  valor,
  onCambiar,
  className = '',
}) {
  if (!opciones || opciones.length < 2) return null

  return (
    <div
      role="tablist"
      className={classNames(
        'flex gap-1 bg-brand-50 rounded-xl p-1 w-fit max-w-full overflow-x-auto',
        className
      )}
    >
      {opciones.map(o => {
        const activa = o.id === valor
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onCambiar(o.id)}
            className={classNames(
              'px-4 min-h-[2.75rem] text-sm font-bold rounded-lg transition-colors whitespace-nowrap',
              'inline-flex items-center gap-2',
              activa
                ? 'bg-white text-tinta shadow-[0_1px_2px_rgba(22,24,44,.08)]'
                : 'text-tinta-2 hover:text-tinta'
            )}
          >
            {o.etiqueta}
            {o.conteo != null && (
              <span className={classNames(
                'tabular text-[13px] font-bold',
                activa ? 'text-tinta-2' : 'text-tinta-3'
              )}>
                {o.conteo}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
