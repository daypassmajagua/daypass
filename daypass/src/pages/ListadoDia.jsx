import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, PlusCircle, Edit2, Trash2,
  AlertTriangle, CheckCircle2, Filter
} from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import {
  formatCurrency, formatDate, aFechaLocal,
  ESTADO_LABELS, FORMA_PAGO_LABELS, IMPUESTOS_LABELS
} from '../lib/utils'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/layout/PageHeader'
import { supabase } from '../lib/supabase'

const ESTADOS = ['tentativa', 'confirmada', 'en_isla', 'completada', 'noshow', 'cancelada']

export default function ListadoDia() {
  const navigate = useNavigate()
  const {
    fechaActiva, setFechaActiva,
    filtroLancha, setFiltroLancha,
    filtroEstado, setFiltroEstado,
    filtroCanal, setFiltroCanal,
  } = useAppStore()

  const { registros, loading, updateRegistro, deleteRegistro, refetch } = useRegistros(fechaActiva)

  const [editingFolio, setEditingFolio] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

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
      toast.error('Debes ingresar el número de folio Zeus antes de completar este registro.')
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
    if (error) toast.error('Error al eliminar')
    else toast.success('Registro eliminado')
    setDeletingId(null)
  }

  function prevDay() {
    const d = new Date(fechaActiva + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    setFechaActiva(aFechaLocal(d))
  }
  function nextDay() {
    const d = new Date(fechaActiva + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    setFechaActiva(aFechaLocal(d))
  }

  const totalPax = filtered
    .filter(r => !['cancelada', 'noshow'].includes(r.estado))
    .reduce((s, r) => s + r.adultos + r.ninos, 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        title="Listado del Día"
        subtitle={formatDate(fechaActiva)}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm">
              <button onClick={prevDay} className="p-2 hover:bg-gray-50 rounded-l-lg"><ChevronLeft size={16} /></button>
              <input
                type="date"
                value={fechaActiva}
                onChange={e => setFechaActiva(e.target.value)}
                className="text-sm border-0 outline-none bg-transparent px-2 py-1.5 text-gray-700"
              />
              <button onClick={nextDay} className="p-2 hover:bg-gray-50 rounded-r-lg"><ChevronRight size={16} /></button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={14} />
              Filtros
            </Button>
            <Button size="sm" onClick={() => navigate('/nuevo')}>
              <PlusCircle size={14} />
              Nuevo
            </Button>
          </div>
        }
      />

      {/* Resumen rápido */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <span><b className="text-gray-900">{filtered.length}</b> registros</span>
        <span>·</span>
        <span><b className="text-gray-900">{totalPax}</b> personas</span>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card className="p-4 mb-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Lancha</label>
              <select
                value={filtroLancha}
                onChange={e => setFiltroLancha(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todas</option>
                {lanchas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Estado</label>
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todos</option>
                {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Canal</label>
              <select
                value={filtroCanal}
                onChange={e => setFiltroCanal(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">Todos</option>
                {canales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
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
          <p className="text-gray-500">Sin registros para este día</p>
          <Button className="mt-4" onClick={() => navigate('/nuevo')}>
            <PlusCircle size={16} />
            Nuevo Registro
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
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pasajero</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Pax</th>
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
                            <select
                              value={r.estado}
                              onChange={e => handleEstadoChange(r.id, e.target.value, r)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                            >
                              {ESTADOS.map(e => (
                                <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                              ))}
                            </select>
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

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {regs.map(r => (
                    <div key={r.id} className="p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{r.nombre_pasajero}</p>
                          {r.nombre_grupo && <p className="text-xs text-gray-400">{r.nombre_grupo}</p>}
                        </div>
                        <Badge estado={r.estado} />
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{r.planes?.nombre}</span>
                        <span className="font-bold text-gray-900">{formatCurrency(r.total_calculado)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{r.adultos}A {r.ninos > 0 ? r.ninos+'N' : ''}</span>
                        <span>{r.forma_pago ? FORMA_PAGO_LABELS[r.forma_pago] : '⚠ Sin pago'}</span>
                        <span>Imp: {IMPUESTOS_LABELS[r.impuestos_puerto]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={r.estado}
                          onChange={e => handleEstadoChange(r.id, e.target.value, r)}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                        >
                          {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                        </select>
                        <button onClick={() => navigate(`/editar/${r.id}`)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeletingId(r.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(deletingId)} onClose={() => setDeletingId(null)} title="Eliminar registro">
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
