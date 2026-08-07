import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Users, TrendingUp, AlertCircle, Ship, BarChart2, PlusCircle, Lock, TriangleAlert
} from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { formatCurrency, formatDate, hoyLocal, plural } from '../lib/utils'
import Card from '../components/ui/Card'
import DateNav from '../components/ui/DateNav'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/layout/PageHeader'
import FranjaDia from '../components/layout/FranjaDia'
import Button from '../components/ui/Button'
import {
  useDiaOperativo, useRegistrosEnVivo, cerrarTentativo,
} from '../hooks/useDiaOperativo'

export default function Dashboard() {
  const { fechaActiva, setFechaActiva } = useAppStore()
  const { registros, loading, refetch } = useRegistros(fechaActiva)
  const navigate = useNavigate()

  const { enPlaneacion } = useDiaOperativo(fechaActiva)
  useRegistrosEnVivo(fechaActiva, refetch)

  const [confirmandoCierre, setConfirmandoCierre] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  // Cambiaron después de que la cocina y la isla ya tenían la lista.
  const tardios = useMemo(() => registros.filter(r => r.cambio_tardio), [registros])

  async function confirmarCierre() {
    setCerrando(true)
    const { error } = await cerrarTentativo(fechaActiva)
    setCerrando(false)
    setConfirmandoCierre(false)
    if (error) {
      toast.error('No se pudo cerrar el tentativo. ' + error.message)
    } else {
      toast.success('Tentativo cerrado. Las reservas tentativas quedaron confirmadas.')
      await refetch()   // el día llega solo por la suscripción
    }
  }

  const activos = useMemo(() =>
    registros.filter(r => !['cancelada', 'noshow', 'tentativa'].includes(r.estado)),
    [registros]
  )
  const tentativas = useMemo(() =>
    registros.filter(r => r.estado === 'tentativa'),
    [registros]
  )
  const confirmados = useMemo(() =>
    registros.filter(r => r.estado === 'confirmada' || r.estado === 'en_isla' || r.estado === 'completada'),
    [registros]
  )

  const totalPersonasActivas = useMemo(() =>
    activos.reduce((s, r) => s + r.adultos + r.ninos, 0),
    [activos]
  )
  const totalPersonasTentativa = useMemo(() =>
    tentativas.reduce((s, r) => s + r.adultos + r.ninos, 0),
    [tentativas]
  )
  const totalGrupos = useMemo(() => activos.filter(r => r.tipo === 'grupo').length, [activos])
  const totalIndividuales = useMemo(() => activos.filter(r => r.tipo === 'individual').length, [activos])
  const ingresosProyectados = useMemo(() =>
    confirmados.reduce((s, r) => s + (r.total_calculado || 0), 0),
    [confirmados]
  )

  // Distribución por lancha
  const lanchaMap = useMemo(() => {
    const map = {}
    activos.forEach(r => {
      if (!r.lanchas) return
      const key = r.lanchas.id
      if (!map[key]) map[key] = { lancha: r.lanchas, pax: 0 }
      map[key].pax += r.adultos + r.ninos
    })
    return Object.values(map).sort((a, b) => b.pax - a.pax)
  }, [activos])

  // Mix de canales
  const canalMap = useMemo(() => {
    const map = {}
    activos.forEach(r => {
      if (!r.canales) return
      const key = r.canales.id
      if (!map[key]) map[key] = { canal: r.canales, pax: 0 }
      map[key].pax += r.adultos + r.ninos
    })
    return Object.values(map).sort((a, b) => b.pax - a.pax)
  }, [activos])

  // Alertas operativas
  const sinFolio = useMemo(() =>
    activos.filter(r => !r.folio_zeus && r.estado !== 'cancelada'),
    [activos]
  )
  const sinPago = useMemo(() =>
    activos.filter(r => !r.forma_pago),
    [activos]
  )
  const sinImpuestos = useMemo(() =>
    activos.filter(r => r.impuestos_puerto === 'no'),
    [activos]
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <FranjaDia />
      <PageHeader
        title="Hoy"
        subtitle={formatDate(fechaActiva)}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DateNav value={fechaActiva} onChange={setFechaActiva} />
            {fechaActiva !== hoyLocal() && (
              <Button variant="ghost" size="sm" onClick={() => setFechaActiva(hoyLocal())}>
                Ir a hoy
              </Button>
            )}
            {enPlaneacion && registros.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setConfirmandoCierre(true)}>
                <Lock size={16} />
                Cerrar el tentativo
              </Button>
            )}
            <Button size="sm" onClick={() => navigate('/nuevo')}>
              <PlusCircle size={16} />
              Nueva reserva
            </Button>
          </div>
        }
      />

      {/* La cocina y la isla ya trabajaron con la versión anterior. */}
      {tardios.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-coral-50 px-4 py-3 mb-5">
          <TriangleAlert size={18} className="text-coral-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold text-coral-700 text-[15px]">
              {plural(tardios.length, 'reserva cambió', 'reservas cambiaron')} después del cierre
            </p>
            <p className="text-sm text-coral-700/85">
              La cocina y la isla tienen la versión anterior. Avísales de:{' '}
              {tardios.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ', '}
                  <Link to={`/editar/${r.id}`} className="font-bold underline">
                    {r.nombre_grupo || r.nombre_pasajero}
                  </Link>
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-sm">Cargando...</div>
        </div>
      ) : (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Personas Confirmadas</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{totalPersonasActivas}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {activos.filter(r=>r.tipo==='individual').reduce((s,r)=>s+r.adultos+r.ninos,0)} pax individuales
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Users size={20} className="text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Tentativas</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{totalPersonasTentativa}</p>
                  <p className="text-xs text-gray-400 mt-1">{plural(tentativas.length, 'reserva', 'reservas')}</p>
                </div>
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                  <Users size={20} className="text-gray-500" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Grupos / Individuales</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {totalGrupos}<span className="text-gray-400 font-normal text-xl"> / </span>{totalIndividuales}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{activos.length} reservas activas</p>
                </div>
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <BarChart2 size={20} className="text-purple-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ingresos Proyectados</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(ingresosProyectados)}</p>
                  <p className="text-xs text-gray-400 mt-1">reservas confirmadas</p>
                </div>
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <TrendingUp size={20} className="text-emerald-600" />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Distribución por lancha */}
            <Card className="p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Ship size={16} className="text-blue-500" />
                Distribución por Lancha
              </h2>
              {lanchaMap.length === 0 ? (
                <p className="text-sm text-tinta-2 text-center py-4">Sin reservas</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {lanchaMap.map(({ lancha, pax }) => {
                    const capacidad = lancha.capacidad || 50
                    const pct = Math.min(Math.round((pax / capacidad) * 100), 100)
                    return (
                      <div key={lancha.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{lancha.nombre}</span>
                          <span className="text-gray-500">{pax} / {capacidad} pax</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-orange-400' : 'bg-blue-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Mix de canales */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-purple-500" />
                Por canal de venta
              </h2>
              {canalMap.length === 0 ? (
                <p className="text-sm text-tinta-2 text-center py-4">Sin reservas</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {canalMap.map(({ canal, pax }) => {
                    const total = canalMap.reduce((s, c) => s + c.pax, 0)
                    const pct = total > 0 ? Math.round((pax / total) * 100) : 0
                    return (
                      <div key={canal.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 truncate max-w-[140px]">{canal.codigo}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{pax}</span>
                          <span className="text-gray-400 text-xs w-10 text-right">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Alertas operativas */}
          {(sinFolio.length > 0 || sinPago.length > 0 || sinImpuestos.length > 0) && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-500" />
                Lo que falta
              </h2>
              <div className="flex flex-col gap-3">
                {sinFolio.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-orange-700 mb-1">
                      Sin folio Zeus ({sinFolio.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sinFolio.map(r => (
                        <Link
                          key={r.id}
                          to={`/dia`}
                          className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded-lg hover:bg-orange-100 transition-colors"
                        >
                          {r.nombre_pasajero}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {sinPago.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-700 mb-1">
                      Sin forma de pago ({sinPago.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sinPago.map(r => (
                        <Link
                          key={r.id}
                          to={`/dia`}
                          className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded-lg hover:bg-yellow-100 transition-colors"
                        >
                          {r.nombre_pasajero}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {sinImpuestos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-1">
                      Impuestos NO pagados ({sinImpuestos.length}) — cobrar en muelle
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sinImpuestos.map(r => (
                        <Link
                          key={r.id}
                          to={`/dia`}
                          className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          {r.nombre_pasajero}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {registros.length === 0 && (
            <Card className="p-12 text-center">
              <Ship size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-tinta-2 font-bold">
                Todavía no hay reservas para el {formatDate(fechaActiva)}
              </p>
              <Button className="mt-4" onClick={() => navigate('/nuevo')}>
                <PlusCircle size={16} />
                Crear la primera
              </Button>
            </Card>
          )}
        </>
      )}

      {/* Cerrar el tentativo sí confirma: dispara cocina y folios. */}
      <Modal
        open={confirmandoCierre}
        onClose={() => setConfirmandoCierre(false)}
        title="Cerrar el tentativo"
      >
        <p className="text-[15px] text-tinta">
          Vas a cerrar el tentativo del <b className="first-letter:uppercase">{formatDate(fechaActiva)}</b>.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-tinta-2">
          <li>· Las {plural(tentativas.length, 'reserva tentativa pasa', 'reservas tentativas pasan')} a confirmada.</li>
          <li>· A partir de ahí, cualquier cambio queda marcado como tardío.</li>
          <li>· La cocina y la isla trabajan sobre esta versión.</li>
        </ul>
        {(sinFolio.length > 0 || sinPago.length > 0) && (
          <p className="mt-3 text-sm text-coral-700 bg-coral-50 rounded-xl px-3 py-2">
            Quedan pendientes: {sinFolio.length > 0 && `${plural(sinFolio.length, 'reserva sin folio', 'reservas sin folio')}`}
            {sinFolio.length > 0 && sinPago.length > 0 && ' y '}
            {sinPago.length > 0 && `${plural(sinPago.length, 'reserva sin pago', 'reservas sin pago')}`}.
            Puedes cerrar igual y resolverlos después.
          </p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setConfirmandoCierre(false)}>
            Todavía no
          </Button>
          <Button onClick={confirmarCierre} loading={cerrando}>
            <Lock size={16} />
            Cerrar el tentativo
          </Button>
        </div>
      </Modal>
    </div>
  )
}
