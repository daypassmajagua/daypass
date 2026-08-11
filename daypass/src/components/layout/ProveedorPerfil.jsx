import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ROL_POR_DEFECTO } from '../../lib/navegacion'
import { ContextoPerfil } from '../../hooks/usePerfil'

/**
 * Quién soy, resuelto **una sola vez** para toda la app.
 *
 * ── El problema que esto arregla ────────────────────────────────────────────
 *
 * `usePerfil()` lo llaman quince componentes —`ProtectedRoute`, `Navbar`,
 * `FranjaDia`, `BarraVerComo`, y casi cada pantalla— y hasta ahora **cada
 * llamada era un hook independiente**: su propio `getSession()`, su propia
 * consulta a `perfiles` y **su propio escucha de sesión**.
 *
 * Abrir «Hoy» disparaba cinco veces lo mismo. Y cada refresco del token
 * despertaba a los quince escuchas a la vez.
 *
 * ── Y de ahí venía el cuelgue ───────────────────────────────────────────────
 *
 * El cliente de Supabase protege la sesión con un candado: mientras uno la
 * está refrescando, los demás esperan. Con quince pidiéndola a la vez la cola
 * se hace larga, y **llamar a `getSession()` dentro de `onAuthStateChange` es
 * pedirla desde adentro del candado** — que es exactamente lo que hacía el
 * hook viejo. El síntoma: la pantalla «Viendo qué te toca hoy…» que no abre y
 * termina en «el servidor no respondió a tiempo», sin un solo error en la
 * consola, porque no hay error: hay una espera que no acaba.
 *
 * Aquí hay **un escucha, una sesión y una consulta**. Y el escucha usa la
 * sesión que le llega por parámetro en vez de volver a pedirla, que es la
 * forma de no entrar al candado desde adentro.
 */

/** Toda espera tiene final. Doce segundos es mucho más de lo que tarda una
 *  consulta sana y mucho menos de lo que aguanta alguien mirando un logo. */
function conLimite(promesa, ms = 12000) {
  return Promise.race([
    promesa,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error('El servidor no respondió a tiempo.')), ms)
    ),
  ])
}

export default function ProveedorPerfil({ children }) {
  const [perfil, setPerfil] = useState(undefined)   // undefined = cargando
  const [hayTablaPerfiles, setHayTablaPerfiles] = useState(true)
  const [fallo, setFallo] = useState(null)

  // La última sesión conocida, puesta por el escucha. Evita volver a pedirla.
  const sesion = useRef(null)

  /**
   * Trae el perfil de una sesión ya conocida.
   *
   * No pide la sesión: la recibe. Ese es el punto — el escucha de Supabase ya
   * la trae, y pedirla otra vez desde su callback es lo que trababa todo.
   */
  const traerPerfil = useCallback(async (userId, correo) => {
    if (!userId) { setPerfil(null); setFallo(null); return }

    try {
      setFallo(null)
      const { data, error } = await conLimite(
        supabase
          .from('perfiles')
          .select('user_id, nombre, rol, activo')
          .eq('user_id', userId)
          .maybeSingle()
      )

      // 42P01 = la tabla no existe: la migración 015 todavía no corrió. Se
      // asume el rol por defecto para que desplegar el front antes que la
      // migración no deje a todo el mundo mirando una pantalla vacía.
      if (error && (error.code === '42P01' || /does not exist/i.test(error.message || ''))) {
        setHayTablaPerfiles(false)
        setPerfil({
          user_id: userId,
          nombre: correo?.split('@')[0] || 'alguien',
          rol: ROL_POR_DEFECTO,
          activo: true,
          provisional: true,
        })
        return
      }

      if (error) { setPerfil(null); return }
      setPerfil(data?.activo ? data : null)
    } catch (e) {
      /**
       * **El perfil NO se pone en null aquí, a propósito.** Null quiere decir
       * «esta persona no está en el equipo», y decirle eso a alguien porque se
       * cayó la red sería acusarlo de algo que no pasó. Queda como fallo, que
       * es otra cosa y se cuenta distinto.
       */
      setFallo(e?.message || 'No se pudo comprobar tu acceso.')
    }
  }, [])

  /** Volver a intentar, con la sesión que ya se tenga. */
  const recargar = useCallback(async () => {
    setPerfil(undefined)
    if (sesion.current) {
      await traerPerfil(sesion.current.user?.id, sesion.current.user?.email)
      return
    }
    try {
      const { data } = await conLimite(supabase.auth.getSession())
      sesion.current = data?.session || null
      await traerPerfil(sesion.current?.user?.id, sesion.current?.user?.email)
    } catch (e) {
      setFallo(e?.message || 'No se pudo comprobar tu acceso.')
    }
  }, [traerPerfil])

  useEffect(() => {
    let vigente = true

    /**
     * Un solo escucha para toda la app.
     *
     * `onAuthStateChange` dispara `INITIAL_SESSION` apenas se suscribe, con la
     * sesión que haya. Así que **no hace falta pedirla aparte**: llega sola, y
     * de paso llega en cada refresco de token y en cada entrada o salida.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, s) => {
      if (!vigente) return
      sesion.current = s || null

      // El refresco del token no cambia quién es nadie: volver a consultar
      // `perfiles` cada hora por eso es trabajo que no responde ninguna
      // pregunta nueva.
      if (evento === 'TOKEN_REFRESHED') return

      traerPerfil(s?.user?.id, s?.user?.email)
    })

    /**
     * Red de seguridad: si por lo que sea el evento inicial no llega —un
     * navegador con el almacenamiento bloqueado, una versión que no lo emita—
     * se pregunta a los dos segundos. Va fuera del callback, así que no entra
     * al candado desde adentro.
     */
    const red = setTimeout(async () => {
      if (!vigente || sesion.current !== null) return
      try {
        const { data } = await conLimite(supabase.auth.getSession())
        if (!vigente || sesion.current !== null) return
        sesion.current = data?.session || null
        traerPerfil(sesion.current?.user?.id, sesion.current?.user?.email)
      } catch (e) {
        if (vigente) setFallo(e?.message || 'No se pudo comprobar tu acceso.')
      }
    }, 2000)

    return () => {
      vigente = false
      clearTimeout(red)
      subscription.unsubscribe()
    }
  }, [traerPerfil])

  const valor = useMemo(
    () => ({ perfil, hayTablaPerfiles, fallo, recargar }),
    [perfil, hayTablaPerfiles, fallo, recargar]
  )

  return <ContextoPerfil.Provider value={valor}>{children}</ContextoPerfil.Provider>
}
