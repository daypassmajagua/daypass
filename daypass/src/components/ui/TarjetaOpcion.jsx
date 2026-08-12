import { Check } from 'lucide-react'
import { classNames } from '../../lib/utils'

/**
 * Elegir una cosa entre pocas, viéndolas todas.
 *
 * Es el gesto que reemplazó a los desplegables donde elegir a ciegas costaba
 * caro: el plan (que es elegir precio), la lancha (que es elegir cupo), el modo
 * del aparato, y los interruptores de las fichas. Cuatro implementaciones del
 * mismo botón con cuatro anillos, tres alturas y dos formas de marcar cuál está
 * elegida.
 *
 * **Lo elegido se rellena, no se contornea.** Un anillo más grueso obliga a
 * comparar bordes entre tarjetas; el relleno se ve de reojo. Y lleva el ✓
 * porque en el muelle, a pleno sol, el color solo no alcanza — y porque quien
 * no distingue el azul necesita la marca.
 *
 * `secundario` es el dato que hace innecesario abrir la opción para saber si es
 * la correcta: el precio del plan, el cupo de la lancha, cuántas reservas usa
 * un plato. La consecuencia visible, no el nombre otra vez.
 */
export default function TarjetaOpcion({
  titulo,
  detalle,
  secundario,
  elegida = false,
  onClick,
  error = false,
  tamano = 'md',   // md (oficina) · sol (muelle e isla)
  className = '',
  ...props
}) {
  const sol = tamano === 'sol'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={elegida}
      className={classNames(
        'flex items-center justify-between gap-3 rounded-xl text-left transition-colors w-full',
        sol ? 'px-5 min-h-[4rem] text-[1.0625rem]' : 'px-4 py-3 min-h-[4rem]',
        elegida
          ? 'bg-blue-600 text-white'
          : classNames(
              'bg-white ring-1 hover:ring-blue-300',
              error ? 'ring-coral-300' : 'ring-linea'
            ),
        className
      )}
      {...props}
    >
      <span className="min-w-0">
        <span className={classNames(
          'block font-bold truncate',
          sol ? 'text-[1.0625rem]' : 'text-[15px]',
          elegida ? 'text-white' : 'text-tinta'
        )}>
          {titulo}
        </span>
        {detalle && (
          <span className={classNames(
            'block text-[13px]',
            elegida ? 'text-white/75' : 'text-tinta-2'
          )}>
            {detalle}
          </span>
        )}
      </span>

      <span className="shrink-0 flex items-center gap-2">
        {secundario && (
          <span className={classNames(
            'font-bold tabular text-right',
            sol ? 'text-[1.0625rem]' : 'text-[15px]',
            elegida ? 'text-white' : 'text-tinta'
          )}>
            {secundario}
          </span>
        )}
        {elegida && <Check size={18} aria-hidden="true" />}
      </span>
    </button>
  )
}
