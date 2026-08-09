import { ESTADO_LABELS, ESTADO_COLORS, classNames } from '../../lib/utils'

/**
 * El estado de una reserva, siempre con la misma palabra y el mismo color.
 *
 * Los mapas ya existían en `lib/utils.js`; lo que faltaba era el componente
 * único que los use, para que el mismo estado no se vea de tres formas según
 * la pantalla. Daniela aprende el código de color una vez:
 *
 *   tentativa gris · confirmada azul · en la isla celeste
 *   completada verde · no llegó coral · cancelada rojo
 *
 * **La palabra es la del negocio, no la de la base.** En la interfaz nunca
 * aparece `noshow` ni `en_isla`: aparece "No llegó" y "En la isla". Por eso el
 * respaldo cuando llega un estado desconocido es el código crudo — se ve feo a
 * propósito, para que se note que falta traducirlo en vez de esconderse.
 *
 * `tamano="grande"` es para el muelle y la isla, donde se lee de pie y de
 * lejos.
 */
export default function InsigniaEstado({ estado, tamano = 'normal', className = '' }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-[10px] font-bold whitespace-nowrap',
        tamano === 'grande' ? 'px-3.5 py-2 text-[15px]' : 'px-3 py-1.5 text-[13px]',
        ESTADO_COLORS[estado] || 'bg-linea text-tinta-2',
        className
      )}
    >
      {ESTADO_LABELS[estado] || estado}
    </span>
  )
}
