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

export function todayISO() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export const ESTADO_LABELS = {
  tentativa: 'Tentativa',
  confirmada: 'Confirmada',
  en_isla: 'En Isla',
  completada: 'Completada',
  noshow: 'No Show',
  cancelada: 'Cancelada',
}

export const ESTADO_COLORS = {
  tentativa: 'bg-gray-100 text-gray-600',
  confirmada: 'bg-blue-100 text-blue-700',
  en_isla: 'bg-green-100 text-green-700',
  completada: 'bg-emerald-100 text-emerald-800',
  noshow: 'bg-orange-100 text-orange-700',
  cancelada: 'bg-red-100 text-red-700',
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
