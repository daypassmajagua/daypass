import { useCallback, useEffect, useState } from 'react'
import { alCambiarLaCola, contarPendientes, drenar, listarPendientes } from './cola'
import { leerPrecarga } from './db'

/**
 * Estado de la sincronización, para el indicador que nunca se esconde.
 *
 * La asesora tiene que poder responder en un vistazo: ¿esto ya quedó
 * guardado, o está en el iPad esperando señal?
 */
export function useOffline() {
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)

  const refrescar = useCallback(async () => {
    setPendientes(await contarPendientes())
  }, [])

  useEffect(() => {
    refrescar()
    return alCambiarLaCola(refrescar)
  }, [refrescar])

  useEffect(() => {
    const arriba = () => setEnLinea(true)
    const abajo = () => setEnLinea(false)
    window.addEventListener('online', arriba)
    window.addEventListener('offline', abajo)
    return () => {
      window.removeEventListener('online', arriba)
      window.removeEventListener('offline', abajo)
    }
  }, [])

  const forzar = useCallback(async () => {
    setSincronizando(true)
    const r = await drenar()
    setSincronizando(false)
    await refrescar()
    return r
  }, [refrescar])

  return { enLinea, pendientes, sincronizando, forzar, listarPendientes }
}

/** Cuándo se llenó por última vez la copia local de este día. */
export function usePrecarga(fecha) {
  const [precarga, setPrecarga] = useState(null)

  const refrescar = useCallback(async () => {
    if (!fecha) return
    setPrecarga(await leerPrecarga(fecha))
  }, [fecha])

  useEffect(() => { refrescar() }, [refrescar])

  return { precarga, refrescar }
}

/** "hace 2 min" · "hace 3 h" · "ayer". La isla necesita saberlo de un vistazo. */
export function haceCuanto(iso) {
  if (!iso) return null
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}
