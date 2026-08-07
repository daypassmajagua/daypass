import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Navbar from './components/layout/Navbar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NuevoRegistro from './pages/NuevoRegistro'
import ListadoDia from './pages/ListadoDia'
import Tentativo from './pages/Tentativo'
import Folios from './pages/Folios'
import Historial from './pages/Historial'
import Informes from './pages/Informes'
import Config from './pages/Config'

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="py-2">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nuevo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <NuevoRegistro />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/editar/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <NuevoRegistro />
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
          path="/tentativo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Tentativo />
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
  )
}
