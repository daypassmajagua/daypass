import { createContext, useContext } from 'react'

/**
 * Los tres modos: oficina, muelle e isla.
 *
 * No son tamaños de pantalla, son **situaciones de uso**. La misma persona con
 * el mismo rol necesita cosas distintas según dónde esté parada:
 *
 *              Oficina            Muelle                 Isla
 *   postura    sentada, con       de pie, una mano,      de paso, mirando
 *              tiempo             a pleno sol
 *   base       16 px              18 px                  20 px
 *   fila       44 px              64 px                  56 px
 *   barra      completa           ninguna                mínima
 *   dinero     sí                 NUNCA                  NUNCA
 *
 * **El modo se marca por dispositivo, no por usuario ni por sesión.** El iPad
 * del muelle se configura una vez y abre siempre así; desde un computador el
 * modo muelle no debería existir. Por eso vive en `localStorage` y no en el
 * perfil: si viajara con la cuenta, Daniela abriría su computador en modo
 * muelle solo porque ayer estuvo en el muelle.
 *
 * Y la razón por la que el muelle no muestra dinero **no es de permisos**: es
 * que esa pantalla la ven el pasajero, el guía y toda la fila. Discreción
 * física. El control de acceso de verdad es la RLS, y llega con los roles.
 *
 * El proveedor vive aparte, en `components/layout/ProveedorModo.jsx`: un
 * archivo que exporta componentes y funciones a la vez rompe el recargado en
 * caliente de Vite.
 */

export const MODOS = {
  oficina: {
    id: 'oficina',
    nombre: 'Oficina',
    base: 16,
    fila: 44,
    conBarra: true,
    muestraDinero: true,
  },
  muelle: {
    id: 'muelle',
    nombre: 'Muelle',
    base: 18,
    fila: 64,
    conBarra: false,
    muestraDinero: false,
  },
  isla: {
    id: 'isla',
    nombre: 'Isla',
    base: 20,
    fila: 56,
    conBarra: false,
    muestraDinero: false,
  },
}

export const CLAVE_MODO = 'daypass:modo'

export const ContextoModo = createContext(MODOS.oficina)

/** Lee el modo del aparato. Si no hay nada guardado, oficina. */
export function leerModoGuardado() {
  try {
    const guardado = localStorage.getItem(CLAVE_MODO)
    return MODOS[guardado] ? guardado : 'oficina'
  } catch {
    // Safari en privado puede lanzar al tocar localStorage.
    return 'oficina'
  }
}

/**
 * El modo actual. Toda pantalla que traiga datos debería preguntarlo en vez de
 * asumir oficina.
 */
export function useModo() {
  return useContext(ContextoModo)
}

/**
 * ¿Se puede mostrar dinero aquí?
 *
 * Se pregunta con nombre propio porque es la decisión que más se repite y la
 * que peor se ve si se olvida: un total en pantalla mientras cuarenta personas
 * hacen fila detrás.
 */
export function useMuestraDinero() {
  return useContext(ContextoModo).muestraDinero
}
