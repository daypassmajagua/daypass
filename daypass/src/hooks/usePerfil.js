import { createContext, useContext, useSyncExternalStore } from 'react'
import { alCambiarVerComo, leerVerComo, PUEDE_VER_COMO } from '../lib/verComo'

/**
 * Quién soy y qué puedo ver.
 *
 * ── Lo que cambió, y por qué importa ────────────────────────────────────────
 *
 * Esto **era** un hook con estado propio: cada componente que lo llamaba hacía
 * su propio `getSession()`, su propia consulta a `perfiles` y su propio escucha
 * de sesión. Lo llaman quince componentes, así que abrir una pantalla disparaba
 * cinco veces lo mismo y cada refresco de token despertaba a los quince.
 *
 * Peor: el hook pedía la sesión **dentro** del callback de
 * `onAuthStateChange`, que es pedirla desde adentro del candado con el que el
 * cliente de Supabase la protege. De ahí salía la pantalla «Viendo qué te toca
 * hoy…» que no abría y terminaba en «el servidor no respondió a tiempo», sin
 * un solo error en la consola — porque no había error, había una espera que no
 * acababa.
 *
 * Ahora el trabajo lo hace `ProveedorPerfil` **una vez**, y esto solo lee.
 * La forma que devuelve es la misma de antes a propósito: quince sitios lo
 * usan y ninguno tuvo que cambiar.
 *
 * ── Lo que sí se decide aquí ────────────────────────────────────────────────
 *
 * «Ver la app como» — que es una mirada y no un permiso. Cambia lo que se
 * muestra, nunca lo que el servidor responde; el control de verdad es la RLS.
 * Vive aquí y no en el proveedor porque no toca la red: es estado local que se
 * lee de `lib/verComo.js`.
 */

/** Lo que llena `ProveedorPerfil`. Fuera de él, la app se ve cargando. */
export const ContextoPerfil = createContext({
  perfil: undefined,
  hayTablaPerfiles: true,
  fallo: null,
  recargar: () => {},
})

export function usePerfil() {
  const { perfil, hayTablaPerfiles, fallo, recargar } = useContext(ContextoPerfil)

  const mirandoComo = useSyncExternalStore(alCambiarVerComo, leerVerComo, () => null)
  const rolReal = perfil?.rol || null
  const puedeMirar = PUEDE_VER_COMO.includes(rolReal)
  const rol = puedeMirar && mirandoComo ? mirandoComo : rolReal

  return {
    perfil,
    // Mientras no haya respuesta NI fallo. Con fallo ya no se está cargando:
    // se está esperando a que alguien decida qué hacer.
    cargando: perfil === undefined && !fallo,
    /** No se pudo comprobar el acceso. Distinto de no tenerlo. */
    fallo,
    /** El rol con el que se pinta la app. Puede ser el que se está mirando. */
    rol,
    /** El de verdad, el de la sesión. Es el que manda en el servidor. */
    rolReal,
    /** No null solo mientras se está mirando como otra persona. */
    mirandoComo: puedeMirar ? mirandoComo : null,
    puedeMirar,
    /** Sin perfil y con la tabla ya creada: la persona existe pero no está en el equipo. */
    sinPermiso: perfil === null && hayTablaPerfiles,
    recargar,
  }
}
