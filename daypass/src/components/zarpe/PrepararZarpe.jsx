import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BedDouble, Plus, Trash2, Users, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { classNames, plural } from '../../lib/utils'
import { opcionesDePais } from '../../lib/paisesISO'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

/**
 * Preparar un zarpe: lo que el manifiesto de Capitanía necesita además de
 * los visitantes — piloto, coordinador del tour, agencia operadora, los
 * empleados que van a bordo y los huéspedes de alojamiento.
 *
 * El piloto es catálogo, no texto: el manifiesto no puede depender de cómo
 * se escribió ese día. Con memoria del último asignado a esa lancha, para
 * que el día normal sea confirmar, no digitar.
 */
export default function PrepararZarpe({ zarpe, onCerrar, onGuardado }) {
  const [pilotos, setPilotos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [paises, setPaises] = useState([])
  const [marcados, setMarcados] = useState(new Set())
  const [alojados, setAlojados] = useState([])
  const [pilotoId, setPilotoId] = useState(zarpe.piloto_id || '')
  const [coordinador, setCoordinador] = useState(zarpe.coordinador_tour || '')
  const [agenciaOperadora, setAgenciaOperadora] = useState(zarpe.agencia_operadora || '')
  const [sugerido, setSugerido] = useState(null)
  const [nuevoAlojado, setNuevoAlojado] = useState({ nombre: '', documento: '', pais_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const [p, e, pa, ze, za] = await Promise.all([
      supabase.from('pilotos').select('*').eq('activo', true).order('nombre'),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      supabase.from('paises').select('*').order('nombre'),
      supabase.from('zarpe_empleados').select('*').eq('zarpe_id', zarpe.id),
      supabase.from('zarpe_alojamiento').select('*, paises (id, nombre)').eq('zarpe_id', zarpe.id),
    ])
    setPilotos(p.data || [])
    setEmpleados(e.data || [])
    setPaises(pa.data || [])
    setMarcados(new Set((ze.data || []).map(x => x.empleado_id)))
    setAlojados(za.data || [])
    setCargando(false)
  }, [zarpe.id])

  useEffect(() => { cargar() }, [cargar])

  // Memoria: el último piloto que llevó esta lancha.
  useEffect(() => {
    if (zarpe.piloto_id) return
    let vigente = true
    supabase
      .from('zarpes')
      .select('piloto_id, pilotos (id, nombre)')
      .eq('lancha_id', zarpe.lancha_id)
      .neq('id', zarpe.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!vigente) return
        const ultimo = (data || []).find(z => z.piloto_id)
        if (ultimo) setSugerido(ultimo)
      })
    return () => { vigente = false }
  }, [zarpe.id, zarpe.lancha_id, zarpe.piloto_id])

  async function alternarEmpleado(empleadoId) {
    if (marcados.has(empleadoId)) {
      await supabase.from('zarpe_empleados').delete()
        .eq('zarpe_id', zarpe.id).eq('empleado_id', empleadoId)
      setMarcados(prev => { const s = new Set(prev); s.delete(empleadoId); return s })
    } else {
      const { error } = await supabase.from('zarpe_empleados')
        .insert({ zarpe_id: zarpe.id, empleado_id: empleadoId })
      if (error) { toast.error('No se pudo marcar. ' + error.message); return }
      setMarcados(prev => new Set(prev).add(empleadoId))
    }
  }

  async function agregarAlojado() {
    if (!nuevoAlojado.nombre.trim()) return
    const { error } = await supabase.from('zarpe_alojamiento').insert({
      zarpe_id: zarpe.id,
      nombre: nuevoAlojado.nombre.trim(),
      documento: nuevoAlojado.documento.trim() || null,
      pais_id: nuevoAlojado.pais_id || null,
    })
    if (error) { toast.error('No se pudo agregar. ' + error.message); return }
    setNuevoAlojado({ nombre: '', documento: '', pais_id: '' })
    await cargar()
  }

  async function quitarAlojado(id) {
    await supabase.from('zarpe_alojamiento').delete().eq('id', id)
    await cargar()
  }

  async function guardar() {
    setGuardando(true)
    const { error } = await supabase.from('zarpes').update({
      piloto_id: pilotoId || null,
      coordinador_tour: coordinador.trim() || null,
      agencia_operadora: agenciaOperadora.trim() || null,
    }).eq('id', zarpe.id)
    setGuardando(false)
    if (error) { toast.error('No se pudo guardar. ' + error.message); return }
    toast.success(`${zarpe.lanchas?.nombre || 'Zarpe'} lista para el manifiesto`)
    onGuardado?.()
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto overscroll-contain bg-white rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold text-tinta tracking-[-.01em]">
              Preparar {zarpe.lanchas?.nombre || 'el zarpe'}
            </h2>
            <p className="text-sm text-tinta-2">
              Lo que el manifiesto necesita además de los visitantes.
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="icono-tactil w-11 h-11 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-fondo shrink-0"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>

        {cargando ? (
          <p className="text-tinta-2 py-6">Cargando…</p>
        ) : (
          <>
            {/* ── Piloto y manifiesto ── */}
            <div className="flex flex-col gap-4">
              <div>
                <Select
                  label="Piloto"
                  value={pilotoId}
                  onChange={setPilotoId}
                  placeholder="— Elegir piloto —"
                  options={pilotos.map(p => ({ value: p.id, label: p.nombre }))}
                />
                {sugerido && !pilotoId && (
                  <button
                    type="button"
                    onClick={() => setPilotoId(sugerido.piloto_id)}
                    className="mt-1.5 text-[13px] font-bold text-blue-700 underline min-h-[36px]"
                  >
                    La última vez la llevó {sugerido.pilotos?.nombre} — usar el mismo
                  </button>
                )}
                {!pilotos.length && (
                  <p className="text-[13px] text-coral-600 font-bold mt-1">
                    No hay pilotos en el catálogo. Créalos en Lanchas y equipo.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Coordinador del tour (opcional)" value={coordinador}
                  onChange={e => setCoordinador(e.target.value)} />
                <Input label="Agencia operadora (opcional)" value={agenciaOperadora}
                  onChange={e => setAgenciaOperadora(e.target.value)} />
              </div>
            </div>

            {/* ── Empleados a bordo ── */}
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-[15px] font-bold text-tinta">
                <Users size={17} className="text-blue-700" />
                Empleados a bordo
                {marcados.size > 0 && (
                  <span className="text-tinta-2 font-normal">· {marcados.size}</span>
                )}
              </p>
              <p className="text-[13px] text-tinta-2 -mt-1">
                Entran al manifiesto y ocupan puesto, pero no gastan tiquete.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {empleados.map(e => {
                  const va = marcados.has(e.id)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => alternarEmpleado(e.id)}
                      className={classNames(
                        'flex items-center gap-3 rounded-xl px-4 min-h-[52px] text-left ring-1 transition-colors',
                        va ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-tinta ring-linea hover:ring-blue-300'
                      )}
                    >
                      <span className={classNames(
                        'w-6 h-6 shrink-0 rounded-md ring-2 flex items-center justify-center text-[13px] font-bold',
                        va ? 'bg-white text-blue-700 ring-white' : 'ring-linea text-transparent'
                      )}>
                        ✓
                      </span>
                      <span className="font-bold text-[15px] truncate">{e.nombre}</span>
                    </button>
                  )
                })}
                {!empleados.length && (
                  <p className="text-[13px] text-tinta-2 col-span-full">
                    No hay empleados cargados. Créalos en Lanchas y equipo.
                  </p>
                )}
              </div>
            </div>

            {/* ── Alojamiento ── */}
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-[15px] font-bold text-tinta">
                <BedDouble size={17} className="text-blue-700" />
                Huéspedes de alojamiento
                {alojados.length > 0 && (
                  <span className="text-tinta-2 font-normal">· {plural(alojados.length, 'persona', 'personas')}</span>
                )}
              </p>
              <p className="text-[13px] text-tinta-2 -mt-1">
                Van en la lancha sin ser pasadía: también cuentan en el manifiesto y el cupo.
              </p>

              {alojados.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl bg-fondo px-4 py-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-[15px] text-tinta truncate">{a.nombre}</span>
                    <span className="block text-[13px] text-tinta-2 tabular">
                      {[a.documento, a.paises?.nombre].filter(Boolean).join(' · ') || 'Sin documento'}
                    </span>
                  </span>
                  <button
                    onClick={() => quitarAlojado(a.id)}
                    className="icono-tactil w-10 h-10 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-white"
                    aria-label={`Quitar a ${a.nombre}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_auto] gap-2 items-end">
                <Input label="Nombre" value={nuevoAlojado.nombre}
                  onChange={e => setNuevoAlojado(v => ({ ...v, nombre: e.target.value }))} />
                <Input label="Documento" value={nuevoAlojado.documento} inputMode="numeric"
                  onChange={e => setNuevoAlojado(v => ({ ...v, documento: e.target.value }))} />
                <Select label="País" value={nuevoAlojado.pais_id}
                  onChange={v => setNuevoAlojado(x => ({ ...x, pais_id: v }))}
                  placeholder="—"
                  options={opcionesDePais(paises, '—')} />
                <Button type="button" variant="secondary" onClick={agregarAlojado}
                  disabled={!nuevoAlojado.nombre.trim()} className="mb-0">
                  <Plus size={16} /> Agregar
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-linea pt-4">
              <Button variant="ghost" onClick={onCerrar}>Cerrar sin guardar</Button>
              <Button onClick={guardar} loading={guardando}>Guardar la preparación</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
