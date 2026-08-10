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
 *
 * ── Y una tercera cosa, que costó una pantalla colgada ──────────────────────
 *
 * Antes, si cualquiera de las dos consultas no respondía, `setPerfil` no se
 * llamaba nunca y la app se quedaba en «Viendo qué te toca hoy…» **para
 * siempre**, sin error, sin botón y sin forma de salir. Una consulta que no
 * vuelve es un caso real —la sesión que se está refrescando, PostgREST
 * ocupado, la red del hotel— y merecía su propio estado en vez de un limbo.
 *
 * Ahora hay tres respuestas posibles y ninguna es esperar sin fin: **tiene
 * perfil**, **no está en el equipo**, o **no se pudo saber** — y esta última
 * trae reintentar y salir.
 */

/**
 * Toda espera tiene final. Doce segundos es mucho más de lo que tarda una
 * consulta sana y mucho menos de lo que aguanta alguien mirando un logo.
 */
function conLimite(promesa, ms = 12000) {
  return Promise.race([
    promesa,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error('El servidor no respondió a tiempo.')), ms)
    ),
  ])
}

export function usePerfil() {
  const [perfil, setPerfil] = useState(undefined)   // undefined = cargando
  const [hayTablaPerfiles, setHayTablaPerfiles] = useState(true)
  const [fallo, setFallo] = useState(null)

  const cargar = useCallback(async () => {
    setFallo(null)
    try {
      const { data: sesion } = await conLimite(supabase.auth.getSession())
      const userId = sesion?.session?.user?.id
      if (!userId) { setPerfil(null); return }

      const { data, error } = await conLimite(
        supabase
          .from('perfiles')
          .select('user_id, nombre, rol, activo')
          .eq('user_id', userId)
          .maybeSingle()
      )

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
    } catch (e) {
      // **El perfil NO se pone en null aquí, a propósito.** Null significa "esta
      // persona no está en el equipo", y decirle eso a alguien porque se cayó la
      // red sería acusarlo de algo que no pasó. Queda como fallo, que es otra
      // cosa y se cuenta distinto.
      setFallo(e?.message || 'No se pudo comprobar tu acceso.')
    }
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
    recargar: cargar,
  }
}
