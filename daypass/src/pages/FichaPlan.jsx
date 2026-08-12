import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, classNames, hoyLocal } from '../lib/utils'
import { fraseDe, esSensible } from '../lib/bitacora'
import { Ficha, DondeSeUsa, LineaDeTiempo, Esqueleto, EstadoError } from '../components/patrones'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'

/**
 * La ficha de un plan.
 *
 * El primer registro del catálogo que deja de vivir en una ventana emergente.
 * Un plan no es una fila: es lo que se vende, con su precio, sus platos y su
 * historia de cambios — y cambiar ese precio mueve la plata de todo lo que se
 * venda mañana.
 *
 * Aquí se juntan tres cosas que estaban sueltas: **los platos, que no tenían
 * pantalla en ninguna parte** aunque sean la regla 9; **dónde se usa**, para
 * que desactivar deje de ser un botón sin consecuencia; y **la historia**, que
 * la base guarda desde la 024 y nadie había mostrado.
 */

const NIVELES = [
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'na', label: 'Sin nivel' },
]

const CATEGORIAS = [
  'rack', 'rack_descuento', 'mayorista', 'mayorista_exterior', 'fidelidad',
  'corporativo', 'grupo_neto', 'almuerzo_sin_transporte', 'guia',
  'solo_transporte', 'blue_dive',
].map(c => ({ value: c, label: c.replace(/_/g, ' ') }))

export default function FichaPlan() {
  const { id } = useParams()

  const [plan, setPlan] = useState(null)
  const [borrador, setBorrador] = useState(null)
  const [platos, setPlatos] = useState([])
  const [uso, setUso] = useState(null)
  const [historia, setHistoria] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [p, op, hist] = await Promise.all([
      supabase.from('planes').select('*').eq('id', id).maybeSingle(),
      supabase.from('opciones_plato').select('*').eq('plan_id', id).order('nombre_es'),
      // La historia que la 024 ya guarda y que nadie mostraba.
      supabase.from('bitacora').select('*')
        .eq('entidad', 'planes').eq('entidad_id', id)
        .order('ocurrido_at', { ascending: false }).limit(50),
    ])

    if (p.error) { setError(p.error.message); setCargando(false); return }
    if (!p.data) { setError('Ese plan ya no existe.'); setCargando(false); return }

    setError(null)
    setPlan(p.data)
    setBorrador(p.data)
    setPlatos(op.data || [])
    setHistoria(hist.data || [])
    setCargando(false)

    // El conteo va aparte y sin bloquear: la ficha se puede leer mientras
    // llega. Son dos consultas de conteo sobre `reservas`, que ya enmascara.
    const hoy = hoyLocal()
    const [total, futuras] = await Promise.all([
      supabase.from('reservas').select('id', { count: 'exact', head: true })
        .eq('plan_id', id).neq('estado', 'cancelada'),
      supabase.from('reservas').select('id', { count: 'exact', head: true })
        .eq('plan_id', id).neq('estado', 'cancelada').gte('fecha', hoy),
    ])
    setUso({ total: total.count ?? 0, futuras: futuras.count ?? 0 })
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const hayCambios = Boolean(plan && borrador) &&
    JSON.stringify(plan) !== JSON.stringify(borrador)

  function editar(campo, valor) {
    setBorrador(b => ({ ...b, [campo]: valor }))
  }

  async function guardar() {
    if (!borrador.nombre?.trim()) { toast.error('El plan necesita un nombre.'); return }
    setGuardando(true)
    // Solo lo editable, y nombrado. Mandar la fila entera arrastraría `creado_por`
    // y compañía — que el servidor sella igual, pero que no son nuestras.
    const { error: err } = await supabase.from('planes').update({
      nombre: borrador.nombre.trim(),
      categoria: borrador.categoria,
      nivel: borrador.nivel,
      activo: borrador.activo !== false,
      precio_adulto_baja: Number(borrador.precio_adulto_baja || 0),
      precio_adulto_alta: Number(borrador.precio_adulto_alta || 0),
      precio_nino_baja: Number(borrador.precio_nino_baja || 0),
      precio_nino_alta: Number(borrador.precio_nino_alta || 0),
    }).eq('id', id)
    setGuardando(false)
    if (err) { toast.error('No se pudo guardar. ' + err.message); return }
    toast.success('Guardado')
    await cargar()
  }

  if (cargando) {
    return <div className="marco py-6"><Esqueleto filas={5} /></div>
  }
  if (error) {
    return (
      <div className="marco py-6">
        <EstadoError error={error} onReintentar={cargar} />
      </div>
    )
  }

  const activo = borrador.activo !== false

  return (
    <Ficha
      volverA="/config/planes"
      volverEtiqueta="Planes, platos y tarifas"
      titulo={borrador.nombre || 'Sin nombre'}
      subtitulo={`${(borrador.categoria || '').replace(/_/g, ' ')}${
        borrador.incluye_transporte ? ' · con transporte' : ' · sin transporte'}`}
      insignia={
        <span className={classNames(
          'px-2.5 py-1 rounded-lg text-[13px] font-bold',
          activo ? 'bg-verde-50 text-verde-600' : 'bg-fondo text-tinta-2'
        )}>
          {activo ? 'Se puede vender' : 'Ya no se vende'}
        </span>
      }
      hayCambios={hayCambios}
      guardando={guardando}
      onGuardar={guardar}
      onDescartar={() => setBorrador(plan)}
      riel={
        <>
          <EstadoDelPlan activo={activo} uso={uso} onCambiar={v => editar('activo', v)} />
          <DondeSeUsa
            cargando={!uso}
            lineas={uso ? [
              { etiqueta: 'Reservas en total', valor: uso.total },
              { etiqueta: 'De hoy en adelante', valor: uso.futuras },
            ] : []}
          />
        </>
      }
    >
      <Card className="p-5 flex flex-col gap-4">
        <h2 className="text-[15px] font-bold text-tinta">Qué es</h2>
        <Input label="Nombre" value={borrador.nombre || ''}
          onChange={e => editar('nombre', e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Categoría" value={borrador.categoria || ''}
            onChange={v => editar('categoria', v)} options={CATEGORIAS} />
          <Select label="Nivel" value={borrador.nivel || 'na'}
            onChange={v => editar('nivel', v)} options={NIVELES} />
        </div>
      </Card>

      <Tarifas borrador={borrador} onEditar={editar} />

      {/* Los platos, que hasta hoy solo se podían cambiar por SQL. */}
      <Platos planId={id} platos={platos} nivel={borrador.nivel} onCambio={cargar} />

      <Card className="p-5">
        <h2 className="text-[15px] font-bold text-tinta mb-3">Qué ha pasado con este plan</h2>
        <LineaDeTiempo
          eventos={historia.map(b => ({
            cuando: b.ocurrido_at,
            texto: fraseDe(b),
            quien: b.nombre,
            destacado: esSensible(b.accion),
          }))}
          agruparPor="mes"
          // Sin aviso de «antes no se guardaba quién»: eso vale para las
          // tablas a las que la 024 les puso columnas, no para la bitácora,
          // que lleva el nombre desde la 015 y no lo deja en null.
          vacio={{
            titulo: 'Sin cambios registrados',
            detalle: 'Cuando alguien cambie el precio de este plan, queda aquí con su nombre y la hora.',
          }}
        />
      </Card>
    </Ficha>
  )
}

/** El estado dice su consecuencia, no su nombre. */
function EstadoDelPlan({ activo, uso, onCambiar }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(22,24,44,.05)]">
      <h2 className="text-[12px] font-bold uppercase tracking-wider text-tinta-2 mb-2">Estado</h2>

      <button
        type="button"
        onClick={() => onCambiar(!activo)}
        aria-pressed={activo}
        className={classNames(
          'w-full text-left rounded-xl px-3 py-3 ring-1 transition-colors',
          activo ? 'bg-verde-50 ring-verde-500' : 'bg-fondo ring-transparent hover:ring-linea'
        )}
      >
        <span className="block text-[15px] font-bold text-tinta">
          {activo ? 'Se puede vender' : 'Ya no se vende'}
        </span>
        <span className="block text-[13px] text-tinta-2 mt-0.5">
          {activo
            ? 'Aparece al crear una reserva nueva.'
            : uso?.futuras
              ? `No aparece en reservas nuevas. Las ${uso.futuras} que ya lo tienen no cambian.`
              : 'No aparece al crear una reserva nueva.'}
        </span>
      </button>

      <p className="text-[13px] text-tinta-2 mt-2">
        Se desactivan, nunca se borran: el histórico tiene que seguir apuntando a algo.
      </p>
    </div>
  )
}

function Tarifas({ borrador, onEditar }) {
  const campos = [
    ['precio_adulto_baja', 'Adulto · temporada baja'],
    ['precio_adulto_alta', 'Adulto · temporada alta'],
    ['precio_nino_baja', 'Niño · temporada baja'],
    ['precio_nino_alta', 'Niño · temporada alta'],
  ]
  return (
    <Card className="p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-bold text-tinta">Tarifas</h2>
        <p className="text-[13px] text-tinta-2">
          El precio se congela al crear la reserva. Cambiar esto no toca lo ya vendido.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {campos.map(([campo, etiqueta]) => (
          <div key={campo}>
            <Input
              label={etiqueta}
              inputMode="numeric"
              value={String(borrador[campo] ?? '')}
              onChange={e => onEditar(campo, e.target.value.replace(/[^\d]/g, ''))}
            />
            <p className="text-[13px] text-tinta-2 mt-1 tabular">
              {formatCurrency(Number(borrador[campo] || 0))}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * Los platos de este plan.
 *
 * Existían en la base desde la 007 y **no se podían administrar desde ninguna
 * parte** — solo por SQL. Van aquí y no en una sección aparte porque el plato
 * pertenece al plan: es la regla 9 dicha en la estructura.
 */
function Platos({ planId, platos, nivel, onCambio }) {
  const [es, setEs] = useState('')
  const [en, setEn] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function agregar() {
    if (!es.trim() || !en.trim()) { toast.error('Falta el nombre en español o en inglés.'); return }
    setGuardando(true)
    const { error } = await supabase.from('opciones_plato')
      .insert({ plan_id: planId, nombre_es: es.trim(), nombre_en: en.trim() })
    setGuardando(false)
    if (error) { toast.error('No se pudo agregar. ' + error.message); return }
    setEs(''); setEn('')
    toast.success('Plato agregado')
    onCambio()
  }

  async function quitar(id) {
    const { error } = await supabase.from('opciones_plato').delete().eq('id', id)
    if (error) { toast.error('No se pudo quitar. Puede que alguien ya lo haya elegido.'); return }
    toast.success('Plato quitado')
    onCambio()
  }

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-tinta">
          <UtensilsCrossed size={17} className="text-blue-700" />
          Platos de este plan
        </h2>
        <p className="text-[13px] text-tinta-2">
          Lo que el cliente puede elegir en su check-in. El plato vive en el plan, no en la
          reserva.
        </p>
      </div>

      {nivel === 'diamond' && (
        <p className="text-[14px] text-tinta-2 bg-fondo rounded-xl px-3 py-2.5">
          Diamond no tiene opciones: no se le pregunta al cliente. Si le agregas platos aquí, no
          se van a ofrecer.
        </p>
      )}

      {platos.length === 0 ? (
        <p className="text-[15px] text-tinta-2">
          Sin platos. Quien tenga este plan no elige almuerzo: cocina prepara lo de siempre.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-linea">
          {platos.map(p => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] text-tinta">{p.nombre_es}</span>
                <span className="block text-[13px] text-tinta-2">{p.nombre_en}</span>
              </span>
              <button
                onClick={() => quitar(p.id)}
                aria-label={`Quitar ${p.nombre_es}`}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-tinta-2 hover:text-peligro-500 hover:bg-peligro-50"
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <Input label="En español" value={es} onChange={e => setEs(e.target.value)} />
        <Input label="En inglés" value={en} onChange={e => setEn(e.target.value)} />
        <Button variant="secondary" onClick={agregar} loading={guardando}>
          <Plus size={15} />
          Agregar
        </Button>
      </div>
    </Card>
  )
}

// La traducción de la bitácora vive en `lib/bitacora.js`: la usan esta ficha y
// la pantalla de Actividad, y estaba escrita dos veces.
