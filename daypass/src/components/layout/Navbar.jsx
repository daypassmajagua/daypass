import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase, isMock } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  PlusCircle,
  List,
  FileText,
  ClipboardList,
  History,
  Settings,
  LogOut,
  Waves,
  Menu,
  X,
  BarChart2,
} from 'lucide-react'
import { useState } from 'react'
import { classNames } from '../../lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/nuevo', label: 'Nuevo Registro', icon: PlusCircle },
  { to: '/dia', label: 'Listado del Día', icon: List },
  { to: '/tentativo', label: 'Tentativo', icon: FileText },
  { to: '/folios', label: 'Folios Zeus', icon: ClipboardList },
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
      {/* Top bar */}
      <header className="bg-blue-700 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Waves size={22} />
            <span className="font-bold text-lg tracking-tight">DayPASS</span>
            <span className="hidden md:block text-blue-300 text-sm ml-1">· Hotel San Pedro de Majagua</span>
            {isMock && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-bold uppercase tracking-wide">
                Modo demo
              </span>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={classNames(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === to
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-100 hover:bg-white/10 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              Salir
            </button>
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-white/10"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 pt-14">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <nav className="relative bg-blue-800 w-64 h-full shadow-xl flex flex-col py-4">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={classNames(
                  'flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors',
                  location.pathname === to
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10'
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            <div className="mt-auto border-t border-blue-700 pt-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-5 py-3 text-sm text-blue-100 hover:bg-white/10 w-full"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
