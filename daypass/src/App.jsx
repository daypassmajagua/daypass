import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import useAppStore from './store/useAppStore'
import { useSincronizarDia, usePresencia } from './hooks/useDiaOperativo'
import ProtectedRoute from './components/layout/ProtectedRoute'
import ProveedorModo from './components/layout/ProveedorModo'
import Navbar from './components/layout/Navbar'
import { Esqueleto } from './components/patrones'
import { escucharErrores } from './lib/diagnostico'

/**
 * ── Qué viaja de una y qué se trae cuando hace falta ────────────────────────
 *
 * Todo estaba en un solo archivo de 1,58 MB, así que **un cambio de una línea
 * obligaba a bajar 467 KB otra vez** — en el celular de la directora y en el
 * iPad del muelle, con la señal de La Bodeguita. Diez despliegues en un día
 * son diez descargas completas.
 *
 * Van de una las cuatro que se abren primero o sin red: el login, Hoy, y el
 * muelle y la isla, que son las que no pueden depender de nada.
 *
 * El resto llega cuando se pide. **Sin costo offline**: el service worker
 * precarga todos los trozos igual —su patrón de precarga toma todos los `.js`
 * del build— así que en el muelle ya están en el aparato antes de salir. Lo
 * que se gana es que al actualizar solo se vuelve a bajar lo que cambió.
 */
import Login from './pages/Login'
import Hoy from './pages/Hoy'
import Embarque from './pages/Embarque'
import Isla from './pages/Isla'

// Informes se lleva Recharts —la librería más pesada del proyecto— y la abre
// una persona una vez a la semana.
const Informes = lazy(() => import('./pages/Informes'))
// La página del cliente carga el generador de QR; y es la única que abre gente
// de afuera, en su propio celular y con sus propios datos.
const CheckInPublico = lazy(() => import('./pages/CheckInPublico'))
const Reserva = lazy(() => import('./pages/Reserva'))
const CerrarDia = lazy(() => import('./pages/CerrarDia'))
const Equipo = lazy(() => import('./pages/Equipo'))
const ListadoDia = lazy(() => import('./pages/ListadoDia'))
const Folios = lazy(() => import('./pages/Folios'))
const Historial = lazy(() => import('./pages/Historial'))
const Config = lazy(() => import('./pages/Config'))
const Cocina = lazy(() => import('./pages/Cocina'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Reportes = lazy(() => import('./pages/Reportes'))
const Cartera = lazy(() => import('./pages/Cartera'))
const Clientes = lazy(() => import('./pages/Clientes'))
const Metas = lazy(() => import('./pages/Metas'))

// Desde el arranque: un error que ocurre antes de que alguien piense en
// reportarlo es justamente el que hay que poder contar después.
escucharErrores()

/** Lo que se ve el instante que tarda un trozo en llegar. Nunca una pantalla en blanco. */
function Trayendo() {
  return <div className="max-w-4xl mx-auto px-4 py-6"><Esqueleto filas={4} /></div>
}

function AppLayout({ children }) {
  // Una sola suscripción al día y a la presencia para toda la app.
  const fechaActiva = useAppStore(s => s.fechaActiva)
  useSincronizarDia(fechaActiva)
  usePresencia('oficina')

  return (
    <div className="min-h-screen bg-fondo">
      <Navbar />
      {/* Espacio para el indicador de inicio del iPad. */}
      <main className="py-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    // El modo —oficina, muelle o isla— envuelve todo, incluida la página del
    // cliente: un iPad configurado como muelle abre siempre así, sin importar
    // quién inicie sesión.
    <ProveedorModo>
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Suspense fallback={<Trayendo />}>
      <Routes>
        {/* La página del cliente: fuera del login, sin marco de la app. */}
        <Route path="/r/:token" element={<CheckInPublico />} />

        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Hoy />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nuevo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Reserva />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/editar/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Reserva />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* El muelle no lleva el marco de la oficina: pantalla completa,
            alto contraste y objetivos grandes. */}
        <Route
          path="/embarque"
          element={
            <ProtectedRoute>
              <Embarque />
            </ProtectedRoute>
          }
        />
        {/* Como el muelle: sin AppLayout. La isla se usa de pie y con una
            mano, y la barra de la oficina solo estorba. */}
        <Route
          path="/isla"
          element={
            <ProtectedRoute>
              <Isla />
            </ProtectedRoute>
          }
        />
        <Route
          path="/equipo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Equipo />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cerrar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CerrarDia />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cocina"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Cocina />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dia"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ListadoDia />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/folios"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Folios />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/historial"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Historial />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/informes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Informes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Usuarios />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cartera"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Cartera />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/metas"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Metas />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Clientes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Reportes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/config"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Config />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ProveedorModo>
  )
}
