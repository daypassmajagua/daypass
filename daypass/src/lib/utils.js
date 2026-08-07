export function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// ─── Fechas de calendario ──────────────────────────────────────────────────────
// Toda fecha de calendario en este proyecto es hora de Colombia (UTC−5), que es
// la hora local de los dispositivos de la operación. NUNCA derivar una fecha con
// toISOString(): devuelve UTC, y entre las 19:00 y medianoche hora local ya va
// en el día siguiente — justo la ventana en la que se cierra el tentativo.

/** Convierte un Date a 'YYYY-MM-DD' usando la fecha local del dispositivo. */
export function aFechaLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Fecha de hoy en 'YYYY-MM-DD', hora local del dispositivo. */
export function hoyLocal() {
  return aFechaLocal(new Date())
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

/** "1 adulto" / "2 adultos". En pantalla nada suena a máquina. */
export function plural(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Cómo nombra la asesora un día: "hoy", "mañana", o la fecha.
 * El 95% del trabajo vive entre hoy y mañana.
 */
export function diaRelativo(fecha) {
  const hoy = hoyLocal()
  const [y, m, d] = hoy.split('-').map(Number)
  const manana = aFechaLocal(new Date(y, m - 1, d + 1))
  const ayer = aFechaLocal(new Date(y, m - 1, d - 1))

  if (fecha === hoy) return { clave: 'hoy', etiqueta: 'Hoy' }
  if (fecha === manana) return { clave: 'manana', etiqueta: 'Mañana' }
  if (fecha === ayer) return { clave: 'ayer', etiqueta: 'Ayer' }
  return { clave: 'otro', etiqueta: null }
}

/** "hoy viernes 7 de agosto" · "mañana sábado 8 de agosto" · "el 12 de agosto" */
export function fraseFecha(fecha) {
  const { clave, etiqueta } = diaRelativo(fecha)
  const date = new Date(fecha + 'T00:00:00')
  const largo = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(date)
  if (clave === 'otro') return `El ${largo}`
  return `${etiqueta} ${largo}`
}

export function hora12(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// Lenguaje de la operación, no de la base de datos: en pantalla nunca
// aparece "noshow" ni "en_isla".
export const ESTADO_LABELS = {
  tentativa: 'Tentativa',
  confirmada: 'Confirmada',
  en_isla: 'En la isla',
  completada: 'Completada',
  noshow: 'No llegó',
  cancelada: 'Cancelada',
}

// Un color fijo por estado, idéntico en tablas, gráficas y documentos:
// la asesora aprende el código una sola vez.
export const ESTADO_COLORS = {
  tentativa: 'bg-[#ececE8] text-tinta-2',
  confirmada: 'bg-blue-50 text-blue-700',
  en_isla: 'bg-[#e7f3fb] text-[#1d6fa5]',
  completada: 'bg-verde-50 text-verde-500',
  noshow: 'bg-coral-50 text-coral-600',
  cancelada: 'bg-[#fce9e8] text-[#d2322d]',
}

export const FORMA_PAGO_LABELS = {
  deposito: 'Depósito',
  cxc: 'CxC',
  pago_directo: 'Pago Directo',
  cortesia: 'Cortesía',
}

export const IMPUESTOS_LABELS = {
  si: 'SÍ',
  no: 'NO',
  exe: 'EXE',
}
