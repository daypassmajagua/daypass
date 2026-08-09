import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePerfil } from '../../hooks/usePerfil'
import { puedeVer, inicioDe } from '../../lib/navegacion'
import BotonReportar from '../soporte/BotonReportar'
import logoAzul from '../../assets/logo-azul.png'

/**
 * La puerta: sesión, perfil y permiso, en ese orden.
 *
 * Antes solo comprobaba que hubiera sesión. Ahora también que la persona esté
 * en el equipo y que la ruta le corresponda — pero **la RLS es lo que de
 * verdad protege**: esto solo evita que alguien vea una pantalla vacía y crea
 * que el sistema está roto.
 *
 * Los tres estados de salida dicen cosas distintas a propósito:
 *
 *   sin sesión      → al login
 *   sin perfil      → "tu usuario todavía no está en el equipo", con salida
 *   ruta ajena      → a su inicio, sin regañar
 *
 * El del medio es el que importa: si alguien recién creado ve un error técnico
 * en vez de una frase que le diga a quién pedirle acceso, va a pensar que el
 * sistema falló.
 */

function Cargando({ mensaje }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-fondo">
      <div className="flex flex-col items-center gap-3">
        <img src={logoAzul} alt="" className="h-20 w-auto animate-pulse motion-reduce:animate-none" />
        <p className="text-sm text-tinta-2">{mensaje}</p>
      </div>
    </div>
  )
}

function SinPermiso({ onSalir }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-fondo px-6">
      <div className="max-w-md text-center flex flex-col items-center gap-3">
        <img src={logoAzul} alt="" className="h-16 w-auto opacity-60 mb-1" />
        <p className="text-[19px] font-bold text-tinta text-balance">
          Tu usuario todavía no está en el equipo
        </p>
        <p className="text-[15px] text-tinta-2 text-balance">
          La cuenta existe, pero nadie le ha asignado todavía qué puede ver.
          Pídele a la directora que te agregue y vuelve a entrar.
        </p>
        <button
          onClick={onSalir}
          className="mt-2 rounded-xl bg-blue-50 text-blue-700 font-bold px-5 min-h-[44px]"
        >
          Salir
        </button>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children }) {
  const [sesion, setSesion] = useState(undefined)
  const { perfil, cargando, rol, sinPermiso } = usePerfil()
  const { pathname } = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => subscription.unsubscribe()
  }, [])

  if (sesion === undefined) return <Cargando mensaje="Cargando…" />
  if (!sesion) return <Navigate to="/login" replace />

  if (cargando) return <Cargando mensaje="Viendo qué te toca hoy…" />

  if (sinPermiso || !perfil) {
    return <SinPermiso onSalir={() => supabase.auth.signOut()} />
  }

  const inicio = inicioDe(rol)

  // La raíz manda a cada quien a su trabajo. Es lo que hace que el mesero abra
  // la app y vea la isla, y gerencia los números, en vez de un menú donde
  // adivinar.
  if (pathname === '/' && inicio !== '/') {
    return <Navigate to={inicio} replace />
  }

  // La ruta no es suya: a lo suyo, sin sermón. Alguien pudo llegar por un
  // enlace viejo o por el historial del navegador.
  if (!puedeVer(rol, pathname)) {
    return <Navigate to={inicio} replace />
  }

  // El botón de reportar va aquí y no en el marco de la oficina: el muelle y
  // la isla no llevan marco, y son justamente las pantallas donde ocurre el
  // fallo que más importa contar. Fuera de esta puerta no aparece — la página
  // del cliente no es sitio para un canal de soporte interno.
  return (
    <>
      {children}
      <BotonReportar />
    </>
  )
}
