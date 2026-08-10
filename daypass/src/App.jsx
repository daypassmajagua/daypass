import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import useAppStore from './store/useAppStore'
import { useSincronizarDia, usePresencia } from './hooks/useDiaOperativo'
import ProtectedRoute from './components/layout/ProtectedRoute'
import ProveedorModo from './components/layout/ProveedorModo'
import Navbar from './components/layout/Navbar'
import Login from './pages/Login'
import CheckInPublico from './pages/CheckInPublico'
import Hoy from './pages/Hoy'
import Reserva from './pages/Reserva'
import CerrarDia from './pages/CerrarDia'
import Embarque from './pages/Embarque'
import Equipo from './pages/Equipo'
import ListadoDia from './pages/ListadoDia'
import Folios from './pages/Folios'
import Historial from './pages/Historial'
import Informes from './pages/Informes'
import Config from './pages/Config'
import Cocina from './pages/Cocina'
import Isla from './pages/Isla'
import Usuarios from './pages/Usuarios'
import Reportes from './pages/Reportes'
import Cartera from './pages/Cartera'
import { escucharErrores } from './lib/diagnostico'

// Desde el arranque: un error que ocurre antes de que alguien piense en
// reportarlo es justamente el que hay que poder contar después.
escucharErrores()

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
    </BrowserRouter>
    </ProveedorModo>
  )
}
