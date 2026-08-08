import { useCallback, useEffect, useMemo, useState } from 'react'
import { ContextoModo, MODOS, CLAVE_MODO, leerModoGuardado } from '../../lib/modo'

/**
 * Envuelve la app y decide en qué modo se está operando.
 *
 * La definición de los modos y los hooks viven en `lib/modo.js`: aquí solo
 * está el componente, porque un archivo que exporta componentes y funciones a
 * la vez rompe el recargado en caliente de Vite.
 */
export default function ProveedorModo({ children }) {
  const [modoId, setModoId] = useState(leerModoGuardado)

  const cambiar = useCallback(id => {
    if (!MODOS[id]) return
    setModoId(id)
    try { localStorage.setItem(CLAVE_MODO, id) } catch { /* sin persistencia, pero funciona */ }
  }, [])

  // El modo se anuncia en el elemento raíz para que el CSS pueda responder sin
  // que cada componente tenga que preguntarle al contexto.
  useEffect(() => {
    document.documentElement.dataset.modo = modoId
    return () => { delete document.documentElement.dataset.modo }
  }, [modoId])

  const valor = useMemo(() => ({ ...MODOS[modoId], cambiar }), [modoId, cambiar])

  return <ContextoModo.Provider value={valor}>{children}</ContextoModo.Provider>
}
