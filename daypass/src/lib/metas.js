/**
 * Los periodos de una meta.
 *
 * Gemelo en JavaScript de `rango_de_meta()` de la migración 026. Vive aparte
 * de la pantalla porque es donde un error no se ve hasta que cierra el
 * trimestre: un rango mal calculado no rompe nada, solo hace que el avance
 * mienta durante tres meses.
 */

export const PERIODOS = [
  { valor: 'mes',       etiqueta: 'Mes' },
  { valor: 'trimestre', etiqueta: 'Trimestre' },
  { valor: 'anual',     etiqueta: 'Año' },
]

export const UNIDADES = [
  { valor: 'ingresos', etiqueta: 'Plata' },
  { valor: 'personas', etiqueta: 'Personas' },
]

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Cuántos números tiene cada periodo: 12 meses, 4 trimestres, el año ninguno. */
export function opcionesDeNumero(periodo) {
  if (periodo === 'mes') {
    return MESES.map((m, i) => ({ value: String(i + 1), label: m }))
  }
  if (periodo === 'trimestre') {
    return [1, 2, 3, 4].map(n => ({ value: String(n), label: `Trimestre ${n}` }))
  }
  return []
}

/** El primero y el último día, en fecha local. Nunca por UTC (regla 6). */
export function rangoDeMeta(anio, periodo, numero) {
  const dos = n => String(n).padStart(2, '0')
  const ultimoDia = (a, m) => new Date(a, m, 0).getDate()   // mes 1-based

  if (periodo === 'anual') {
    return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
  }
  if (periodo === 'mes') {
    const m = Number(numero)
    return { desde: `${anio}-${dos(m)}-01`, hasta: `${anio}-${dos(m)}-${dos(ultimoDia(anio, m))}` }
  }
  // Trimestre: del primer mes al último, inclusive.
  const primero = (Number(numero) - 1) * 3 + 1
  const ultimo = primero + 2
  return {
    desde: `${anio}-${dos(primero)}-01`,
    hasta: `${anio}-${dos(ultimo)}-${dos(ultimoDia(anio, ultimo))}`,
  }
}

export function etiquetaDePeriodo(periodo, numero, anio) {
  if (periodo === 'anual') return String(anio)
  if (periodo === 'mes') return `${MESES[Number(numero) - 1]} ${anio}`
  return `Trimestre ${numero} de ${anio}`
}

/**
 * Qué tan cerca va, de 0 a 1. Se corta en 1 para la barra —pasarse no la
 * alarga— pero el porcentaje real se muestra tal cual: superar la meta en un
 * 130% es una noticia y esconderla sería raro.
 */
export function avance(logrado, meta) {
  if (!meta || meta <= 0) return 0
  return Math.min(Number(logrado || 0) / Number(meta), 1)
}

export function porcentaje(logrado, meta) {
  if (!meta || meta <= 0) return 0
  return Math.round((Number(logrado || 0) / Number(meta)) * 100)
}
