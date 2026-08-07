import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import DatePicker from '../components/ui/DatePicker'
import PageHeader from '../components/layout/PageHeader'
import Modal from '../components/ui/Modal'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Settings } from 'lucide-react'

const TABS = ['Planes', 'Lanchas', 'Temporadas', 'Agencias']

export default function Config() {
  const [tab, setTab] = useState('Planes')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, item: null })
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null })

  useEffect(() => {
    fetchData()
  }, [tab])

  async function fetchData() {
    setLoading(true)
    const table = tab === 'Planes' ? 'planes' : tab === 'Lanchas' ? 'lanchas' : tab === 'Temporadas' ? 'temporadas' : 'agencias'
    const { data: d } = await supabase.from(table).select('*').order(tab === 'Temporadas' ? 'fecha_inicio' : 'nombre')
    setData(d || [])
    setLoading(false)
  }

  async function toggleActivo(id, current) {
    const table = tab === 'Lanchas' ? 'lanchas' : tab === 'Planes' ? 'planes' : 'agencias'
    await supabase.from(table).update({ activo: !current, activa: !current }).eq('id', id)
    fetchData()
    toast.success('Actualizado')
  }

  async function handleDelete(id) {
    const table = tab === 'Planes' ? 'planes' : tab === 'Lanchas' ? 'lanchas' : tab === 'Temporadas' ? 'temporadas' : 'agencias'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) toast.error('Error al eliminar: ' + error.message)
    else { toast.success('Eliminado'); fetchData() }
    setDeleteModal({ open: false, id: null })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        title="Configuración"
        subtitle="Gestión de catálogos del sistema"
        actions={
          <Button size="sm" onClick={() => setModal({ open: true, item: null })}>
            <Plus size={14} />
            Nuevo {tab.slice(0, -1)}
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <Card>
          {tab === 'Planes' && <PlanesTable data={data} onEdit={item => setModal({ open: true, item })} onDelete={id => setDeleteModal({ open: true, id })} onToggle={toggleActivo} />}
          {tab === 'Lanchas' && <LanchasTable data={data} onEdit={item => setModal({ open: true, item })} onDelete={id => setDeleteModal({ open: true, id })} onToggle={toggleActivo} />}
          {tab === 'Temporadas' && <TemporadasTable data={data} onEdit={item => setModal({ open: true, item })} onDelete={id => setDeleteModal({ open: true, id })} />}
          {tab === 'Agencias' && <AgenciasTable data={data} onEdit={item => setModal({ open: true, item })} onDelete={id => setDeleteModal({ open: true, id })} onToggle={toggleActivo} />}
        </Card>
      )}

      {/* Edit/Create Modal */}
      {modal.open && (
        <EditModal
          tab={tab}
          item={modal.item}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => { fetchData(); setModal({ open: false, item: null }) }}
        />
      )}

      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null })} title="Confirmar eliminación">
        <p className="text-sm text-gray-600 mb-4">¿Estás seguro de que deseas eliminar este elemento?</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteModal({ open: false, id: null })}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(deleteModal.id)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}

function PlanesTable({ data, onEdit, onDelete, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoría</th>
            <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">P.Adulto Baja</th>
            <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">P.Adulto Alta</th>
            <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">P.Niño Baja</th>
            <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">P.Niño Alta</th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Activo</th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(p => (
            <tr key={p.id} className={`hover:bg-gray-50 ${!p.activo ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{p.categoria}{p.nivel && p.nivel !== 'na' ? ` · ${p.nivel}` : ''}</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{formatCurrency(p.precio_adulto_baja)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{formatCurrency(p.precio_adulto_alta)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{formatCurrency(p.precio_nino_baja)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs">{formatCurrency(p.precio_nino_alta)}</td>
              <td className="px-3 py-3 text-center">
                <button onClick={() => onToggle(p.id, p.activo)}>
                  {p.activo ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-gray-400" />}
                </button>
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  <button onClick={() => onEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit2 size={14} /></button>
                  <button onClick={() => onDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LanchasTable({ data, onEdit, onDelete, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Capacidad</th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Activa</th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(l => (
            <tr key={l.id} className={`hover:bg-gray-50 ${!l.activa ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 font-mono text-xs text-gray-600">{l.codigo}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{l.nombre}</td>
              <td className="px-3 py-3 text-center text-gray-600">{l.capacidad || '—'}</td>
              <td className="px-3 py-3 text-center">
                <button onClick={() => onToggle(l.id, l.activa)}>
                  {l.activa ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-gray-400" />}
                </button>
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  <button onClick={() => onEdit(l)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit2 size={14} /></button>
                  <button onClick={() => onDelete(l.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TemporadasTable({ data, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Inicio</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Fin</th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(t => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{t.nombre}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  t.tipo === 'alta' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {t.tipo.toUpperCase()}
                </span>
              </td>
              <td className="px-3 py-3 font-mono text-xs text-gray-600">{t.fecha_inicio}</td>
              <td className="px-3 py-3 font-mono text-xs text-gray-600">{t.fecha_fin}</td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  <button onClick={() => onEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit2 size={14} /></button>
                  <button onClick={() => onDelete(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AgenciasTable({ data, onEdit, onDelete, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contacto</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Activa</th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map(a => (
            <tr key={a.id} className={`hover:bg-gray-50 ${!a.activa ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 font-medium text-gray-900">{a.nombre}</td>
              <td className="px-4 py-3 text-gray-600 text-xs">{a.contacto || '—'}</td>
              <td className="px-3 py-3 text-gray-600 text-xs">{a.email || '—'}</td>
              <td className="px-3 py-3 text-center">
                <button onClick={() => onToggle(a.id, a.activa)}>
                  {a.activa ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-gray-400" />}
                </button>
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  <button onClick={() => onEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit2 size={14} /></button>
                  <button onClick={() => onDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EditModal({ tab, item, onClose, onSaved }) {
  const isEdit = Boolean(item?.id)
  const [form, setForm] = useState(item || {})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function save() {
    setSaving(true)
    const table = tab === 'Planes' ? 'planes' : tab === 'Lanchas' ? 'lanchas' : tab === 'Temporadas' ? 'temporadas' : 'agencias'
    const { id, created_at, updated_at, ...payload } = form
    let error
    if (isEdit) {
      const res = await supabase.from(table).update(payload).eq('id', item.id)
      error = res.error
    } else {
      const res = await supabase.from(table).insert(payload)
      error = res.error
    }
    if (error) toast.error('Error: ' + error.message)
    else { toast.success(isEdit ? 'Actualizado' : 'Creado'); onSaved() }
    setSaving(false)
  }

  return (
    <Modal open title={`${isEdit ? 'Editar' : 'Nuevo'} ${tab.slice(0, -1)}`} onClose={onClose}>
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
        {tab === 'Planes' && (
          <>
            <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
            <Select
              label="Categoría"
              value={form.categoria || ''}
              onChange={v => set('categoria', v)}
              placeholder="— Categoría —"
              options={['rack','rack_descuento','mayorista','mayorista_exterior','fidelidad','corporativo','grupo_neto','almuerzo_sin_transporte','guia','solo_transporte','blue_dive'].map(c => ({ value: c, label: c }))}
            />
            <Select
              label="Nivel"
              value={form.nivel || 'na'}
              onChange={v => set('nivel', v)}
              options={[
                { value: 'na', label: 'N/A' },
                { value: 'silver', label: 'Silver' },
                { value: 'gold', label: 'Gold' },
                { value: 'diamond', label: 'Diamond' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Precio Adulto Baja" type="number" value={form.precio_adulto_baja || 0} onChange={e => set('precio_adulto_baja', +e.target.value)} />
              <Input label="Precio Adulto Alta" type="number" value={form.precio_adulto_alta || 0} onChange={e => set('precio_adulto_alta', +e.target.value)} />
              <Input label="Precio Niño Baja" type="number" value={form.precio_nino_baja || 0} onChange={e => set('precio_nino_baja', +e.target.value)} />
              <Input label="Precio Niño Alta" type="number" value={form.precio_nino_alta || 0} onChange={e => set('precio_nino_alta', +e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.activo !== false} onChange={e => set('activo', e.target.checked)} />
              Activo
            </label>
          </>
        )}

        {tab === 'Lanchas' && (
          <>
            <Input label="Código" value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} />
            <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
            <Input label="Capacidad" type="number" value={form.capacidad || ''} onChange={e => set('capacidad', +e.target.value)} />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.activa !== false} onChange={e => set('activa', e.target.checked)} />
              Activa
            </label>
          </>
        )}

        {tab === 'Temporadas' && (
          <>
            <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
            <Select
              label="Tipo"
              value={form.tipo || 'baja'}
              onChange={v => set('tipo', v)}
              options={[
                { value: 'baja', label: 'Baja' },
                { value: 'alta', label: 'Alta' },
              ]}
            />
            <DatePicker label="Fecha inicio" value={form.fecha_inicio || ''} onChange={v => set('fecha_inicio', v)} />
            <DatePicker label="Fecha fin" value={form.fecha_fin || ''} onChange={v => set('fecha_fin', v)} />
          </>
        )}

        {tab === 'Agencias' && (
          <>
            <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
            <Input label="Contacto" value={form.contacto || ''} onChange={e => set('contacto', e.target.value)} />
            <Input label="Email" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.activa !== false} onChange={e => set('activa', e.target.checked)} />
              Activa
            </label>
          </>
        )}
      </div>

      <div className="flex gap-3 justify-end mt-4">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button loading={saving} onClick={save}>{isEdit ? 'Actualizar' : 'Crear'}</Button>
      </div>
    </Modal>
  )
}
