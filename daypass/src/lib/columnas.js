/**
 * Qué columnas se piden de `registros`, escritas a mano.
 *
 * ── Por qué esto existe ─────────────────────────────────────────────────────
 *
 * Hasta ahora las ocho consultas sobre `registros` pedían `select('*')`. Eso
 * funciona mientras todos los roles puedan ver todas las columnas — que es
 * exactamente lo que la fase de roles viene a cambiar.
 *
 * Y en PostgreSQL, si un rol **no** tiene `SELECT` sobre una columna,
 * `select *` **falla** con `permission denied for column`. No la omite en
 * silencio. Así que el día que se le revoque `precio_adulto` al mesero,
 * `/isla` dejaría de cargar entera — y `precarga.js` es peor, porque su fallo
 * aparecería sin señal, en el muelle, a las ocho de la mañana.
 *
 * Con listas explícitas, cada pantalla pide solo lo que muestra, y revocar una
 * columna deja de ser un incendio.
 *
 * ── Tres niveles, no dos ────────────────────────────────────────────────────
 *
 * Empezó como "con dinero" y "sin dinero", pero al revisar quién usa qué
 * apareció un caso que no encaja en ninguno de los dos: **`forma_pago` no es
 * un precio.** No dice cuánto costó, dice cómo se paga — y la isla lo
 * necesita, porque de ahí sale si a esa persona se le carga el almuerzo o es
 * una cortesía del hotel. Cobrarle a un invitado es el error que no se
 * deshace.
 *
 *   RESERVA              muelle · cocina         nada de dinero
 *   RESERVA_CON_PAGO     isla · folios · Hoy     + forma_pago
 *   RESERVA_CON_DINERO   oficina                 + precios y totales
 *
 * La regla para elegir: **si la pantalla no muestra plata, no pide precios.**
 * No es solo permisos — el muelle y la isla tienen la pantalla a la vista del
 * pasajero y de la fila entera.
 *
 * ── Al agregar una columna a `registros` ────────────────────────────────────
 *
 * Hay que agregarla aquí también, o no llegará a las pantallas. Es el precio
 * de no usar `*`, y es barato comparado con lo otro.
 */

/** Lo que describe la reserva sin decir nada de plata. */
const CAMPOS_RESERVA = [
  'id', 'fecha', 'tipo', 'estado',
  'nombre_pasajero', 'identificacion', 'nombre_grupo',
  'cliente_id', 'lancha_id', 'pais_id', 'plan_id', 'canal_id',
  'agencia_id', 'agencia_nombre',
  'temporada',
  'adultos', 'ninos', 'infantes', 'cortesias',
  'impuestos_puerto', 'voucher_os', 'folio_zeus', 'observaciones',
  'generada_por', 'vendida_por',
  'telefono', 'email',
  'tipo_ingreso_id', 'cobra_cupo',
  'check_in_at', 'check_in_desde',
  'cambio_tardio', 'cambio_tardio_at', 'cambio_tardio_por', 'cambio_tardio_motivo',
  'created_at', 'updated_at',
]

/**
 * Cómo se paga. No es un precio: es lo que decide si en la mesa se le carga el
 * almuerzo a alguien o no.
 */
const CAMPOS_PAGO = ['forma_pago']

/**
 * Cuánto cuesta. Esta es la lista que la fase de roles va a revocar por
 * columna para isla, recepción y mesero.
 */
const CAMPOS_PRECIO = [
  'precio_adulto', 'precio_nino', 'precio_lancha',
  'total_calculado', 'valor_cupo',
]

// ── Las tablas que se traen junto con la reserva ──
export const CON_LANCHA = 'lanchas (id, nombre)'
export const CON_LANCHA_COMPLETA = 'lanchas (id, codigo, nombre, capacidad)'
export const CON_PLAN = 'planes (id, nombre)'
export const CON_PLAN_COMPLETO = 'planes (id, nombre, categoria, nivel)'
export const CON_CANAL = 'canales (id, codigo, nombre)'
export const CON_PAIS = 'paises (id, codigo, nombre)'
export const CON_AGENCIA = 'agencias (id, nombre)'

/** Sin nada de dinero: muelle y cocina. */
export const RESERVA = CAMPOS_RESERVA.join(', ')

/** Con la forma de pago, sin precios: isla, folios, Hoy y el cierre. */
export const RESERVA_CON_PAGO = [...CAMPOS_RESERVA, ...CAMPOS_PAGO].join(', ')

/** Todo: oficina. */
export const RESERVA_CON_DINERO =
  [...CAMPOS_RESERVA, ...CAMPOS_PAGO, ...CAMPOS_PRECIO].join(', ')

/**
 * Arma el `select` de una reserva con lo que haga falta.
 *
 *   reservaCon({ nivel: 'dinero', relaciones: [CON_LANCHA, CON_PLAN] })
 */
export function reservaCon({ nivel = 'basico', relaciones = [] } = {}) {
  const base =
    nivel === 'dinero' ? RESERVA_CON_DINERO :
    nivel === 'pago' ? RESERVA_CON_PAGO :
    RESERVA
  return relaciones.length ? `${base}, ${relaciones.join(', ')}` : base
}

export { CAMPOS_RESERVA, CAMPOS_PAGO, CAMPOS_PRECIO }
