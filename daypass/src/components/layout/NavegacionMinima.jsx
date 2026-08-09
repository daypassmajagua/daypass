import { Link, useLocation } from 'react-router-dom'
import { usePerfil } from '../../hooks/usePerfil'
import { menuDe } from '../../lib/navegacion'
import { classNames } from '../../lib/utils'

/**
 * La navegación de la isla: la mínima que deja moverse.
 *
 * El muelle no lleva ninguna —una pantalla, un trabajo— pero la isla sí puede
 * tener dos o tres, y sin esto quien entra queda encerrado: `admin_isla` abre
 * en `/isla` y no tiene forma de llegar a Almuerzos.
 *
 * **Solo aparece si hay a dónde ir.** Al mesero, que tiene una sola pantalla,
 * no se le muestra nada: una barra con un único botón que ya estás usando es
 * ruido.
 *
 * Objetivos de 44 px y alto contraste, como el resto de la isla: esto se toca
 * de pie y con una mano.
 */
export default function NavegacionMinima({ className = '' }) {
  const { rol } = usePerfil()
  const { pathname } = useLocation()
  const secciones = menuDe(rol)

  if (secciones.length < 2) return null

  return (
    <nav className={classNames('flex items-center gap-1.5 flex-wrap', className)}>
      {secciones.map(({ a, etiqueta }) => (
        <Link
          key={a}
          to={a}
          aria-current={pathname === a ? 'page' : undefined}
          className={classNames(
            'inline-flex items-center rounded-xl px-4 min-h-[44px] text-[15px] font-bold transition-colors',
            pathname === a
              ? 'bg-sol-tinta text-white'
              : 'bg-white text-sol-tinta-2 ring-2 ring-sol-linea'
          )}
        >
          {etiqueta}
        </Link>
      ))}
    </nav>
  )
}
