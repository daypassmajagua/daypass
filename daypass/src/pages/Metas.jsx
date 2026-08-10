import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Target, Plus, Percent, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { formatCurrency, classNames, hoyLocal, plural } from '../lib/utils'
import {
  PERIODOS, UNIDADES, opcionesDeNumero, etiquetaDePeriodo, avance, porcentaje, rangoDeMeta,
} from '../lib/metas'
import { EstadoError, Esqueleto } from '../components/patrones'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

/**
 * Las metas y las comisiones.
 *
 * Las escribe gerencia y las ve la coordinación: una meta que solo ve quien la
 * fija no cambia el comportamiento de nadie, y ese es todo el punto de tener
 * metas.
 *
 * Lo primero que se ve es el avance, no el formulario. La pregunta de todos
 * los días es *cómo vamos*, no *cuánto pusimos*.
 */
export default function Metas() {
  const { rol } = usePerfil()
  const puedeEditar = ['super_admin', 'gerencia', 'directora'].includes(rol)

  const [metas, setMetas] = useState([])
  const [comisiones, setComisiones] = useState([])
  const [organizaciones, setOrganizaciones] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null)
  const [editandoComision, setEditandoComision] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [m, c, o, p] = await Promise.all([
      supabase.from('avance_metas').select('*')
        .order('anio', { ascending: false }).order('numero', { ascending: false }),
      supabase.from('comisiones').select('*, organizaciones (id, nombre)')
        .is('hasta', null).order('desde', { ascending: false }),
      supabase.from('organizaciones').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.from('perfiles').select('user_id, nombre').eq('activo', true).order('nombre'),
    ])
    if (m.error) setError(m.error.message)
    else {
      setError(null)
      setMetas(m.data || [])
      setComisiones(c.data || [])
      setOrganizaciones(o.data || [])
      setPerfiles(p.data || [])
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="max-w-4xl mx-auto px-4">
      <PageHeader
        title="Metas y comisiones"
        subtitle="Cómo vamos, y qué se le liquida a cada agencia"
        actions={puedeEditar && (
          <Button size="sm" onClick={() => setEditando({})}>
            <Plus size={14} />
            Nueva meta
          </Button>
        )}
      />

      {cargando ? (
        <Esqueleto filas={3} />
      ) : error ? (
        <EstadoError error={error} onReintentar={cargar} />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            {!metas.length ? (
              <Card className="p-12 text-center">
                <Target size={32} className="mx-auto text-tinta-2/50 mb-3" aria-hidden="true" />
                <p className="text-tinta-2 text-[17px]">Todavía no hay metas.</p>
                <p className="text-tinta-2 text-[15px] mt-1">
                  {puedeEditar
                    ? 'Ponle una al mes que viene y el avance se calcula solo.'
                    : 'Las fija gerencia.'}
                </p>
              </Card>
            ) : metas.map(m => <FilaMeta key={m.id} meta={m} />)}
          </section>

          <section>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-tinta">
                <Percent size={17} className="text-blue-700" />
                Comisiones por agencia
              </h2>
              {puedeEditar && (
                <Button variant="ghost" size="sm" onClick={() => setEditandoComision({})}>
                  <Plus size={14} />
                  Agregar
                </Button>
              )}
            </div>

            {!comisiones.length ? (
              <Card className="p-8 text-center">
                <p className="text-tinta-2 text-[15px]">
                  Ninguna agencia tiene comisión pactada.
                </p>
              </Card>
            ) : (
              <Card className="divide-y divide-linea">
                {comisiones.map(c => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="flex-1 text-[15px] text-tinta">
                      {c.organizaciones?.nombre || 'Sin agencia'}
                    </span>
                    <span className="text-[15px] font-bold text-tinta tabular">{c.porcentaje}%</span>
                    <span className="text-[13px] text-tinta-2">desde {c.desde}</span>
                  </div>
                ))}
              </Card>
            )}

            <p className="text-[13px] text-tinta-2 mt-2">
              Cambiar un porcentaje no reescribe lo ya liquidado: la liquidación
              usa el que regía el día del pasadía.
            </p>
          </section>

          <Liquidacion />
        </div>
      )}

      {editando && (
        <FormularioMeta
          perfiles={perfiles}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => { setEditando(null); await cargar() }}
        />
      )}

      {editandoComision && (
        <FormularioComision
          organizaciones={organizaciones}
          onCerrar={() => setEditandoComision(null)}
          onGuardado={async () => { setEditandoComision(null); await cargar() }}
        />
      )}
    </div>
  )
}

function FilaMeta({ meta }) {
  const pct = porcentaje(meta.logrado, meta.valor)
  const barra = avance(meta.logrado, meta.valor)
  const enPlata = meta.unidad === 'ingresos'
  const cumplida = pct >= 100

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-tinta">
            {etiquetaDePeriodo(meta.periodo, meta.numero, meta.anio)}
          </p>
          <p className="text-[13px] text-tinta-2">
            {meta.responsable}
            {meta.incluye_equipo && ' · cuenta lo que vende todo el equipo'}
          </p>
        </div>
        <p className={classNames(
          'text-[20px] font-bold tabular shrink-0',
          cumplida ? 'text-verde-600' : 'text-tinta'
        )}>
          {pct}%
        </p>
      </div>

      <div className="h-2 rounded-full bg-linea overflow-hidden" role="presentation">
        <div
          className={classNames('h-full rounded-full', cumplida ? 'bg-verde-500' : 'bg-blue-600')}
          style={{ width: `${barra * 100}%` }}
        />
      </div>

      <p className="text-[14px] text-tinta-2 mt-2 tabular">
        {enPlata
          ? `${formatCurrency(meta.logrado)} de ${formatCurrency(meta.valor)}`
          : `${meta.logrado} de ${meta.valor} personas`}
      </p>
    </Card>
  )
}

function FormularioMeta({ perfiles, onCerrar, onGuardado }) {
  const hoy = hoyLocal()
  const [anio, setAnio] = useState(hoy.slice(0, 4))
  const [periodo, setPeriodo] = useState('mes')
  const [numero, setNumero] = useState(String(Number(hoy.slice(5, 7))))
  const [unidad, setUnidad] = useState('ingresos')
  const [valor, setValor] = useState('')
  const [responsable, setResponsable] = useState('')
  const [incluyeEquipo, setIncluyeEquipo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const numeros = opcionesDeNumero(periodo)

  async function guardar() {
    const monto = Number(valor)
    if (!monto || monto <= 0) { toast.error('La meta tiene que ser mayor que cero.'); return }

    setGuardando(true)
    const { error } = await supabase.from('metas').insert({
      anio: Number(anio),
      periodo,
      numero: periodo === 'anual' ? null : Number(numero),
      unidad,
      valor: monto,
      responsable_id: responsable || null,
      incluye_equipo: incluyeEquipo,
    })
    setGuardando(false)

    if (error) {
      toast.error(/duplicate|unique/i.test(error.message)
        ? 'Ya hay una meta para ese periodo y esa persona.'
        : 'No se pudo guardar. ' + error.message)
      return
    }
    toast.success('Meta guardada')
    onGuardado()
  }

  return (
    <Modal open onClose={onCerrar} title="Nueva meta">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Periodo" value={periodo} onChange={setPeriodo}
            options={PERIODOS.map(p => ({ value: p.valor, label: p.etiqueta }))} />
          <Input label="Año" inputMode="numeric" value={anio}
            onChange={e => setAnio(e.target.value.replace(/[^\d]/g, '').slice(0, 4))} />
        </div>

        {numeros.length > 0 && (
          <Select label="Cuál" value={numero} onChange={setNumero} options={numeros} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select label="En" value={unidad} onChange={setUnidad}
            options={UNIDADES.map(u => ({ value: u.valor, label: u.etiqueta }))} />
          <Input
            label={unidad === 'ingresos' ? 'Cuánta plata' : 'Cuántas personas'}
            inputMode="numeric"
            value={valor}
            onChange={e => setValor(e.target.value.replace(/[^\d]/g, ''))}
          />
        </div>

        <Select
          label="De quién"
          value={responsable}
          onChange={setResponsable}
          placeholder="Todo el pasadía"
          options={[
            { value: '', label: 'Todo el pasadía' },
            ...perfiles.map(p => ({ value: p.user_id, label: p.nombre })),
          ]}
        />

        {responsable && (
          <button
            type="button"
            onClick={() => setIncluyeEquipo(!incluyeEquipo)}
            className={classNames(
              'text-left rounded-xl px-3 py-3 ring-1 transition-colors',
              incluyeEquipo ? 'bg-blue-50 ring-blue-600' : 'bg-fondo ring-transparent hover:ring-linea'
            )}
          >
            <span className="block text-[15px] font-bold text-tinta">
              Cuenta lo que venden las demás
            </span>
            <span className="block text-[13px] text-tinta-2">
              Para quien responde por el pasadía completo, no solo por lo que
              vendió con sus manos.
            </span>
          </button>
        )}

        <p className="text-[13px] text-tinta-2 tabular">
          {(() => {
            const r = rangoDeMeta(Number(anio), periodo, Number(numero))
            return `Cuenta del ${r.desde} al ${r.hasta}.`
          })()}
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} loading={guardando}>Guardar</Button>
        </div>
      </div>
    </Modal>
  )
}

function FormularioComision({ organizaciones, onCerrar, onGuardado }) {
  const [orgId, setOrgId] = useState('')
  const [porcentaje, setPorcentaje] = useState('')
  const [desde, setDesde] = useState(hoyLocal())
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const pct = Number(porcentaje)
    if (!orgId) { toast.error('Elige la agencia.'); return }
    if (!(pct > 0 && pct <= 100)) { toast.error('El porcentaje va entre 0 y 100.'); return }

    setGuardando(true)
    // La anterior se cierra el día antes: dos porcentajes vigentes a la vez
    // harían que la liquidación dependiera del orden de las filas.
    await supabase.from('comisiones')
      .update({ hasta: desde })
      .eq('organizacion_id', orgId)
      .is('hasta', null)

    const { error } = await supabase.from('comisiones')
      .insert({ organizacion_id: orgId, porcentaje: pct, desde })
    setGuardando(false)

    if (error) { toast.error('No se pudo guardar. ' + error.message); return }
    toast.success('Comisión guardada')
    onGuardado()
  }

  return (
    <Modal open onClose={onCerrar} title="Comisión de una agencia">
      <div className="flex flex-col gap-4">
        <Select label="Agencia" value={orgId} onChange={setOrgId}
          options={organizaciones.map(o => ({ value: o.id, label: o.nombre }))} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Porcentaje" inputMode="decimal" value={porcentaje}
            onChange={e => setPorcentaje(e.target.value.replace(/[^\d.]/g, ''))} />
          <Input label="Desde" type="text" value={desde}
            onChange={e => setDesde(e.target.value)} />
        </div>

        <p className="text-[13px] text-tinta-2">
          Si esa agencia ya tenía un porcentaje, se cierra en esta fecha. Lo
          liquidado antes no se toca.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} loading={guardando}>Guardar</Button>
        </div>
      </div>
    </Modal>
  )
}

/** Lo que se le debe a cada agencia en un periodo. */
function Liquidacion() {
  const hoy = hoyLocal()
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`)
  const [hasta, setHasta] = useState(hoy)
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(false)

  async function calcular() {
    setCargando(true)
    const { data } = await supabase.rpc('liquidacion_comisiones', {
      p_desde: desde, p_hasta: hasta,
    })
    setFilas(data || [])
    setCargando(false)
  }

  return (
    <section>
      <h2 className="text-[15px] font-bold text-tinta mb-2">Liquidación</h2>
      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <Input label="Desde" value={desde} onChange={e => setDesde(e.target.value)} />
          <Input label="Hasta" value={hasta} onChange={e => setHasta(e.target.value)} />
          <Button onClick={calcular} loading={cargando}>Calcular</Button>
        </div>

        {filas.length > 0 && (
          <ul className="mt-4 divide-y divide-linea">
            {filas.map(f => (
              <li key={f.organizacion_id} className="py-2.5 flex items-center gap-3">
                <span className="flex-1 text-[15px] text-tinta">{f.organizacion}</span>
                <span className="text-[13px] text-tinta-2">
                  {plural(f.reservas, 'reserva', 'reservas')} · {f.porcentaje || 0}%
                </span>
                <span className="text-[15px] font-bold text-tinta tabular">
                  {formatCurrency(f.comision)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}
