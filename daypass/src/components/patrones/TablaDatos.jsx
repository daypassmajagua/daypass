import { classNames } from '../../lib/utils'

/**
 * Una tabla de oficina: encabezado, filas y su marco.
 *
 * La misma cadena de clases —`text-xs font-semibold text-gray-500 uppercase`—
 * estaba escrita **veintitrés veces** entre Reservas, Historial e Informes, más
 * una cuarta variante en Cartera que ya se había separado. Nadie decidió que
 * fueran distintas: se copió, y a la cuarta copia ya no coincidían ni el fondo
 * del encabezado ni el color de las líneas.
 *
 * ── Por qué el encabezado va apagado ────────────────────────────────────────
 *
 * Un encabezado de tabla es una **etiqueta**, no un dato: dice cómo leer la
 * columna y después se sale del camino. Lo que se lee son los nombres y los
 * números de abajo. De ahí el tamaño chico, las versalitas y el `tinta-2` — y
 * de ahí que el dato vaya en `tinta`, que es el único que pesa.
 *
 * ── El pasajero manda sobre la columna ──────────────────────────────────────
 *
 * `alinear` existe para una sola cosa que importa de verdad: los números van a
 * la derecha y con `tabular`, para que las cifras se puedan comparar de un
 * vistazo en columna. Un total alineado a la izquierda obliga a leerlo cifra
 * por cifra.
 */
export default function TablaDatos({ columnas, children, className = '' }) {
  return (
    <div className={classNames('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead className="bg-fondo border-b border-linea">
          <tr>
            {columnas.map(c => (
              <th
                key={c.id}
                scope="col"
                className={classNames(
                  'px-3 py-3 text-[12px] font-bold uppercase tracking-wider text-tinta-2 whitespace-nowrap',
                  c.alinear === 'centro' ? 'text-center'
                    : c.alinear === 'derecha' ? 'text-right'
                    : 'text-left',
                  c.ancho
                )}
              >
                {/* Una columna de acciones no lleva título visible, pero sí
                    tiene que decir qué es para quien no ve la tabla. */}
                {c.etiqueta || <span className="sr-only">{c.oculta || 'Acciones'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">{children}</tbody>
      </table>
    </div>
  )
}

/** Una fila. Existe para que el hover no se escriba en cada pantalla. */
export function Fila({ children, className = '', ...props }) {
  return (
    <tr className={classNames('hover:bg-fondo transition-colors', className)} {...props}>
      {children}
    </tr>
  )
}
