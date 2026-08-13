/**
 * Lo que esta agencia suele pedir.
 *
 * El grueso de las reservas son de agencia, y cada agencia repite casi siempre
 * lo mismo: Aviatur vende Rack Silver por el canal de agencias y paga a
 * crédito; Hotelbeds manda grupos. Volver a elegir eso cuarenta veces al mes es
 * trabajo que el sistema puede hacer — regla 23: lo que se puede deducir, se
 * deduce, y queda visible y editable con una línea que diga de dónde salió.
 *
 * ── Por qué el historial y no un campo de la agencia ────────────────────────
 *
 * Se podría guardar «canal por defecto» en la ficha de la organización. No se
 * hace, por dos razones: sería un dato más que alguien tiene que mantener al
 * día —y que envejece en silencio cuando la agencia cambia de forma de
 * trabajar—, y el historial ya sabe la respuesta sin que nadie la escriba. Lo
 * que la agencia hizo las últimas diez veces es mejor fuente que lo que
 * alguien anotó una vez.
 *
 * ── Cuándo se propone y cuándo no ───────────────────────────────────────────
 *
 * Solo cuando hay **mayoría clara**: al menos dos reservas y más de la mitad
 * coincidiendo. Una agencia que alterna entre dos planes no tiene «plan
 * usual», y proponer uno sería adivinar — que es peor que no proponer, porque
 * lo adivinado se guarda igual si nadie lo mira.
 *
 * Nunca pisa lo que la asesora ya escribió: quien decide es ella.
 */

/** Cuántas reservas pasadas se miran. Diez cubre un mes de una agencia activa. */
export const RESERVAS_QUE_SE_MIRAN = 10

/** Mínimo de reservas para que un patrón cuente como patrón. */
const MINIMO = 2

/**
 * El valor que más se repite, si de verdad domina.
 * Devuelve null cuando no hay mayoría: empatar no es tener costumbre.
 */
function loUsual(valores) {
  const limpios = valores.filter(v => v !== null && v !== undefined && v !== '')
  if (limpios.length < MINIMO) return null

  const conteo = new Map()
  for (const v of limpios) conteo.set(v, (conteo.get(v) || 0) + 1)

  let ganador = null
  let mayor = 0
  for (const [valor, veces] of conteo) {
    if (veces > mayor) { ganador = valor; mayor = veces }
  }

  // Más de la mitad de las que traían el dato. Con 3 de 5 sí; con 2 de 5 no.
  return mayor * 2 > limpios.length ? ganador : null
}

/**
 * Qué proponer al elegir esta agencia.
 *
 * @param {Array} reservas Las últimas de esa agencia, más recientes primero.
 * @returns {{ campos: Object, veces: number }} `campos` trae solo lo que tiene
 *   costumbre clara; si está vacío, no hay nada que proponer y la pantalla no
 *   dice nada — un aviso que no propone nada es ruido.
 */
export function loQueSuelePedir(reservas = []) {
  const ultimas = reservas.slice(0, RESERVAS_QUE_SE_MIRAN)
  if (ultimas.length < MINIMO) return { campos: {}, veces: ultimas.length }

  const campos = {}
  const canal = loUsual(ultimas.map(r => r.canal_id))
  const plan = loUsual(ultimas.map(r => r.plan_id))
  const pago = loUsual(ultimas.map(r => r.forma_pago))
  const tipo = loUsual(ultimas.map(r => r.tipo))
  const impuestos = loUsual(ultimas.map(r => r.impuestos_puerto))

  if (canal) campos.canal_id = canal
  if (plan) campos.plan_id = plan
  if (pago) campos.forma_pago = pago
  if (tipo) campos.tipo = tipo
  if (impuestos) campos.impuestos_puerto = impuestos

  return { campos, veces: ultimas.length }
}

/**
 * La frase que dice de dónde salió, en el lenguaje de la operación.
 *
 * Es la mitad de la regla 23 que se suele olvidar: deducir sin decirlo
 * convierte la ayuda en un misterio, y el primer día que la deducción se
 * equivoque nadie va a saber por qué el formulario trajo eso.
 */
export function porqueSePropone(nombreAgencia, campos, nombres = {}) {
  const partes = []
  if (campos.plan_id) partes.push(nombres.plan || 'el plan')
  if (campos.canal_id) partes.push(nombres.canal || 'el canal')
  if (campos.forma_pago) partes.push(nombres.formaPago || 'la forma de pago')
  if (campos.tipo === 'grupo') partes.push('grupo')
  if (!partes.length) return null

  const lista = partes.length === 1
    ? partes[0]
    : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`

  return `Es lo que ${nombreAgencia} suele pedir: ${lista}.`
}
