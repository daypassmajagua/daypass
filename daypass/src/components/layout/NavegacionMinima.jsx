import { Link, useLocation } from 'react-router-dom'
import { usePerfil } from '../../hooks/usePerfil'
import { puedeVer, RUTAS } from '../../lib/navegacion'
import { classNames } from '../../lib/utils'

/**
 * La navegación de la isla: la mínima que deja moverse.
 *
 * El muelle no lleva ninguna —una pantalla, un trabajo— pero la isla sí puede
 * tener dos o tres, y sin esto quien entra queda encerrado.
 *
 * ── Por qué tiene su propia lista y no la del menú de arriba ────────────────
 *
 * Antes derivaba de `menuDe()`, y cuando Almuerzos salió del menú —ahora vive
 * *dentro* de Isla, que es su sitio— la isla se habría quedado sin forma de
 * llegar. Aquí se nombran los destinos de la isla directamente y se filtran
 * por lo que el rol puede abrir: la reorganización del menú de oficina no
 * puede dejar encerrada a la persona que está entre las mesas.
 *
 * **Solo aparece si hay a dónde ir.** Al mesero, que tiene una sola pantalla,
 * no se le muestra nada: una barra con un único botón que ya estás usando es
 * ruido.
 *
 * Objetivos de 44 px y alto contraste, como el resto de la isla: esto se toca
 * de pie y con una mano.
 */

/** Los destinos de la isla, en el orden en que se usan. */
// `/embarque` al final: para la isla es el regreso de las 3:30, no algo de
// todo el día. Quien no lo pueda abrir no lo ve, que es lo que hace el filtro.
const DESTINOS = ['/isla', '/cocina', '/', '/embarque']

export default function NavegacionMinima({ className = '' }) {
  const { rol } = usePerfil()
  const { pathname } = useLocation()

  const secciones = DESTINOS
    .filter(r => puedeVer(rol, r))
    .map(r => ({ a: r, etiqueta: RUTAS[r]?.etiqueta || r }))

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
