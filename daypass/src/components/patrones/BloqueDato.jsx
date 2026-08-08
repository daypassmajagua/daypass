import { classNames } from '../../lib/utils'

/**
 * Un número grande con su etiqueta y, si la hay, su comparación.
 *
 * Es la unidad de Informes, del panorama de la directora y del conteo de
 * cocina. Tres reglas que no se negocian:
 *
 *  1. **Números tabulares siempre.** Pax, precios y contadores son el
 *     contenido principal de esta app; sin `tabular-nums` las columnas bailan
 *     y comparar de un vistazo deja de funcionar.
 *
 *  2. **La comparación dice su signo con palabras, no solo con color.** "+12
 *     que la semana pasada" se entiende en blanco y negro y con daltonismo;
 *     una flecha verde sola, no.
 *
 *  3. **Verde y coral no significan "bueno" y "malo" aquí.** En este sistema
 *     coral es pendiente y verde es cerrado. Una variación se pinta con
 *     `tinta`, y solo se le pone color cuando de verdad hay algo que hacer.
 */
export default function BloqueDato({
  etiqueta,
  valor,
  unidad,
  detalle,
  comparacion,        // { texto: 'que la semana pasada', delta: 12 }
  tono = 'normal',    // normal · pendiente · cerrado
  tamano = 'md',      // md · lg (lg para las pantallas que se leen de lejos)
  className = '',
}) {
  const colorValor = {
    normal: 'text-tinta',
    pendiente: 'text-coral-700',
    cerrado: 'text-verde-600',
  }[tono] || 'text-tinta'

  const delta = comparacion?.delta

  return (
    <div className={classNames('flex flex-col gap-0.5', className)}>
      <span className="text-[13px] font-bold uppercase tracking-wide text-tinta-2">
        {etiqueta}
      </span>

      <span className="flex items-baseline gap-1.5">
        <span className={classNames(
          'tabular font-bold leading-none',
          tamano === 'lg' ? 'text-[40px]' : 'text-[28px]',
          colorValor
        )}>
          {valor}
        </span>
        {unidad && <span className="text-[15px] text-tinta-2">{unidad}</span>}
      </span>

      {comparacion && typeof delta === 'number' && (
        <span className="text-[13px] text-tinta-2 tabular">
          {/* El signo va en el texto y no solo en el color. */}
          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : 'igual'}
          {' '}{comparacion.texto}
        </span>
      )}

      {detalle && <span className="text-[13px] text-tinta-2">{detalle}</span>}
    </div>
  )
}
