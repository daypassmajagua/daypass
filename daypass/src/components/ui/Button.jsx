import { classNames } from '../../lib/utils'

/**
 * Cuatro pesos, y ni uno más.
 *
 * Había seis y solo cinco se usaban: `pendiente` (coral) **nunca**, y `success`
 * (verde) una sola vez, en «Marcar completados» de Folios. Las dos se
 * retiraron, y la razón es la misma para ambas:
 *
 * **El color del botón dice su peso, no su estado.** Verde en este sistema
 * quiere decir «cerrado y guardado» y coral «pendiente o tardío» — son estados
 * de una reserva, de un día, de un folio. Un botón no es ninguna de esas cosas:
 * es lo que uno toca para llegar a ellas. Un botón verde promete que la acción
 * ya está hecha antes de hacerla, y ese verde se lo roba a la insignia de al
 * lado, que sí lo necesita.
 *
 * Con cuatro, mirar un botón y saber su peso no cuesta pensar: relleno azul =
 * la acción de esta pantalla · azul claro = alternativa real · sin fondo = de
 * paso · rojo = no se deshace.
 */
const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-[0_2px_8px_rgba(74,90,232,.28)]',
  secondary: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  ghost: 'text-tinta-2 hover:bg-blue-50 hover:text-blue-700',
  danger: 'bg-peligro-500 text-white hover:bg-peligro-600',
}

const sizes = {
  sm: 'px-3.5 py-2 text-sm rounded-[10px]',
  md: 'px-5 py-2.5 text-[15px] rounded-xl min-h-[44px]',
  lg: 'px-6 py-3 text-base rounded-xl min-h-[52px]',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  // Un botón que navega debe ser un <a>, no un <button> con onClick: así el
  // teclado, el clic con rueda y "abrir en otra pestaña" funcionan solos.
  // Se le pasa `as={Link}` y sus props.
  as: Como = 'button',
  ...props
}) {
  const esBoton = Como === 'button'

  return (
    <Como
      className={classNames(
        'inline-flex items-center justify-center gap-2 font-bold tracking-[-.005em] transition-[background-color,transform] active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className
      )}
      // `disabled` solo existe en <button>. En un enlace se marca con aria
      // para que el lector de pantalla lo diga, ya que no se puede apagar.
      {...(esBoton
        ? { disabled: disabled || loading }
        : { 'aria-disabled': disabled || loading || undefined })}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </Como>
  )
}
