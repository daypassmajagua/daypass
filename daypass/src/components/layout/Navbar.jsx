import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase, isMock } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  PlusCircle,
  List,
  ClipboardList,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart2,
  Anchor,
  Ship,
  ChefHat,
  Palmtree,
  Lock,
  UserCog,
  LifeBuoy,
  Wallet,
  Users,
  Target,
} from 'lucide-react'
import { useState } from 'react'
import { classNames } from '../../lib/utils'
import logoBlanco from '../../assets/logo-blanco.png'
import IndicadorSync from './IndicadorSync'
import Buscador from './Buscador'
import { usePerfil } from '../../hooks/usePerfil'
import { menuDe, seccionesDe, ETIQUETA_ROL } from '../../lib/navegacion'

/**
 * El menú sale de navegacion.js, no de una lista aquí. Antes había tres
 * listas —esta, la de ProtectedRoute y la redirección al entrar— y con ocho
 * roles se habrían desincronizado en la primera semana.
 *
 * Los iconos se resuelven por nombre porque navegacion.js es lógica y no
 * debería importar componentes de dibujo.
 */
const ICONOS = {
  LayoutDashboard, PlusCircle, List, Lock, Anchor, Palmtree, ChefHat,
  ClipboardList, Ship, History, BarChart2, Settings, UserCog, LifeBuoy, Wallet, Users, Target,
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { rol } = usePerfil()

  // Lo que este rol no puede usar no aparece: nada en gris, nada con candado.
  // Un menú lleno de cosas que no puedes tocar se lee mal todos los días.
  const secciones = menuDe(rol)
  const hayConfig = seccionesDe(rol).length > 0

  /**
   * Si esta entrada es la que está abierta.
   *
   * No basta comparar rutas: quien está en `/nuevo` o en `/historial` sigue
   * estando en «Reservas», y quien está en `/config/planes` sigue en el
   * engranaje. Sin esto, media app se ve como si nadie estuviera en ninguna
   * parte.
   */
  function activo(ruta) {
    const aqui = location.pathname
    if (ruta === '/') return aqui === '/'
    if (ruta === '/reservas') {
      return ['/reservas', '/nuevo', '/historial'].includes(aqui) || aqui.startsWith('/editar')
    }
    if (ruta === '/isla') return aqui === '/isla' || aqui === '/cocina'
    if (ruta === '/informes') return aqui === '/informes' || aqui === '/metas'
    if (ruta === '/config') return aqui.startsWith('/config') || ['/equipo', '/usuarios', '/reportes'].includes(aqui)
    return aqui === ruta
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    navigate('/login')
  }

  return (
    <>
      {/* Barra superior. Con nueve secciones más el indicador, el menú
          completo solo cabe desde 1536px; por debajo se usa el cajón
          táctil. En el sprint de roles cada persona verá solo lo suyo y
          esto vuelve a caber holgado. */}
      <header className="degradado-marca text-white sticky top-0 z-40 shadow-[0_4px_20px_rgba(30,32,69,.18)] pt-[env(safe-area-inset-top)]">
        {/* A todo el ancho, no max-w-7xl: con el contenedor limitado a
            1280px el menú se solapaba aunque la pantalla fuera más grande. */}
        <div className="px-3 sm:px-5 flex items-center justify-between gap-4 h-16">
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <button
              className="2xl:hidden -ml-1 p-2.5 rounded-xl hover:bg-white/10 shrink-0"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <img src={logoBlanco} alt="Hotel San Pedro de Majagua" className="h-10 w-auto shrink-0" />
            <span className="font-bold text-lg tracking-tight shrink-0">DayPASS</span>
            {isMock && (
              <span className="px-2 py-1 rounded-lg bg-white/20 text-white text-[11px] font-bold uppercase tracking-wide shrink-0">
                Demo
              </span>
            )}
          </div>

          {/* Siete sustantivos, y con siete ya cabe desde `lg` — antes eran
              dieciséis y solo cabían desde 1536px. */}
          <nav className="hidden lg:flex items-center gap-1 min-w-0">
            {secciones.map(({ a: to, etiqueta: label, icono }) => { const Icon = ICONOS[icono]; return (
              <Link
                key={to}
                to={to}
                className={classNames(
                  'flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-semibold whitespace-nowrap transition-colors',
                  // La píldora del activo es sólida, no un velo: saber dónde
                  // estás no debería costar una segunda mirada.
                  activo(to)
                    ? 'bg-white text-brand-900'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            )})}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {/* La otra mitad de la navegación. Va antes del engranaje porque se
                usa mil veces más. */}
            <Buscador />

            <IndicadorSync />

            {/* El engranaje va aparte y con separador: no es un octavo destino,
                es otra clase de sitio. */}
            {hayConfig && (
              <Link
                to="/config"
                aria-label="Configuración"
                className={classNames(
                  'hidden lg:flex items-center justify-center w-10 h-10 rounded-[10px] transition-colors',
                  'border-l border-white/15 ml-1 pl-1 rounded-l-none',
                  activo('/config')
                    ? 'bg-white text-brand-900'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Settings size={18} />
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white rounded-[10px] transition-colors"
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Cajón táctil: filas de 56px, se cierra al elegir o al tocar afuera. */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <nav className="relative bg-brand-900 w-72 max-w-[80vw] h-full shadow-2xl flex flex-col py-3 pt-[calc(env(safe-area-inset-top)+12px)] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pb-3">
              <span className="font-bold text-lg text-white">DayPASS</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2.5 -mr-2 rounded-xl text-white/70 hover:bg-white/10"
                aria-label="Cerrar menú"
              >
                <X size={22} />
              </button>
            </div>
            {secciones.map(({ a: to, etiqueta: label, icono }) => { const Icon = ICONOS[icono]; return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={classNames(
                  'flex items-center gap-3.5 px-5 min-h-[56px] text-[15px] font-semibold transition-colors',
                  activo(to)
                    ? 'bg-white text-brand-900'
                    : 'text-white/75 hover:bg-white/10'
                )}
              >
                <Icon size={20} />
                {label}
              </Link>
            )})}

            {/* También aquí va aparte: misma separación que en la barra, para
                que el cajón no enseñe una jerarquía distinta. */}
            {hayConfig && (
              <Link
                to="/config"
                onClick={() => setMobileOpen(false)}
                className={classNames(
                  'flex items-center gap-3.5 px-5 min-h-[56px] text-[15px] font-semibold transition-colors',
                  'mt-2 border-t border-white/15 pt-2',
                  activo('/config') ? 'bg-white text-brand-900' : 'text-white/75 hover:bg-white/10'
                )}
              >
                <Settings size={20} />
                Configuración
              </Link>
            )}
            <div className="mt-auto border-t border-white/15 pt-2 pb-[env(safe-area-inset-bottom)]">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3.5 px-5 min-h-[56px] text-[15px] font-semibold text-white/75 hover:bg-white/10 w-full"
              >
                <LogOut size={20} />
                Cerrar sesión
              </button>
            </div>
          </nav>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
