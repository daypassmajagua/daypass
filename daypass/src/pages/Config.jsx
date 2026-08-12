import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Layers, ChevronRight, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { classNames, formatCurrency } from '../lib/utils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import DatePicker from '../components/ui/DatePicker'
import BotonIcono from '../components/ui/BotonIcono'
import Pestanas from '../components/ui/Pestanas'
import Casilla from '../components/ui/Casilla'
import PageHeader from '../components/layout/PageHeader'
import HoraDeZarpe from '../components/config/HoraDeZarpe'
import ModoDelAparato from '../components/config/ModoDelAparato'
import { ListaDelDia, ConfirmarAccion, SeccionFormulario } from '../components/patrones'

/**
 * Los catálogos: planes, lanchas, temporadas y agencias.
 *
 * Reescrita con los patrones extraídos, como prueba de que alcanzan. Lo que
 * había antes eran **cuatro tablas casi idénticas** —una por catálogo, cada una
 * repitiendo su encabezado y sus botones— y el mismo ternario de cuatro ramas
 * copiado en cuatro funciones para resolver "¿a qué tabla le pego?".
 *
 * Ahora cada catálogo se declara una vez en `CATALOGOS`: su tabla, cómo se
 * ordena, qué columnas tiene y qué campos pide. Agregar el quinto catálogo es
 * agregar un objeto, no copiar 40 líneas de `<table>`.
 *
 * Lo que se ganó de paso, y que ninguna de las cuatro tablas tenía: los tres
 * estados. Antes, si la consulta fallaba, la tabla salía vacía y parecía que
 * no había planes.
 */

/** El campo que dice si algo está activo cambia de nombre según la tabla. */
const activoDe = (fila, campo) => fila[campo] !== false

const CATALOGOS = {
  planes: {
    etiqueta: 'Planes',
    singular: 'plan',
    articulo: 'Nuevo',
    crearPrimero: 'Crear el primer plan',
    tabla: 'planes',
    orden: 'nombre',
    campoActivo: 'activo',
    /**
     * El primer catálogo con ficha propia: la fila lleva a un lugar en vez de
     * abrir una ventana. Los platos y la historia de precios no caben en un
     * modal, y una dirección se puede compartir y buscar.
     */
    ficha: p => `/config/planes/${p.id}`,
    vacio: {
      titulo: 'Todavía no hay planes',
      detalle: 'El plan da la tarifa de cada reserva y decide qué platos se pueden elegir.',
    },
    /** Lo que se ve de un plan en la lista, en orden de importancia. */
    fila: p => ({
      titulo: p.nombre,
      detalle: [p.categoria, p.nivel && p.nivel !== 'na' ? p.nivel : null].filter(Boolean).join(' · '),
      datos: [
        { etiqueta: 'Adulto baja', valor: formatCurrency(p.precio_adulto_baja) },
        { etiqueta: 'Adulto alta', valor: formatCurrency(p.precio_adulto_alta) },
        { etiqueta: 'Niño baja', valor: formatCurrency(p.precio_nino_baja) },
        { etiqueta: 'Niño alta', valor: formatCurrency(p.precio_nino_alta) },
      ],
    }),
  },

  lanchas: {
    etiqueta: 'Lanchas',
    singular: 'lancha',
    articulo: 'Nueva',
    crearPrimero: 'Crear la primera lancha',
    tabla: 'lanchas',
    orden: 'nombre',
    campoActivo: 'activa',
    vacio: {
      titulo: 'Todavía no hay lanchas',
      detalle: 'Sin lanchas no se puede crear una reserva: toda reserva viaja en una.',
    },
    fila: l => ({
      titulo: l.nombre,
      detalle: l.codigo,
      datos: [{ etiqueta: 'Capacidad', valor: l.capacidad ? `${l.capacidad} asientos` : '—' }],
    }),
  },

  temporadas: {
    etiqueta: 'Temporadas',
    singular: 'temporada',
    articulo: 'Nueva',
    crearPrimero: 'Crear la primera temporada',
    tabla: 'temporadas',
    // Su ficha dice cuántas reservas cayeron en esas fechas — que es lo que
    // uno quiere saber antes de mover el borde de una temporada.
    ficha: t => `/config/temporadas/${t.id}`,
    orden: 'fecha_inicio',
    campoActivo: null,   // una temporada no se desactiva: se le cambian las fechas
    vacio: {
      titulo: 'Todavía no hay temporadas',
      detalle: 'La temporada sale de la fecha de la reserva y decide qué precio se congela.',
    },
    fila: t => ({
      titulo: t.nombre,
      detalle: t.tipo === 'alta' ? 'Temporada alta' : 'Temporada baja',
      datos: [
        { etiqueta: 'Desde', valor: t.fecha_inicio },
        { etiqueta: 'Hasta', valor: t.fecha_fin },
      ],
    }),
  },

  agencias: {
    etiqueta: 'Agencias',
    singular: 'agencia',
    articulo: 'Nueva',
    crearPrimero: 'Crear la primera agencia',
    // La tabla se llama `organizaciones` desde la 020: guarda también
    // instituciones, proveedores y aliados. Aquí se muestran todas porque
    // Config es donde se administran; el tipo las distingue.
    tabla: 'organizaciones',
    orden: 'nombre',
    campoActivo: 'activa',
    vacio: {
      titulo: 'Todavía no hay agencias',
      detalle: 'Se pueden crear reservas sin agencia: el canal directo no la necesita.',
    },
    fila: a => ({
      titulo: a.nombre,
      detalle: a.contacto || null,
      datos: a.email ? [{ etiqueta: 'Correo', valor: a.email }] : [],
    }),
  },

  // Los dos que no se podían administrar desde ninguna parte hasta la 027, y
  // uno de ellos bloqueaba la primera reserva: `registros.canal_id` es NOT
  // NULL, así que sin canales no se puede vender nada.
  canales: {
    etiqueta: 'Canales',
    singular: 'canal',
    articulo: 'Nuevo',
    crearPrimero: 'Crear el primer canal',
    tabla: 'canales',
    orden: 'nombre',
    campoActivo: null,   // no tiene bandera de activo: son cinco y no cambian
    vacio: {
      titulo: 'No hay canales de venta',
      detalle: 'Sin al menos uno no se puede crear una reserva: toda reserva entra por algún lado.',
    },
    fila: c => ({ titulo: c.nombre, detalle: c.codigo, datos: [] }),
  },

  paises: {
    etiqueta: 'Países',
    singular: 'país',
    articulo: 'Nuevo',
    crearPrimero: 'Agregar el primer país',
    tabla: 'paises',
    orden: 'nombre',
    campoActivo: null,
    vacio: {
      titulo: 'No hay países',
      detalle: 'La Capitanía exige la nacionalidad de cada persona en la lista nominal.',
    },
    fila: p => ({
      titulo: p.nombre,
      // Los 249 de la ISO caben; los que llegan seguido van marcados, porque
      // son los que salen primero cuando alguien elige un país.
      detalle: [p.codigo, p.frecuente ? 'de los que llegan seguido' : null]
        .filter(Boolean).join(' · '),
      datos: [],
    }),
  },
}

const CLAVES = Object.keys(CATALOGOS)

/** La base maneja el id y las marcas de tiempo; el formulario no las manda. */
function sinColumnasDeSistema(fila) {
  const copia = { ...fila }
  delete copia.id
  delete copia.created_at
  delete copia.updated_at
  return copia
}

// ─── Una fila de catálogo ─────────────────────────────────────────────────────

function FilaCatalogo({ fila, config, onEditar, onEliminar, onAlternar }) {
  const vista = config.fila(fila)
  const activo = config.campoActivo ? activoDe(fila, config.campoActivo) : true

  return (
    <div className={classNames(
      'bg-white rounded-2xl px-4 py-3.5 flex items-center gap-4 flex-wrap shadow-[0_1px_2px_rgba(22,24,44,.05)]',
      !activo && 'opacity-55'
    )}>
      <div className="min-w-0 flex-1">
        {config.ficha ? (
          <Link to={config.ficha(fila)} className="font-bold text-[15px] text-tinta truncate block hover:text-blue-700">
            {vista.titulo}
          </Link>
        ) : (
          <p className="font-bold text-[15px] text-tinta truncate">{vista.titulo}</p>
        )}
        {vista.detalle && <p className="text-[13px] text-tinta-2 truncate">{vista.detalle}</p>}
      </div>

      {/* Rejilla de ancho fijo, no flex: con flex cada fila reparte el espacio
          según lo que mida su propio contenido, y las columnas de precio
          quedan escalonadas entre filas. La regla 4 del sistema visual es que
          los números se alineen en columna — de eso viven los precios. */}
      {vista.datos?.length > 0 && (
        <div className="grid grid-flow-col auto-cols-[7rem] gap-x-2">
          {vista.datos.map(d => (
            <span key={d.etiqueta} className="flex flex-col text-right">
              <span className="text-[11px] font-bold uppercase tracking-wide text-tinta-2">
                {d.etiqueta}
              </span>
              <span className="text-[14px] text-tinta tabular">{d.valor}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {config.campoActivo && (
          <BotonIcono
            onClick={() => onAlternar(fila)}
            etiqueta={activo ? `Desactivar ${vista.titulo}` : `Activar ${vista.titulo}`}
            titulo={activo ? 'Activo — tócalo para desactivar' : 'Desactivado'}
          >
            {activo
              ? <ToggleRight size={20} className="text-verde-500" />
              : <ToggleLeft size={20} className="text-tinta-2" />}
          </BotonIcono>
        )}
        {config.ficha ? (
          <BotonIcono as={Link} to={config.ficha(fila)} etiqueta={`Abrir ${vista.titulo}`}>
            <ChevronRight size={18} />
          </BotonIcono>
        ) : (
          <BotonIcono onClick={() => onEditar(fila)} etiqueta={`Editar ${vista.titulo}`}>
            <Edit2 size={16} />
          </BotonIcono>
        )}
        <BotonIcono tono="peligro" onClick={() => onEliminar(fila)} etiqueta={`Eliminar ${vista.titulo}`}>
          <Trash2 size={16} />
        </BotonIcono>
      </div>
    </div>
  )
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

/**
 * Los catálogos, servidos por sección.
 *
 * Antes era una sola pantalla con todas las pestañas. Ahora Configuración es
 * un contenedor con secciones (`Configuracion.jsx`) y cada una pide lo suyo:
 * «Agencias» trae un catálogo, «Ajustes de la operación» trae dos más las
 * horas y el modo del aparato. Cuando la sección trae uno solo, la barra de
 * pestañas no aparece — una pestaña sola no es una elección.
 */
export default function Config({
  soloClaves,
  titulo = 'Configuración',
  subtitulo = 'Lo que la operación puede cambiar sin tocar el sistema',
  conAjustes = false,
}) {
  const claves = soloClaves?.length ? soloClaves : CLAVES
  const [clave, setClave] = useState(claves[0])
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null)     // {} = nuevo · fila = editar
  const [eliminando, setEliminando] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const config = CATALOGOS[clave]

  /**
   * Buscar dentro del catálogo, y solo si hace falta. Los países pasaron de
   * veinte a 249 con la 028: sin esto, cambiar el nombre de Zimbabue son diez
   * segundos de rueda del ratón. Los otros catálogos tienen doce filas y un
   * campo de búsqueda encima solo sería una cosa más.
   */
  const conBuscador = filas.length > 20
  const visibles = conBuscador && busqueda.trim()
    ? filas.filter(f => {
        const q = busqueda.trim().toLowerCase()
        return String(f.nombre || '').toLowerCase().includes(q)
          || String(f.codigo || '').toLowerCase().includes(q)
      })
    : filas

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase
      .from(config.tabla).select('*').order(config.orden)
    if (err) setError(err)
    else setFilas(data || [])
    setCargando(false)
  }, [config.tabla, config.orden])

  useEffect(() => { cargar() }, [cargar])

  async function alternar(fila) {
    const valor = !activoDe(fila, config.campoActivo)
    const { error: err } = await supabase
      .from(config.tabla)
      .update({ [config.campoActivo]: valor })
      .eq('id', fila.id)
    if (err) { toast.error('No se pudo cambiar. ' + err.message); return }
    // Se desactivan, no se borran: lo viejo tiene que seguir apuntando a algo.
    toast.success(valor ? 'Vuelve a estar disponible' : 'Ya no se puede elegir en reservas nuevas')
    cargar()
  }

  async function eliminar() {
    setBorrando(true)
    const { error: err } = await supabase.from(config.tabla).delete().eq('id', eliminando.id)
    setBorrando(false)
    if (err) {
      // Casi siempre es una llave foránea: alguien lo está usando.
      toast.error('No se pudo eliminar. Puede que haya reservas que lo usen — desactívalo en vez de borrarlo.')
      return
    }
    toast.success('Eliminado')
    setEliminando(null)
    cargar()
  }

  return (
    <div className="marco py-6">
      <PageHeader
        title={titulo}
        subtitle={subtitulo}
        actions={
          <Button size="sm" onClick={() => setEditando({})}>
            <Plus size={14} />
            {config.articulo} {config.singular}
          </Button>
        }
      />

      {/* Arriba de los catálogos: no son listas, son decisiones sueltas que
          cambian lo que el cliente puede hacer desde su celular y cómo se ve
          este aparato. Solo en la sección de operación. */}
      {conAjustes && (
        <>
          <HoraDeZarpe />
          <div className="mb-5">
            <ModoDelAparato />
          </div>
        </>
      )}

      {/* Los catálogos. No es un filtro —no se puede "limpiar"— así que no usa
          FiltroBarra: sería forzar un patrón donde no encaja. */}
      <Pestanas
        className="mb-5"
        valor={clave}
        onCambiar={setClave}
        opciones={claves.map(k => ({ id: k, etiqueta: CATALOGOS[k].etiqueta }))}
      />

      {conBuscador && (
        <div className="flex items-center gap-2 bg-white rounded-xl border border-linea px-3 mb-4">
          <Search size={16} className="shrink-0 text-tinta-3" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder={`Buscar entre ${filas.length}`}
            className="w-full bg-transparent py-2.5 min-h-[44px] text-[15px] text-tinta placeholder-tinta-3 focus:outline-none"
          />
        </div>
      )}

      <ListaDelDia
        items={visibles}
        buscando={Boolean(busqueda.trim())}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        vacio={{
          icono: Layers,
          ...config.vacio,
          accion: { etiqueta: config.crearPrimero, onClick: () => setEditando({}) },
        }}
      >
        {fila => (
          <FilaCatalogo
            fila={fila}
            config={config}
            onEditar={setEditando}
            onEliminar={setEliminando}
            onAlternar={alternar}
          />
        )}
      </ListaDelDia>

      {editando && (
        <FormularioCatalogo
          config={config}
          item={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar() }}
        />
      )}

      {/* Borrar un catálogo no se deshace, así que aquí sí se pregunta — y se
          dice qué va a pasar, no "¿estás seguro?". */}
      <ConfirmarAccion
        abierto={Boolean(eliminando)}
        titulo={`Eliminar ${config.singular}`}
        etiquetaConfirmar="Eliminar"
        variante="danger"
        cargando={borrando}
        onConfirmar={eliminar}
        onCancelar={() => setEliminando(null)}
      >
        <p>
          Se va a eliminar <b>{eliminando ? config.fila(eliminando).titulo : ''}</b> y no se puede
          deshacer.
        </p>
        {config.campoActivo && (
          <p className="mt-2 text-tinta-2">
            Si ya hay reservas que lo usan, es mejor <b>desactivarlo</b>: deja de aparecer en
            reservas nuevas y lo viejo sigue cuadrando.
          </p>
        )}
      </ConfirmarAccion>
    </div>
  )
}

// ─── El formulario ────────────────────────────────────────────────────────────

/**
 * Un solo formulario para los cuatro catálogos. Los campos se declaran por
 * catálogo aquí abajo, no en cuatro bloques `{tab === '…' && …}` como antes.
 */
function FormularioCatalogo({ config, item, onCerrar, onGuardado }) {
  const esEdicion = Boolean(item?.id)
  const [form, setForm] = useState(item)
  const [guardando, setGuardando] = useState(false)

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  async function guardar() {
    setGuardando(true)
    // Se quitan las columnas que maneja la base, no el formulario.
    const payload = sinColumnasDeSistema(form)
    const { error } = esEdicion
      ? await supabase.from(config.tabla).update(payload).eq('id', item.id)
      : await supabase.from(config.tabla).insert(payload)
    setGuardando(false)
    if (error) { toast.error('No se pudo guardar. ' + error.message); return }
    toast.success(esEdicion ? 'Guardado' : `${config.etiqueta.slice(0, -1)} creada`)
    onGuardado()
  }

  return (
    <Modal
      open
      onClose={onCerrar}
      title={esEdicion
        ? `Editar ${config.singular}`
        : `${config.articulo} ${config.singular}`}
    >
      <div className="flex flex-col gap-4 max-h-[62vh] overflow-y-auto -mx-1 px-1">
        <CamposDe tabla={config.tabla} form={form} set={set} />
      </div>

      <div className="flex gap-3 justify-end mt-5">
        <Button variant="ghost" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button loading={guardando} onClick={guardar}>
          {esEdicion ? 'Guardar cambios' : 'Crear'}
        </Button>
      </div>
    </Modal>
  )
}

const CATEGORIAS_PLAN = [
  'rack', 'rack_descuento', 'mayorista', 'mayorista_exterior', 'fidelidad',
  'corporativo', 'grupo_neto', 'almuerzo_sin_transporte', 'guia',
  'solo_transporte', 'blue_dive',
]

function CamposDe({ tabla, form, set }) {
  if (tabla === 'planes') {
    return (
      <>
        <SeccionFormulario titulo="Qué plan es" porque="El nombre es lo que Daniela busca al crear una reserva.">
          <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
          <Select
            label="Categoría" value={form.categoria || ''} onChange={v => set('categoria', v)}
            placeholder="— Categoría —"
            options={CATEGORIAS_PLAN.map(c => ({ value: c, label: c.replace(/_/g, ' ') }))}
          />
          <Select
            label="Nivel" value={form.nivel || 'na'} onChange={v => set('nivel', v)}
            options={[
              { value: 'na', label: 'Sin nivel' },
              { value: 'silver', label: 'Silver' },
              { value: 'gold', label: 'Gold' },
              { value: 'diamond', label: 'Diamond' },
            ]}
          />
        </SeccionFormulario>

        <SeccionFormulario
          titulo="Precios"
          porque="El precio se congela al crear la reserva: cambiarlo aquí no toca las que ya existen."
        >
          <div className="grid grid-cols-2 gap-3">
            <Input label="Adulto · baja" type="number" value={form.precio_adulto_baja ?? 0} onChange={e => set('precio_adulto_baja', +e.target.value)} />
            <Input label="Adulto · alta" type="number" value={form.precio_adulto_alta ?? 0} onChange={e => set('precio_adulto_alta', +e.target.value)} />
            <Input label="Niño · baja" type="number" value={form.precio_nino_baja ?? 0} onChange={e => set('precio_nino_baja', +e.target.value)} />
            <Input label="Niño · alta" type="number" value={form.precio_nino_alta ?? 0} onChange={e => set('precio_nino_alta', +e.target.value)} />
          </div>
          {/* `!== false` y no `!!`: un registro nuevo trae el campo en
              `undefined` y nace **activo**. Con la comparación simple, cada
              plan creado saldría desactivado sin que nadie lo pidiera. */}
          <Casilla etiqueta="Se puede elegir en reservas nuevas" valor={form.activo !== false} onChange={v => set('activo', v)} />
        </SeccionFormulario>
      </>
    )
  }

  if (tabla === 'lanchas') {
    return (
      <SeccionFormulario titulo="La lancha" porque="La capacidad es lo que avisa del sobrecupo al cerrar el día.">
        <Input label="Código" value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} />
        <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
        <Input label="Capacidad" type="number" value={form.capacidad || ''} onChange={e => set('capacidad', +e.target.value)} />
        <Casilla etiqueta="Se puede elegir en reservas nuevas" valor={form.activa !== false} onChange={v => set('activa', v)} />
      </SeccionFormulario>
    )
  }

  if (tabla === 'temporadas') {
    return (
      <SeccionFormulario
        titulo="La temporada"
        porque="Sale de la fecha de la reserva y decide qué precio del plan se aplica."
      >
        <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
        <Select
          label="Tipo" value={form.tipo || 'baja'} onChange={v => set('tipo', v)}
          options={[{ value: 'baja', label: 'Baja' }, { value: 'alta', label: 'Alta' }]}
        />
        <DatePicker label="Desde" value={form.fecha_inicio || ''} onChange={v => set('fecha_inicio', v)} />
        <DatePicker label="Hasta" value={form.fecha_fin || ''} onChange={v => set('fecha_fin', v)} />
      </SeccionFormulario>
    )
  }

  // Países y canales caían aquí, en el formulario de la agencia: agregar un
  // país pedía «Contacto» y «Correo», y al guardar escribía columnas que la
  // tabla no tiene. Nunca se notó porque nadie había agregado un país a mano.
  if (tabla === 'paises') {
    return (
      <SeccionFormulario
        titulo="El país"
        porque="La Capitanía exige la nacionalidad de cada persona en la lista nominal."
      >
        <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
        <Input
          label="Código"
          value={form.codigo || ''}
          maxLength={2}
          onChange={e => set('codigo', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        />
        <p className="text-[13px] text-tinta-2 -mt-1">
          Dos letras, como en el pasaporte: CO, US, BR.
        </p>
        <Casilla
          etiqueta="De los que llegan seguido — sale primero en la lista"
          valor={form.frecuente === true}
          onChange={v => set('frecuente', v)}
        />
      </SeccionFormulario>
    )
  }

  if (tabla === 'canales') {
    return (
      <SeccionFormulario titulo="El canal" porque="Por dónde entró la reserva. Toda reserva trae uno.">
        <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
        <Input
          label="Código"
          value={form.codigo || ''}
          onChange={e => set('codigo', e.target.value.toLowerCase().replace(/[^a-z_]/g, ''))}
        />
      </SeccionFormulario>
    )
  }

  return (
    <SeccionFormulario titulo="La agencia" porque="El contacto es a quién se le pide el listado de pasajeros.">
      <Input label="Nombre" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} />
      <Input label="Contacto" value={form.contacto || ''} onChange={e => set('contacto', e.target.value)} />
      <Input label="Correo" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
      <Casilla etiqueta="Se puede elegir en reservas nuevas" valor={form.activa !== false} onChange={v => set('activa', v)} />
    </SeccionFormulario>
  )
}
