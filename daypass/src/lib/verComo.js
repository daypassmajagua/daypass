/**
 * Ver la app como la ve otra persona.
 *
 * Nace de una queja concreta y justa: «no veo que las vistas se ajusten al
 * rol». Y no se veían por una razón simple — **las dos cuentas del sistema son
 * `super_admin`**, que ve todo. Los roles funcionaban (la RLS está verificada
 * contra la base y las pruebas dan 6 de 6), pero no había cómo mirarlos sin
 * crear seis cuentas y entrar y salir seis veces.
 *
 * ── Lo que esto SÍ cambia ───────────────────────────────────────────────────
 *
 * El menú, a dónde cae al entrar, y qué rutas dejan pasar. Todo eso sale de
 * `navegacion.js` y se calcula en el navegador.
 *
 * ── Lo que esto NO cambia, y hay que decirlo ────────────────────────────────
 *
 * **Los permisos.** La sesión sigue siendo la tuya: la RLS, el enmascarado del
 * dinero y los candados de las funciones responden a tu perfil real, no al que
 * estés mirando. Así que mirando como mesero **vas a seguir viendo precios**,
 * porque el servidor te los manda a ti.
 *
 * Eso no es un defecto que falte arreglar: es la única forma honesta de
 * hacerlo. Un "ver como" que además falseara los datos diría que el
 * enmascarado funciona sin haberlo probado, y esa es justamente la
 * comprobación que uno no quiere regalarse. Para ver el enmascarado de verdad
 * hay dos caminos: `npm run demo`, donde el mock lo replica y se cambia de rol
 * desde la consola, o una cuenta real con ese rol.
 *
 * Vive en `sessionStorage` a propósito: es una mirada, no una configuración.
 * Al cerrar la pestaña se acaba.
 */

const CLAVE = 'daypass:ver-como'

const oyentes = new Set()

export function alCambiarVerComo(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function leerVerComo() {
  try {
    return sessionStorage.getItem(CLAVE) || null
  } catch {
    return null   // Safari en privado
  }
}

export function verComo(rol) {
  try {
    if (rol) sessionStorage.setItem(CLAVE, rol)
    else sessionStorage.removeItem(CLAVE)
  } catch { /* sin persistencia, pero la mirada funciona igual */ }
  oyentes.forEach(fn => { try { fn() } catch { /* un oyente roto no estorba */ } })
}

/** Solo quien mantiene el sistema y la dirección: es una herramienta, no un juego. */
export const PUEDE_VER_COMO = ['super_admin', 'directora']
