/**
 * Cuánto se le cobra a una reserva, y desde cuándo se debe.
 *
 * Gemelo en JavaScript de `valor_a_cobrar()` de la migración 023. Existe
 * porque el muelle y la oficina calculan sin red, y porque un cálculo de plata
 * escrito dos veces en dos sitios se separa: aquí está una sola vez, con sus
 * comprobaciones, y el servidor tiene la suya.
 *
 * **Lo que se cobra NO es la tarifa.** `total_calculado` es una columna
 * generada que multiplica adultos y niños por su precio, y hay tres casos en
 * que eso no es lo que se cobra:
 *
 *   · cortesía, alojamiento y empleado no generan ingreso (regla 11)
 *   · al proveedor se le cobra el cupo, si es que se le cobra
 *   · lo cancelado y lo que no llegó no se cobra
 */

/** Los tramos que usa el hotel para mirar la cartera. */
export const TRAMOS = [
  { clave: 'al_dia',     etiqueta: 'Al día',       hasta: 30 },
  { clave: 'de_31_a_60', etiqueta: '31 a 60 días', hasta: 60 },
  { clave: 'de_61_a_90', etiqueta: '61 a 90 días', hasta: 90 },
  { clave: 'mas_de_90',  etiqueta: 'Más de 90',    hasta: Infinity },
]

export function tramoDe(dias) {
  return TRAMOS.find(t => dias <= t.hasta).clave
}

/**
 * @param registro     fila de `reservas` (o `registros`)
 * @param tipoIngreso  su fila de `tipos_ingreso`, si se conoce
 */
export function valorACobrar(registro, tipoIngreso) {
  if (!registro) return 0
  if (['cancelada', 'noshow'].includes(registro.estado)) return 0

  // Ante un tipo sin definir se asume que cobra: dejar de cobrarle a alguien
  // por una bandera en null se descubre tarde y mal.
  const genera = tipoIngreso?.genera_ingreso ?? true
  if (genera === false) return 0

  if (tipoIngreso?.codigo === 'proveedor') {
    return registro.cobra_cupo ? Number(registro.valor_cupo || 0) : 0
  }

  return Number(registro.total_calculado || 0)
}

/** Lo que ya entró: todo pago que no esté anulado. */
export function pagadoDe(pagos = []) {
  return pagos
    .filter(p => p.estado !== 'anulado')
    .reduce((s, p) => s + Number(p.valor || 0), 0)
}

export function saldoDe(registro, tipoIngreso, pagos) {
  return valorACobrar(registro, tipoIngreso) - pagadoDe(pagos)
}

/**
 * Días de deuda, contados **desde el día del pasadía** y no desde que se creó
 * la reserva: una reserva de diciembre vendida en agosto no lleva cuatro meses
 * de mora.
 */
export function diasDeDeuda(fechaPasadia, hoy) {
  if (!fechaPasadia || !hoy) return 0
  const a = new Date(`${fechaPasadia}T12:00:00`)
  const b = new Date(`${hoy}T12:00:00`)
  return Math.max(Math.round((b - a) / 86_400_000), 0)
}
