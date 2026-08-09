import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Anchor, Pencil, Plus, Ship, UserCheck, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { classNames, plural } from '../lib/utils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import PageHeader from '../components/layout/PageHeader'
import { EstadoError } from '../components/patrones'

/**
 * Lanchas y equipo: la herramienta de trabajo de la coordinadora.
 *
 * Ella administra sus lanchas, pilotos y empleados sin pasar por nadie.
 * Nada se borra —el histórico de manifiestos los referencia—: se desactiva.
 * La prioridad de las lanchas gobierna la autoasignación: Majagua 1 y 2
 * siempre primero, editable por si cambia la flota.
 */

const PESTANAS = [
  { clave: 'lanchas', etiqueta: 'Lanchas', icono: Ship },
  { clave: 'pilotos', etiqueta: 'Pilotos', icono: Anchor },
  { clave: 'empleados', etiqueta: 'Empleados', icono: Users },
]

const TIPOS_DOC = [
  { value: 'cc', label: 'CC' }, { value: 'ce', label: 'CE' },
  { value: 'pasaporte', label: 'Pasaporte' }, { value: 'otro', label: 'Otro' },
]

function Interruptor({ activo, onChange, etiqueta }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={classNames(
        'shrink-0 rounded-xl px-3 min-h-[40px] text-[13px] font-bold transition-colors',
        activo ? 'bg-verde-50 text-verde-600' : 'bg-fondo text-tinta-2'
      )}
      title={activo ? `Desactivar ${etiqueta}` : `Activar ${etiqueta}`}
    >
      {activo ? 'Activa' : 'Inactiva'}
    </button>
  )
}

export default function Equipo() {
  const [pestana, setPestana] = useState('lanchas')
  const [lanchas, setLanchas] = useState([])
  const [pilotos, setPilotos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [paises, setPaises] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null)   // { tabla, fila }

  const recargar = useCallback(async () => {
    const [l, p, e, pa] = await Promise.all([
      supabase.from('lanchas').select('*').order('prioridad', { ascending: true }),
      supabase.from('pilotos').select('*').order('nombre'),
      supabase.from('empleados').select('*, paises (id, nombre)').order('nombre'),
      supabase.from('paises').select('*').order('nombre'),
    ])
    const fallo = l.error || p.error || e.error || pa.error
    setError(fallo ? fallo.message : null)
    setLanchas(l.data || []); setPilotos(p.data || [])
    setEmpleados(e.data || []); setPaises(pa.data || [])
    setCargando(false)
  }, [])

  useEffect(() => { recargar() }, [recargar])

  async function alternarActiva(tabla, fila, campo = 'activa') {
    const { error } = await supabase.from(tabla).update({ [campo]: !fila[campo] }).eq('id', fila.id)
    if (error) toast.error('No se pudo cambiar. ' + error.message)
    else {
      toast.success(fila[campo] ? `${fila.nombre} desactivada — el histórico la conserva` : `${fila.nombre} activa de nuevo`)
      await recargar()
    }
  }

  async function guardar(tabla, datos) {
    const { id, ...campos } = datos
    const res = id
      ? await supabase.from(tabla).update(campos).eq('id', id)
      : await supabase.from(tabla).insert(campos)
    if (res.error) { toast.error('No se pudo guardar. ' + res.error.message); return false }
    toast.success('Guardado')
    setEditando(null)
    await recargar()
    return true
  }

  if (cargando) {
    return <p className="max-w-4xl mx-auto px-4 py-10 text-tinta-2">Cargando el equipo…</p>
  }

  if (error) {
    return <EstadoError error={error} onReintentar={recargar} className="max-w-4xl mx-auto" />
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        title="Lanchas y equipo"
        subtitle="Tus lanchas, pilotos y empleados. Nada se borra: se desactiva."
      />

      <div className="flex gap-1.5 p-1.5 bg-white rounded-2xl shadow-[0_1px_2px_rgba(22,24,44,.05)] w-fit mb-5">
        {PESTANAS.map(p => (
          <button
            key={p.clave}
            onClick={() => setPestana(p.clave)}
            className={classNames(
              'flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-[15px] font-bold transition-colors',
              pestana === p.clave ? 'bg-blue-600 text-white' : 'text-tinta-2 hover:bg-blue-50 hover:text-blue-700'
            )}
          >
            <p.icono size={17} />
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* ── Lanchas ── */}
      {pestana === 'lanchas' && (
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-tinta-2 max-w-[42ch]">
              La prioridad decide a qué lancha van las reservas nuevas: primero
              la 1, luego la 2, y las demás solo cuando esas se llenan.
            </p>
            <Button size="sm" onClick={() => setEditando({ tabla: 'lanchas', fila: { nombre: '', codigo: '', capacidad: 30, prioridad: 10, activa: true } })}>
              <Plus size={16} /> Nueva lancha
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {lanchas.map(l => (
              <li key={l.id} className="flex items-center gap-3 rounded-xl bg-fondo px-4 py-3">
                <span className={classNames(
                  'w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold tabular',
                  (l.prioridad ?? 99) <= 2 ? 'bg-blue-600 text-white' : 'bg-white text-tinta-2'
                )}>
                  {l.prioridad ?? '—'}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-[15px] text-tinta truncate">{l.nombre}</span>
                  <span className="block text-[13px] text-tinta-2 tabular">
                    {l.capacidad ? `${l.capacidad} puestos` : 'Sin capacidad definida'}
                  </span>
                </span>
                <Interruptor activo={l.activa} etiqueta={l.nombre}
                  onChange={() => alternarActiva('lanchas', l)} />
                <button
                  onClick={() => setEditando({ tabla: 'lanchas', fila: l })}
                  className="icono-tactil w-10 h-10 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-blue-50 hover:text-blue-700"
                  aria-label={`Editar ${l.nombre}`}
                >
                  <Pencil size={16} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Pilotos ── */}
      {pestana === 'pilotos' && (
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-tinta-2 max-w-[42ch]">
              El manifiesto de Capitanía lleva el nombre del piloto: por eso es
              catálogo y no texto libre. Se asignan por zarpe.
            </p>
            <Button size="sm" onClick={() => setEditando({ tabla: 'pilotos', fila: { nombre: '', documento: '', activo: true } })}>
              <Plus size={16} /> Nuevo piloto
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {pilotos.map(p => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl bg-fondo px-4 py-3">
                <UserCheck size={20} className="text-tinta-2 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-[15px] text-tinta truncate">{p.nombre}</span>
                  {p.documento && <span className="block text-[13px] text-tinta-2 tabular">{p.documento}</span>}
                </span>
                <Interruptor activo={p.activo} etiqueta={p.nombre}
                  onChange={() => alternarActiva('pilotos', p, 'activo')} />
                <button
                  onClick={() => setEditando({ tabla: 'pilotos', fila: p })}
                  className="icono-tactil w-10 h-10 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-blue-50 hover:text-blue-700"
                  aria-label={`Editar a ${p.nombre}`}
                >
                  <Pencil size={16} />
                </button>
              </li>
            ))}
            {!pilotos.length && (
              <p className="text-tinta-2 text-sm py-4">
                Todavía no hay pilotos. Crea el primero: el manifiesto lo necesita.
              </p>
            )}
          </ul>
        </Card>
      )}

      {/* ── Empleados ── */}
      {pestana === 'empleados' && (
        <Card className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-tinta-2 max-w-[42ch]">
              Se cargan una sola vez. Después solo marcas con un toque quiénes
              van en cada zarpe, y entran al manifiesto.
            </p>
            <Button size="sm" onClick={() => setEditando({ tabla: 'empleados', fila: { nombre: '', tipo_documento: 'cc', documento: '', pais_id: paises.find(p => p.codigo === 'COL')?.id || null, activo: true } })}>
              <Plus size={16} /> Nuevo empleado
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {empleados.map(e => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl bg-fondo px-4 py-3">
                <Users size={20} className="text-tinta-2 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-[15px] text-tinta truncate">{e.nombre}</span>
                  <span className="block text-[13px] text-tinta-2 tabular">
                    {[e.tipo_documento?.toUpperCase(), e.documento].filter(Boolean).join(' ')}
                    {e.paises?.nombre ? ` · ${e.paises.nombre}` : ''}
                  </span>
                </span>
                <Interruptor activo={e.activo} etiqueta={e.nombre}
                  onChange={() => alternarActiva('empleados', e, 'activo')} />
                <button
                  onClick={() => setEditando({ tabla: 'empleados', fila: e })}
                  className="icono-tactil w-10 h-10 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-blue-50 hover:text-blue-700"
                  aria-label={`Editar a ${e.nombre}`}
                >
                  <Pencil size={16} />
                </button>
              </li>
            ))}
            {!empleados.length && (
              <p className="text-tinta-2 text-sm py-4">Todavía no hay empleados cargados.</p>
            )}
          </ul>
        </Card>
      )}

      {/* ── Editor ── */}
      {editando && (
        <EditorEquipo
          editando={editando}
          paises={paises}
          onCerrar={() => setEditando(null)}
          onGuardar={guardar}
        />
      )}
    </div>
  )
}

function EditorEquipo({ editando, paises, onCerrar, onGuardar }) {
  const { tabla } = editando
  const [f, setF] = useState(editando.fila)
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const titulo = {
    lanchas: f.id ? `Editar ${editando.fila.nombre}` : 'Nueva lancha',
    pilotos: f.id ? `Editar a ${editando.fila.nombre}` : 'Nuevo piloto',
    empleados: f.id ? `Editar a ${editando.fila.nombre}` : 'Nuevo empleado',
  }[tabla]

  async function enviar() {
    if (!f.nombre?.trim()) { toast.error('Falta el nombre'); return }
    setGuardando(true)
    // Solo los campos de cada tabla: nada de columnas de joins.
    const campos = {
      lanchas: { id: f.id, nombre: f.nombre.trim(), codigo: f.codigo?.trim() || f.nombre.trim().slice(0, 4).toUpperCase(), capacidad: Number(f.capacidad) || null, prioridad: Number(f.prioridad) || 10, activa: f.activa ?? true },
      pilotos: { id: f.id, nombre: f.nombre.trim(), documento: f.documento?.trim() || null, activo: f.activo ?? true },
      empleados: { id: f.id, nombre: f.nombre.trim(), tipo_documento: f.tipo_documento || null, documento: f.documento?.trim() || null, pais_id: f.pais_id || null, activo: f.activo ?? true },
    }[tabla]
    await onGuardar(tabla, campos)
    setGuardando(false)
  }

  return (
    <Modal open onClose={onCerrar} title={titulo}>
      <div className="flex flex-col gap-4">
        <Input label="Nombre" value={f.nombre || ''} onChange={e => set('nombre', e.target.value)} autoFocus />

        {tabla === 'lanchas' && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Puestos" type="number" min="1" value={f.capacidad ?? ''} onChange={e => set('capacidad', e.target.value)} />
            <div>
              <Input label="Prioridad" type="number" min="1" value={f.prioridad ?? ''} onChange={e => set('prioridad', e.target.value)} />
              <p className="text-[13px] text-tinta-2 mt-1">1 y 2 se llenan primero.</p>
            </div>
          </div>
        )}

        {tabla === 'pilotos' && (
          <Input label="Documento" value={f.documento || ''} onChange={e => set('documento', e.target.value)} inputMode="numeric" />
        )}

        {tabla === 'empleados' && (
          <>
            <div className="grid grid-cols-[7rem_1fr] gap-4">
              <Select label="Tipo" value={f.tipo_documento || 'cc'} onChange={v => set('tipo_documento', v)} options={TIPOS_DOC} />
              <Input label="Documento" value={f.documento || ''} onChange={e => set('documento', e.target.value)} inputMode="numeric" />
            </div>
            <Select
              label="País" value={f.pais_id || ''} onChange={v => set('pais_id', v || null)}
              placeholder="— País —"
              options={[{ value: '', label: '— País —' }, ...paises.map(p => ({ value: p.id, label: p.nombre }))]}
            />
          </>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={enviar} loading={guardando}>Guardar</Button>
        </div>
      </div>
    </Modal>
  )
}
