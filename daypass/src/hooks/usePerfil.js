import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { ROL_POR_DEFECTO } from '../lib/navegacion'
import { alCambiarVerComo, leerVerComo, PUEDE_VER_COMO } from '../lib/verComo'

/**
 * Quién soy y qué puedo ver.
 *
 * ── Lo que más importa de este archivo ──────────────────────────────────────
 *
 * **Tolera que la migración 015 no haya corrido.** Si la tabla `perfiles` no
 * existe todavía, se asume el rol por defecto y todo sigue funcionando como
 * antes. Sin eso, desplegar el front antes que la migración dejaría a todo el
 * mundo mirando una pantalla vacía — y el orden de despliegue no siempre lo
 * decide quien escribió el código.
 *
 * Pero **con perfiles ya creados, no tener perfil sí bloquea**: es la
 * diferencia entre "el sistema no está listo" y "esta persona no tiene
 * permiso", y confundirlas sería dejar entrar a cualquiera con una cuenta.
 */

export function usePerfil() {
  const [perfil, setPerfil] = useState(undefined)   // undefined = cargando
  const [hayTablaPerfiles, setHayTablaPerfiles] = useState(true)

  const cargar = useCallback(async () => {
    const { data: sesion } = await supabase.auth.getSession()
    const userId = sesion?.session?.user?.id
    if (!userId) { setPerfil(null); return }

    const { data, error } = await supabase
      .from('perfiles')
      .select('user_id, nombre, rol, activo')
      .eq('user_id', userId)
      .maybeSingle()

    // 42P01 = la tabla no existe. La migración todavía no corrió.
    if (error && (error.code === '42P01' || /does not exist/i.test(error.message || ''))) {
      setHayTablaPerfiles(false)
      setPerfil({
        user_id: userId,
        nombre: sesion.session.user.email?.split('@')[0] || 'alguien',
        rol: ROL_POR_DEFECTO,
        activo: true,
        provisional: true,
      })
      return
    }

    if (error) { setPerfil(null); return }
    setPerfil(data?.activo ? data : null)
  }, [])

  useEffect(() => {
    cargar()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => cargar())
    return () => subscription.unsubscribe()
  }, [cargar])

  // Una mirada, no un permiso: cambia lo que se muestra, nunca lo que el
  // servidor responde. Ver `lib/verComo.js`.
  const mirandoComo = useSyncExternalStore(alCambiarVerComo, leerVerComo, () => null)
  const rolReal = perfil?.rol || null
  const puedeMirar = PUEDE_VER_COMO.includes(rolReal)
  const rol = puedeMirar && mirandoComo ? mirandoComo : rolReal

  return {
    perfil,
    cargando: perfil === undefined,
    /** El rol con el que se pinta la app. Puede ser el que se está mirando. */
    rol,
    /** El de verdad, el de la sesión. Es el que manda en el servidor. */
    rolReal,
    /** No null solo mientras se está mirando como otra persona. */
    mirandoComo: puedeMirar ? mirandoComo : null,
    puedeMirar,
    /** Sin perfil y con la tabla ya creada: la persona existe pero no está en el equipo. */
    sinPermiso: perfil === null && hayTablaPerfiles,
    recargar: cargar,
  }
}
