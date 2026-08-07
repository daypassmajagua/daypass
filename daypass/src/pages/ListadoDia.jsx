import { useState, useMemo, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  PlusCircle, Edit2, Trash2,
  AlertTriangle, CheckCircle2, Filter
} from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import {
  formatCurrency, formatDate, classNames, plural,
  ESTADO_LABELS, FORMA_PAGO_LABELS, IMPUESTOS_LABELS
} from '../lib/utils'
import { contarPorRegistro } from '../hooks/usePasajeros'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import DateNav from '../components/ui/DateNav'
import PageHeader from '../components/layout/PageHeader'

const ESTADOS = ['tentativa', 'confirmada', 'en_isla', 'completada', 'noshow', 'cancelada']

/**
 * Cuántos nombres tiene la reserva contra lo planeado. Coral cuando faltan:
 * es un pendiente, no un error — los listados llegan tarde y eso es normal.
 */
function ContadorNombres({ registro, conteo }) {
  const plan = registro.adultos + registro.ninos + registro.infantes + registro.cortesias
  if (conteo >= plan && plan > 0) {
    return <span className="text-verde-500 font-bold text-xs tabular">{conteo}/{plan}</span>
  }
  return (
    <Link
      to={`/editar/${registro.id}`}
      className={classNames(
        'inline-block rounded-lg px-2 py-0.5 text-xs font-bold tabular',
        conteo === 0 ? 'bg-coral-50 text-coral-600' : 'bg-coral-50 text-coral-600'
      )}
      title="Agregar los nombres de esta reserva"
    >
      {conteo}/{plan}
    </Link>
  )
}

export default function ListadoDia() {
  const navigate = useNavigate()
  const {
    fechaActiva, setFechaActiva,
    filtroLancha, setFiltroLancha,
    filtroEstado, setFiltroEstado,
    filtroCanal, setFiltroCanal,
  } = useAppStore()

  const { registros, loading, updateRegistro, deleteRegistro } = useRegistros(fechaActiva)

  const [editingFolio, setEditingFolio] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [nombres, setNombres] = useState({})

  useEffect(() => {
    let vigente = true
    contarPorRegistro(registros.map(r => r.id))
      .then(conteo => { if (vigente) setNombres(conteo) })
    return () => { vigente = false }
  }, [registros])

  const lanchas = useMemo(() => {
    const map = {}
    registros.forEach(r => { if (r.lanchas) map[r.lanchas.id] = r.lanchas })
    return Object.values(map)
  }, [registros])

  const canales = useMemo(() => {
    const map = {}
    registros.forEach(r => { if (r.canales) map[r.canales.id] = r.canales })
    return Object.values(map)
  }, [registros])

  const filtered = useMemo(() =>
    registros.filter(r => {
      if (filtroLancha && r.lancha_id !== filtroLancha) return false
      if (filtroEstado && r.estado !== filtroEstado) return false
      if (filtroCanal && r.canal_id !== filtroCanal) return false
      return true
    }),
    [registros, filtroLancha, filtroEstado, filtroCanal]
  )

  const byLancha = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const key = r.lanchas?.nombre || 'Sin lancha'
      if (!map[key]) map[key] = []
      map[key].push(r)
    })
    return map
  }, [filtered])

  async function handleEstadoChange(id, newEstado, registro) {
    if (newEstado === 'completada' && !registro.folio_zeus) {
      toast.error('Escribe el folio Zeus antes de dar esta reserva por completada.')
      return
    }
    const { error } = await updateRegistro(id, { estado: newEstado })
    if (error) toast.error('Error al cambiar estado')
    else toast.success(`Estado → ${ESTADO_LABELS[newEstado]}`)
  }

  async function handleFolioSave(id, folio) {
    const { error } = await updateRegistro(id, { folio_zeus: folio })
    if (error) toast.error('Error al guardar folio')
    else {
      toast.success('Folio guardado')
      setEditingFolio(prev => ({ ...prev, [id]: undefined }))
    }
  }

  async function handleDelete(id) {
    const { error } = await deleteRegistro(id)
    if (error) toast.error('No se pudo eliminar la reserva. Inténtalo otra vez.')
    else toast.success('Reserva eliminada')
    setDeletingId(null)
  }

  const totalPax = filtered
    .filter(r => !['cancelada', 'noshow'].includes(r.estado))
    .reduce((s, r) => s + r.adultos + r.ninos, 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        title="Listado del día"
        subtitle={formatDate(fechaActiva)}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DateNav value={fechaActiva} onChange={setFechaActiva} />
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={14} />
              Filtros
            </Button>
            <Button size="sm" onClick={() => navigate('/nuevo')}>
              <PlusCircle size={16} />
              Nueva reserva
            </Button>
          </div>
        }
      />

      {/* Resumen rápido */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <span><b className="text-tinta">{filtered.length}</b> {filtered.length === 1 ? 'reserva' : 'reservas'}</span>
        <span>·</span>
        <span><b className="text-gray-900">{totalPax}</b> personas</span>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card className="p-4 mb-4">
          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Lancha"
              value={filtroLancha}
              onChange={setFiltroLancha}
              options={[
                { value: '', label: 'Todas' },
                ...lanchas.map(l => ({ value: l.id, label: l.nombre })),
              ]}
            />
            <Select
              label="Estado"
              value={filtroEstado}
              onChange={setFiltroEstado}
              options={[
                { value: '', label: 'Todos' },
                ...ESTADOS.map(e => ({ value: e, label: ESTADO_LABELS[e] })),
              ]}
            />
            <Select
              label="Canal"
              value={filtroCanal}
              onChange={setFiltroCanal}
              options={[
                { value: '', label: 'Todos' },
                ...canales.map(c => ({ value: c.id, label: c.nombre })),
              ]}
            />
          </div>
          <button
            onClick={() => { setFiltroLancha(''); setFiltroEstado(''); setFiltroCanal('') }}
            className="text-xs text-blue-600 hover:underline mt-2"
          >
            Limpiar filtros
          </button>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-tinta-2">Todavía no hay reservas para este día</p>
          <Button className="mt-4" onClick={() => navigate('/nuevo')}>
            <PlusCircle size={16} />
            Crear la primera
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(byLancha).map(([nombreLancha, regs]) => (
            <div key={nombreLancha}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{nombreLancha}</h2>
                <span className="text-xs text-gray-400">
                  {regs.filter(r=>!['cancelada','noshow'].includes(r.estado)).reduce((s,r)=>s+r.adultos+r.ninos,0)} pax
                </span>
              </div>

              <Card>
                {/* Desktop table */}
                {/* Tabla completa solo desde 1280px. En iPad —768 vertical y
                    1024 horizontal— las tarjetas de abajo son más operables
                    que diez columnas apretadas. */}
                <div className="hidden xl:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pasajero</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Pax</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Nombres</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Pago</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Imp.</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Folio Zeus</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {regs.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 flex items-center gap-1.5">
                              {r.tipo === 'grupo' && (
                                <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-medium">GRP</span>
                              )}
                              {r.nombre_pasajero}
                            </div>
                            {r.nombre_grupo && <div className="text-xs text-gray-400 mt-0.5">{r.nombre_grupo}</div>}
                            {r.agencia_nombre && <div className="text-xs text-gray-400">{r.agencia_nombre}</div>}
                          </td>
                          <td className="px-3 py-3 text-gray-600 text-xs">{r.planes?.nombre || '—'}</td>
                          <td className="px-3 py-3 text-center">
                            <span className="font-medium">{r.adultos}</span>
                            {r.ninos > 0 && <span className="text-gray-400 text-xs ml-1">+{r.ninos}n</span>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ContadorNombres registro={r} conteo={nombres[r.id] || 0} />
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-gray-900">
                            {formatCurrency(r.total_calculado)}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600">
                            {r.forma_pago ? FORMA_PAGO_LABELS[r.forma_pago] : (
                              <span className="text-orange-500 flex items-center gap-1">
                                <AlertTriangle size={12} /> Sin pago
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              r.impuestos_puerto === 'si' ? 'bg-green-100 text-green-700' :
                              r.impuestos_puerto === 'no' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {IMPUESTOS_LABELS[r.impuestos_puerto]}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <Select
                              size="sm"
                              value={r.estado}
                              onChange={v => handleEstadoChange(r.id, v, r)}
                              options={ESTADOS.map(e => ({ value: e, label: ESTADO_LABELS[e] }))}
                              className="w-32"
                            />
                          </td>
                          <td className="px-3 py-3">
                            {editingFolio[r.id] !== undefined ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingFolio[r.id]}
                                  onChange={e => setEditingFolio(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  className="w-24 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleFolioSave(r.id, editingFolio[r.id])
                                    if (e.key === 'Escape') setEditingFolio(prev => ({ ...prev, [r.id]: undefined }))
                                  }}
                                />
                                <button
                                  onClick={() => handleFolioSave(r.id, editingFolio[r.id])}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingFolio(prev => ({ ...prev, [r.id]: r.folio_zeus || '' }))}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  r.folio_zeus
                                    ? 'font-mono text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-orange-500 bg-orange-50 hover:bg-orange-100 flex items-center gap-1'
                                }`}
                              >
                                {r.folio_zeus || (
                                  <><AlertTriangle size={11} /> Sin folio</>
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => navigate(`/editar/${r.id}`)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => setDeletingId(r.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tarjetas: móvil e iPad. Dos por fila en horizontal. */}
                <div className="xl:hidden divide-y divide-linea lg:divide-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:p-3">
                  {regs.map(r => {
                    const plan = r.adultos + r.ninos + r.infantes + r.cortesias
                    const conNombre = nombres[r.id] || 0
                    return (
                      <div key={r.id} className="bg-white p-4 lg:rounded-xl lg:ring-1 lg:ring-linea flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-[15px] text-tinta truncate">{r.nombre_pasajero}</p>
                            {r.nombre_grupo && <p className="text-[13px] text-tinta-2 truncate">{r.nombre_grupo}</p>}
                            {r.agencia_nombre && <p className="text-[13px] text-tinta-2 truncate">{r.agencia_nombre}</p>}
                          </div>
                          <Badge estado={r.estado} className="shrink-0" />
                        </div>

                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-tinta-2 truncate">{r.planes?.nombre || '—'}</span>
                          <span className="font-bold text-tinta tabular shrink-0">
                            {formatCurrency(r.total_calculado)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-[13px]">
                          <span className="tabular text-tinta-2">
                            {plural(r.adultos, 'adulto', 'adultos')}
                            {r.ninos > 0 ? ` · ${plural(r.ninos, 'niño', 'niños')}` : ''}
                          </span>
                          <span className="text-linea">·</span>
                          {conNombre >= plan && plan > 0 ? (
                            <span className="text-verde-500 font-bold tabular">{conNombre}/{plan} nombres</span>
                          ) : (
                            <Link
                              to={`/editar/${r.id}`}
                              className="rounded-lg bg-coral-50 text-coral-600 font-bold px-2 py-0.5 tabular"
                            >
                              {conNombre}/{plan} nombres
                            </Link>
                          )}
                          {!r.forma_pago && (
                            <>
                              <span className="text-linea">·</span>
                              <span className="text-coral-600 font-bold">Sin pago</span>
                            </>
                          )}
                          {!r.folio_zeus && (
                            <>
                              <span className="text-linea">·</span>
                              <span className="text-coral-600 font-bold">Sin folio</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={r.estado}
                            onChange={v => handleEstadoChange(r.id, v, r)}
                            options={ESTADOS.map(e => ({ value: e, label: ESTADO_LABELS[e] }))}
                            className="flex-1"
                          />
                          <button
                            onClick={() => navigate(`/editar/${r.id}`)}
                            className="icono-tactil w-11 h-11 flex items-center justify-center shrink-0 text-blue-700 bg-blue-50 rounded-xl"
                            aria-label={`Editar la reserva de ${r.nombre_pasajero}`}
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => setDeletingId(r.id)}
                            className="icono-tactil w-11 h-11 flex items-center justify-center shrink-0 text-tinta-2 bg-fondo rounded-xl"
                            aria-label={`Eliminar la reserva de ${r.nombre_pasajero}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(deletingId)} onClose={() => setDeletingId(null)} title="Eliminar la reserva">
        <p className="text-sm text-gray-600 mb-4">
          ¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(deletingId)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
