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
const Configuracion = lazy(() => import('./pages/Configuracion'))
const Cocina = lazy(() => import('./pages/Cocina'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Reportes = lazy(() => import('./pages/Reportes'))
const Cartera = lazy(() => import('./pages/Cartera'))
const Clientes = lazy(() => import('./pages/Clientes'))
const Metas = lazy(() => import('./pages/Metas'))
const FichaPlan = lazy(() => import('./pages/FichaPlan'))
const Turnos = lazy(() => import('./pages/Turnos'))
const Mensajes = lazy(() => import('./pages/Mensajes'))
const Actividad = lazy(() => import('./pages/Actividad'))
const FichaCatalogo = lazy(() => import('./pages/FichaCatalogo'))

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
        {/* El sustantivo es «Reservas». `/dia` sigue respondiendo para no
            romper un enlace guardado ni un acceso directo del iPad. */}
        <Route
          path="/reservas"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ListadoDia />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/dia" element={<Navigate to="/reservas" replace />} />
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
        {/* La ficha de una persona tiene dirección propia: es a donde aterriza
            el buscador global, y una ventana no se puede compartir. */}
        <Route
          path="/clientes/:id"
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
        {/* Configuración es un contenedor: sin sección muestra su índice, con
            sección muestra lo suyo. */}
        <Route
          path="/config"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Configuracion />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/config/:seccion"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Configuracion />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* Los turnos son un calendario, no un catálogo: no pasan por `Config`.
            El mes va en la dirección para que «los turnos de septiembre» sea
            un enlace que se pueda mandar. */}
        <Route
          path="/config/turnos"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Turnos />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/config/turnos/:mes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Turnos />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* Destinatarios y mensajes: tampoco es un catálogo. Son dos textos y
            una lista de correos, y comparten pantalla porque responden la
            misma pregunta — a quién le llega qué. */}
        <Route
          path="/config/mensajes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Mensajes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* Las fichas de lancha, piloto y empleado cuelgan de Equipo, que es
            donde viven; la de temporada, de su sección. La pantalla es la
            misma: lo que cambia entre ellas está en `lib/fichasCatalogo.js`. */}
        <Route
          path="/equipo/:tipo/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <FichaCatalogo />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/config/temporadas/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <FichaCatalogo />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* La bitácora entera. Es la vista general de lo que las fichas
            muestran por registro. */}
        <Route
          path="/config/actividad"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Actividad />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        {/* La ficha de un plan: un registro con dirección propia, no una
            ventana emergente. Es el primero; van a seguir lancha, agencia y
            persona por el mismo camino. */}
        <Route
          path="/config/planes/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <FichaPlan />
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
