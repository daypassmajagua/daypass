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
} from 'lucide-react'
import { useState } from 'react'
import { classNames } from '../../lib/utils'
import logoBlanco from '../../assets/logo-blanco.png'
import IndicadorSync from './IndicadorSync'

const NAV_ITEMS = [
  { to: '/', label: 'Hoy', icon: LayoutDashboard },
  { to: '/nuevo', label: 'Nueva reserva', icon: PlusCircle },
  { to: '/dia', label: 'El día', icon: List },
  { to: '/embarque', label: 'Embarque', icon: Anchor },
  { to: '/cocina', label: 'Almuerzos', icon: ChefHat },
  { to: '/equipo', label: 'Lanchas y equipo', icon: Ship },
  { to: '/folios', label: 'Folios', icon: ClipboardList },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/informes', label: 'Informes', icon: BarChart2 },
  { to: '/config', label: 'Configuración', icon: Settings },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

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
      <header className="bg-gradient-to-r from-brand-900 via-[#2b3170] to-[#34418f] text-white sticky top-0 z-40 shadow-[0_4px_20px_rgba(30,32,69,.18)] pt-[env(safe-area-inset-top)]">
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

          <nav className="hidden 2xl:flex items-center gap-1 min-w-0">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={classNames(
                  'flex items-center gap-1.5 px-2.5 py-2 rounded-[10px] text-sm font-semibold whitespace-nowrap transition-colors',
                  location.pathname === to
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <IndicadorSync />
            <button
              onClick={handleLogout}
              className="hidden 2xl:flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white rounded-[10px] transition-colors"
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Cajón táctil: filas de 56px, se cierra al elegir o al tocar afuera. */}
      {mobileOpen && (
        <div className="2xl:hidden fixed inset-0 z-50 flex">
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
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={classNames(
                  'flex items-center gap-3.5 px-5 min-h-[56px] text-[15px] font-semibold transition-colors',
                  location.pathname === to
                    ? 'bg-white/20 text-white'
                    : 'text-white/75 hover:bg-white/10'
                )}
              >
                <Icon size={20} />
                {label}
              </Link>
            ))}
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
