import { useCallback, useEffect, useRef } from 'react'

/**
 * Borrador automático de la reserva en curso.
 *
 * A la asesora la llaman por teléfono a mitad de captura, o se le cae la
 * página. Al volver, el formulario tiene que estar como lo dejó.
 * Solo aplica a reservas nuevas: al editar, la fuente de verdad es la base.
 */
const CLAVE = 'daypass:borrador-reserva'

export function guardarBorrador(valores, pasajeros) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({
      valores, pasajeros, guardadoEn: Date.now(),
    }))
  } catch { /* sin espacio o modo privado: el borrador es un extra, no un requisito */ }
}

export function leerBorrador() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    const b = JSON.parse(crudo)
    // Un borrador de hace más de un día ya no ayuda: confunde.
    if (Date.now() - (b.guardadoEn || 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CLAVE)
      return null
    }
    return b
  } catch {
    return null
  }
}

export function borrarBorrador() {
  try { localStorage.removeItem(CLAVE) } catch { /* nada que limpiar */ }
}

/** Guarda mientras se escribe, sin castigar cada tecla. */
export function useAutoguardado(activo, valores, pasajeros) {
  const temporizador = useRef(null)

  const guardar = useCallback(() => {
    if (!activo) return
    guardarBorrador(valores, pasajeros)
  }, [activo, valores, pasajeros])

  useEffect(() => {
    if (!activo) return
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(guardar, 800)
    return () => clearTimeout(temporizador.current)
  }, [activo, guardar])
}
