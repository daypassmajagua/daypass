import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isMock } from '../lib/supabase'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import logoAzul from '../assets/logo-azul.png'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Credenciales incorrectas')
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <img src={logoAzul} alt="Hotel San Pedro de Majagua" className="h-32 w-auto mb-3" />
            <h1 className="text-2xl font-bold text-brand-900 tracking-tight">DayPASS</h1>
          </div>

          {isMock && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs text-amber-800 text-center">
              <span className="font-bold uppercase">Modo demo</span> — datos de muestra, sin conexión a Supabase.
              Cualquier credencial funciona.
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com"
              required
              autoComplete="email"
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar la contraseña' : 'Ver la contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} size="lg" className="mt-2 w-full">
              Ingresar
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            ¿Sin acceso? Contacta a tu administrador.
          </p>
        </div>
      </div>
    </div>
  )
}
