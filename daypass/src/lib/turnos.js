import { hoyLocal, aFechaLocal } from './utils'

/**
 * Los turnos: quién cubre qué cada día.
 *
 * ── Por qué esto es lo primero del CMS que faltaba ──────────────────────────
 *
 * Al muelle no va siempre Daniela. Puede ir cualquier asesora comercial o la
 * coordinadora de alojamiento, y puede ser una quien embarca en la mañana y
 * otra quien recibe en la tarde. La tabla `guardias` y sus permisos existen
 * desde la 015 y **no había pantalla**: los turnos se acordaban por WhatsApp.
 *
 * Y sin turnos no hay Fase 6, porque **las notificaciones se enrutan al turno,
 * no a la persona**. Mandarle el manifiesto a Daniela el día que Daniela no
 * está es exactamente el retrabajo que este producto viene a quitar.
 *
 * ── La regla que hace que el calendario sirva ───────────────────────────────
 *
 * *«Si un día tiene gente confirmada y nadie en el turno, aparece como
 * pendiente.»* Un calendario que solo muestra lo asignado obliga a revisar
 * treinta días a ojo; uno que marca los huecos que importan se lee en dos
 * segundos. Un martes sin turno y sin reservas no es un hueco: es un martes
 * que no opera.
 */

export const TIPOS = [
  {
    codigo: 'isla',
    etiqueta: 'Isla',
    porque: 'Quien está en la isla ese día y responde por lo que pase allá.',
    // La asigna la dirección (política `guardias_escritura` de la 015).
    soloDireccion: true,
  },
  {
    codigo: 'embarque',
    etiqueta: 'Embarque',
    porque: 'Quien está en La Bodeguita a las 8:30 y sube a la gente.',
    soloDireccion: false,
  },
  {
    codigo: 'recibimiento',
    etiqueta: 'Recibimiento',
    porque: 'Quien recibe la lancha de vuelta a las 3:30 y cierra el día.',
    soloDireccion: false,
  },
]

/** Los tres códigos, para recorrer sin repetir la lista. */
export const CODIGOS = TIPOS.map(t => t.codigo)

/** Quién puede asignar este turno. La misma regla que la RLS, dicha aquí. */
export function puedeAsignar(rol, tipo) {
  const dirige = ['super_admin', 'gerencia', 'directora'].includes(rol)
  if (dirige) return true
  const t = TIPOS.find(x => x.codigo === tipo)
  if (!t || t.soloDireccion) return false
  return ['asesora', 'asesora_comercial'].includes(rol)
}

// ─── El mes ───────────────────────────────────────────────────────────────────

/** `'2026-08'` → los días de ese mes, como fechas locales. */
export function diasDelMes(mes) {
  const [a, m] = mes.split('-').map(Number)
  const cuantos = new Date(a, m, 0).getDate()
  return Array.from({ length: cuantos }, (_, i) => aFechaLocal(new Date(a, m - 1, i + 1)))
}

/**
 * Cuántos huecos hay que rellenar antes de la primera casilla.
 *
 * La semana arranca en lunes, no en domingo: es como se lee un calendario en
 * Colombia y como se habla de la operación —«el lunes zarpamos dos lanchas»—.
 */
export function huecosAntes(mes) {
  const [a, m] = mes.split('-').map(Number)
  return (new Date(a, m - 1, 1).getDay() + 6) % 7
}

export function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
}

export function mesSiguiente(mes) {
  const [a, m] = mes.split('-').map(Number)
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombreDelMes(mes) {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} de ${a}`
}

/** El mes de hoy, en hora de Colombia. */
export function mesDeHoy() {
  return hoyLocal().slice(0, 7)
}

// ─── Lo que decide el color de cada día ───────────────────────────────────────

/**
 * El estado de un día: qué falta, si es que falta algo.
 *
 * - `pasado` — ya ocurrió. **Nunca se marca en rojo**, tuviera o no turnos: el
 *   4 de agosto no se puede repartir. Un calendario que grita por lo que ya no
 *   se puede arreglar enseña a ignorar el rojo, y entonces el rojo del día que
 *   sí importa tampoco se ve.
 * - `pendiente` — hay gente confirmada y **nadie en embarque**. Es el único
 *   hueco que detiene una operación: sin quien embarque, la lancha no sale.
 * - `incompleto` — hay gente y falta alguno de los otros dos. Importa, pero no
 *   a la misma hora.
 * - `listo` — hay gente y los turnos que hacen falta están puestos.
 * - `quieto` — no viene nadie. Un día sin reservas no necesita turno.
 */
export function estadoDelDia({ fecha, pax = 0, turnos = {}, hoy = hoyLocal() }) {
  if (fecha && fecha < hoy) return 'pasado'
  if (!pax) return 'quieto'
  if (!turnos.embarque) return 'pendiente'
  if (!turnos.isla || !turnos.recibimiento) return 'incompleto'
  return 'listo'
}

/** Las iniciales de alguien, para que quepan tres nombres en una casilla. */
export function iniciales(nombre) {
  return String(nombre || '')
    .trim().split(/\s+/).slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('')
}
