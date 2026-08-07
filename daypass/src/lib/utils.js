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
