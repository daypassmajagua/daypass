import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Calculator, Info, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { useTemporada } from '../hooks/useTemporada'
import { useRegistros } from '../hooks/useRegistros'
import { usePasajeros, guardarPasajeros } from '../hooks/usePasajeros'
import { useAutoguardado, leerBorrador, borrarBorrador } from '../hooks/useBorrador'
import { abrirWhatsApp } from '../lib/enlaceReserva'
import {
  aFechaLocal, formatCurrency, hoyLocal, limpiarVacios, plural, FORMA_PAGO_LABELS,
} from '../lib/utils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Stepper from '../components/ui/Stepper'
import DatePicker from '../components/ui/DatePicker'
import BuscadorAgencia from '../components/ui/BuscadorAgencia'
import TarjetasPlan from '../components/reserva/TarjetasPlan'
import FichasLancha from '../components/reserva/FichasLancha'
import PrecargaPersona from '../components/reserva/PrecargaPersona'
import SeccionPasajeros from '../components/pasajeros/SeccionPasajeros'
import HistoriaDeLaReserva from '../components/reserva/HistoriaDeLaReserva'
import PageHeader from '../components/layout/PageHeader'
import { RESERVA_CON_DINERO } from '../lib/columnas'
import { opcionesDePais } from '../lib/paisesISO'
import { InsigniaEstado } from '../components/patrones'

/**
 * Los dos estados que se eligen a mano. El resto —en la isla, completada, no
 * llegó— los pone la operación al embarcar y al recibir (regla 3), y por eso
 * no se ofrecen en un formulario.
 */
const MANUALES = ['confirmada', 'tentativa']

/**
 * Un texto que puede no estar — y que en la base **está en null**, no ausente.
 *
 * ── El error que rompía la edición entera ───────────────────────────────────
 *
 * `z.string().optional()` acepta `undefined`, **no `null`**. Y al abrir una
 * reserva guardada, `reset(data)` mete en el formulario exactamente lo que hay
 * en la base: `nombre_grupo`, `identificacion`, `pais_id`, `agencia_nombre`,
 * `forma_pago`, `voucher_os`, `folio_zeus`, `observaciones`, `vendida_por` —
 * casi todos null en casi toda reserva.
 *
 * Resultado: la validación fallaba antes de intentar guardar, con un mensaje
 * de Zod en inglés («Expected string, received null») en campos que quizá ni
 * se ven en pantalla. **Desde afuera se veía como que el botón no hacía
 * nada.** Y no era una reserva rara: era casi cualquiera.
 *
 * El `''` de salida no llega así a la base: `limpiarVacios` lo vuelve null
 * antes del guardado, que es lo que Postgres necesita en una columna uuid.
 */
const textoOpcional = z.string().nullish().transform(v => (v ?? '').trim())

const schema = z.object({
  fecha: z.string().min(1),
  tipo: z.enum(['individual', 'grupo']),
  estado: z.string().default('confirmada'),
  nombre_pasajero: z.string().min(1, 'Falta el nombre'),
  nombre_grupo: textoOpcional,
  identificacion: textoOpcional,
  lancha_id: z.string().min(1, 'Elige una lancha'),
  pais_id: textoOpcional,
  plan_id: z.string().min(1, 'Elige un plan'),
  canal_id: z.string().min(1, 'Falta el canal'),
  agencia_nombre: textoOpcional,
  /**
   * El contacto: se pide, pero no se exige.
   *
   * Era obligatorio, y eso rompía la edición de un modo que costaba ver: una
   * reserva vieja —o de agencia, donde el contacto es la agencia y no el
   * pasajero— tiene `telefono` y `email` en null. Al abrirla, `reset(data)`
   * mete esos null en el formulario, `z.string()` los rechaza con «Expected
   * string, received null» y **el guardado nunca llega a salir**. Desde afuera
   * se ve como que el botón no hace nada.
   *
   * Sin contacto no hay enlace de check-in, que es real y hay que decirlo —lo
   * dice la pantalla, debajo del campo— pero eso no puede impedir corregir la
   * lancha de un grupo a las siete de la mañana.
   */
  telefono: z.string().nullish().transform(v => v?.trim() || '')
    .refine(v => !v || v.length >= 7, 'Ese teléfono se ve corto'),
  email: z.string().nullish().transform(v => v?.trim() || '')
    .refine(v => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Ese correo no se ve bien'),
  // `tipo_ingreso_id` es nullable en la base: la 007 lo agregó a una tabla que
  // ya tenía reservas. Exigirlo aquí dejaba sin editar todo lo anterior a esa
  // migración. Se pide al crear —el efecto lo pone en «pasadía»— pero no se
  // bloquea al corregir una vieja.
  tipo_ingreso_id: textoOpcional,
  cobra_cupo: z.boolean().nullish().transform(v => v ?? false),
  valor_cupo: z.coerce.number().min(0).nullish().transform(v => v ?? 0),
  adultos: z.coerce.number().min(1, 'Mínimo 1 adulto'),
  ninos: z.coerce.number().min(0).default(0),
  infantes: z.coerce.number().min(0).default(0),
  cortesias: z.coerce.number().min(0).default(0),
  precio_adulto: z.coerce.number().min(0),
  precio_nino: z.coerce.number().min(0).default(0),
  precio_lancha: z.coerce.number().min(0).default(0),
  forma_pago: textoOpcional,
  // Con `default` basta: la columna es NOT NULL en la base, así que nunca
  // llega null desde una reserva guardada.
  impuestos_puerto: z.enum(['si', 'no', 'exe']).default('si'),
  voucher_os: textoOpcional,
  folio_zeus: textoOpcional,
  observaciones: textoOpcional,
  vendida_por: textoOpcional,
}).refine(d => !(d.tipo === 'grupo' && !d.nombre_grupo), {
  message: 'Falta el nombre del grupo', path: ['nombre_grupo'],
})

/** Casi todo se carga para el día siguiente, no para hoy. */
function manana() {
  const [y, m, d] = hoyLocal().split('-').map(Number)
  return aFechaLocal(new Date(y, m - 1, d + 1))
}

/**
 * El titular ya escribió su nombre arriba. Pedírselo otra vez como "pasajero"
 * es un paso de más, y en una reserva individual de una persona deja la lista
 * en 0/1 sin razón. Se siembra solo, y solo si no está ya en la lista.
 *
 * En un grupo no: ahí el titular suele ser el contacto de la agencia y puede
 * no viajar.
 */
function conTitular(data, pasajeros) {
  if (data.tipo === 'grupo') return pasajeros
  const nombre = (data.nombre_pasajero || '').trim()
  if (!nombre) return pasajeros

  const normal = s => (s || '').trim().toLowerCase()
  if (pasajeros.some(p => normal(p.nombre) === normal(nombre))) return pasajeros

  const total = (Number(data.adultos) || 0) + (Number(data.ninos) || 0) +
                (Number(data.infantes) || 0) + (Number(data.cortesias) || 0)
  if (pasajeros.filter(p => (p.nombre || '').trim()).length >= total) return pasajeros

  return [
    {
      nombre,
      documento: (data.identificacion || '').trim(),
      tipo_documento: 'cc',
      pais_id: data.pais_id || '',
      categoria: 'adulto',
    },
    ...pasajeros,
  ]
}

function Seccion({ numero, titulo, children }) {
  return (
    <Card className="p-5 flex flex-col gap-4">
      <h2 className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-.01em] text-tinta">
        <span className="w-7 h-7 shrink-0 rounded-lg bg-blue-50 text-blue-700 text-sm font-bold flex items-center justify-center tabular">
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </Card>
  )
}

export default function Reserva() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { fechaActiva } = useAppStore()

  const [lanchas, setLanchas] = useState([])
  const [planes, setPlanes] = useState([])
  const [canales, setCanales] = useState([])
  const [paises, setPaises] = useState([])
  const [agencias, setAgencias] = useState([])
  const [tiposIngreso, setTiposIngreso] = useState([])
  const [opcionesPlato, setOpcionesPlato] = useState([])
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [borradorRecuperado, setBorradorRecuperado] = useState(false)
  const yaRestaure = useRef(false)

  const { pasajeros, setPasajeros } = usePasajeros(id)

  const {
    register, handleSubmit, watch, setValue, control, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      // Al crear se asume mañana; al editar manda la fecha de la reserva.
      fecha: isEdit ? fechaActiva : manana(),
      tipo: 'individual',
      estado: 'confirmada',
      adultos: 1, ninos: 0, infantes: 0, cortesias: 0,
      precio_adulto: 0, precio_nino: 0, precio_lancha: 0,
      impuestos_puerto: 'si',
    },
  })

  const valores = watch()
  const fechaValue = valores.fecha
  const { temporada, supuesta } = useTemporada(fechaValue)

  // Las reservas del día, para dibujar la ocupación de cada lancha.
  const { registros: delDia } = useRegistros(fechaValue)

  const paxNuevos = (Number(valores.adultos) || 0) + (Number(valores.ninos) || 0)

  const ocupacion = useMemo(() => {
    const mapa = {}
    delDia
      .filter(r => !['cancelada', 'noshow'].includes(r.estado) && r.id !== id)
      .forEach(r => {
        mapa[r.lancha_id] = (mapa[r.lancha_id] || 0) + r.adultos + r.ninos
      })
    return mapa
  }, [delDia, id])

  // Las agencias que más reservan aparecen de primeras.
  const frecuentes = useMemo(() => {
    const conteo = {}
    delDia.forEach(r => { if (r.agencia_nombre) conteo[r.agencia_nombre] = (conteo[r.agencia_nombre] || 0) + 1 })
    return Object.entries(conteo).sort((a, b) => b[1] - a[1]).map(([n]) => n)
  }, [delDia])

  useEffect(() => {
    async function cargar() {
      const [l, p, c, pa, a, ti, op] = await Promise.all([
        supabase.from('lanchas').select('*').eq('activa', true).order('nombre'),
        supabase.from('planes').select('*').eq('activo', true).order('nombre'),
        supabase.from('canales').select('*').order('nombre'),
        supabase.from('paises').select('*').order('nombre'),
        supabase.from('organizaciones').select('*').eq('activa', true).order('nombre'),
        supabase.from('tipos_ingreso').select('*').eq('activo', true),
        supabase.from('opciones_plato').select('*').eq('activo', true),
      ])
      setLanchas(l.data || []); setPlanes(p.data || []); setCanales(c.data || [])
      setPaises(pa.data || []); setAgencias(a.data || [])
      setTiposIngreso(ti.data || []); setOpcionesPlato(op.data || [])
      setCargandoCatalogos(false)
    }
    cargar()
  }, [])

  // Al editar, la fuente de verdad es la base.
  useEffect(() => {
    if (!isEdit || !id) return
    supabase.from('reservas').select(RESERVA_CON_DINERO).eq('id', id).single().then(({ data }) => {
      if (data) reset(data)
    })
  }, [id, isEdit, reset])

  // Borrador: si la llamaron por teléfono a mitad de captura, al volver
  // el formulario está como lo dejó.
  useEffect(() => {
    if (isEdit || yaRestaure.current || cargandoCatalogos) return
    yaRestaure.current = true
    const b = leerBorrador()
    if (b?.valores?.nombre_pasajero) {
      reset(b.valores)
      setPasajeros(b.pasajeros || [])
      setBorradorRecuperado(true)
    }
  }, [isEdit, cargandoCatalogos, reset, setPasajeros])

  useAutoguardado(!isEdit && !cargandoCatalogos, valores, pasajeros)

  // El plan y la temporada resuelven el precio; se puede ajustar a mano.
  useEffect(() => {
    if (!valores.plan_id || !temporada || cargandoCatalogos) return
    const plan = planes.find(p => p.id === valores.plan_id)
    if (!plan) return
    setValue('precio_adulto', (temporada === 'alta' ? plan.precio_adulto_alta : plan.precio_adulto_baja) || 0)
    setValue('precio_nino', (temporada === 'alta' ? plan.precio_nino_alta : plan.precio_nino_baja) || 0)
  }, [valores.plan_id, temporada, planes, setValue, cargandoCatalogos])

  // Lancha sugerida POR PRIORIDAD (regla v5): Majagua 1 y Majagua 2 siempre
  // primero; las demás solo entran cuando esas se llenan. La prioridad es un
  // campo editable de la lancha, no código duro.
  useEffect(() => {
    if (isEdit || cargandoCatalogos || valores.lancha_id || !lanchas.length) return
    const porPrioridad = [...lanchas]
      .filter(l => l.capacidad)
      .sort((a, b) => (a.prioridad ?? 999) - (b.prioridad ?? 999))
    const conCupo = porPrioridad.find(
      l => (ocupacion[l.id] || 0) + Math.max(1, paxNuevos) <= l.capacidad
    )
    // Si ninguna tiene cupo, se sugiere la de mayor prioridad igual:
    // el sobrecupo se ve en la ficha y lo decide ella.
    setValue('lancha_id', (conCupo || porPrioridad[0]).id)
  }, [isEdit, cargandoCatalogos, lanchas, ocupacion, valores.lancha_id, paxNuevos, setValue])

  // El tipo de ingreso arranca en pasadía apenas cargue el catálogo.
  useEffect(() => {
    if (cargandoCatalogos || valores.tipo_ingreso_id || !tiposIngreso.length) return
    const pasadia = tiposIngreso.find(t => t.codigo === 'pasadia')
    if (pasadia) setValue('tipo_ingreso_id', pasadia.id)
  }, [cargandoCatalogos, tiposIngreso, valores.tipo_ingreso_id, setValue])

  const tipoIngresoElegido = tiposIngreso.find(t => t.id === valores.tipo_ingreso_id)

  // Las opciones de plato del plan elegido (Diamond no tiene → no se pregunta).
  const opcionesDelPlan = useMemo(
    () => opcionesPlato.filter(o => o.plan_id === valores.plan_id),
    [opcionesPlato, valores.plan_id]
  )

  const totalAdultos = (Number(valores.adultos) || 0) * (Number(valores.precio_adulto) || 0)
  const totalNinos = (Number(valores.ninos) || 0) * (Number(valores.precio_nino) || 0)
  const totalLancha = Number(valores.precio_lancha) || 0
  const total = totalAdultos + totalNinos + totalLancha

  /**
   * Cuando el formulario no pasa la validación.
   *
   * React Hook Form enfoca el primer campo con error, pero si ese campo está
   * fuera de la pantalla —o peor, si el error es de un campo que ella nunca
   * tocó— el efecto visible es ninguno. Se nombra el campo y se dice qué pasa.
   */
  function noSePudoValidar(errores) {
    const nombres = {
      fecha: 'la fecha', nombre_pasajero: 'el nombre', nombre_grupo: 'el nombre del grupo',
      lancha_id: 'la lancha', plan_id: 'el plan', canal_id: 'el canal',
      telefono: 'el teléfono', email: 'el correo', adultos: 'los adultos',
    }
    const cuales = Object.keys(errores).map(k => nombres[k] || k)
    toast.error(
      cuales.length === 1
        ? `Falta revisar ${cuales[0]}.`
        : `Falta revisar ${cuales.slice(0, -1).join(', ')} y ${cuales[cuales.length - 1]}.`,
      { description: 'La reserva no se guardó.' }
    )
  }

  async function onSubmit(data) {
    setGuardando(true)
    const { data: sesion } = await supabase.auth.getSession()

    const payload = limpiarVacios({
      ...data,
      temporada: temporada || 'baja',
      generada_por: sesion?.session?.user?.id,
      nombre_grupo: data.tipo === 'grupo' ? data.nombre_grupo : null,
    })

    let error, registroId = id
    if (isEdit) {
      ({ error } = await supabase.from('registros').update(payload).eq('id', id))
    } else {
      const res = await supabase.from('registros').insert(payload).select().single()
      error = res.error
      registroId = res.data?.id
    }

    if (error) {
      toast.error('No se pudo guardar la reserva. ' + error.message)
      setGuardando(false)
      return
    }

    if (registroId) {
      // Solo al crear: en una edición, si ella quitó al titular de la lista
      // fue a propósito y volver a meterlo sería pelear con ella.
      const res = await guardarPasajeros(
        registroId,
        isEdit ? pasajeros : conTitular(data, pasajeros)
      )
      if (res.error) {
        toast.error('La reserva quedó guardada, pero los nombres no. Vuelve a intentarlo desde la reserva.')
      }
    }

    const lancha = lanchas.find(l => l.id === data.lancha_id)?.nombre
    const quien = data.agencia_nombre?.trim() || data.nombre_grupo?.trim() || data.nombre_pasajero
    const pax = (Number(data.adultos) || 0) + (Number(data.ninos) || 0)

    if (isEdit) {
      toast.success(`Reserva de ${quien} actualizada`)
    } else {
      borrarBorrador()
      setBorradorRecuperado(false)
      // El enlace se manda ahora, no al cerrar el día: el check-in se cierra
      // junto con el día, así que mandarlo en el cierre llega tarde siempre.
      toast.success(
        `Reserva de ${quien} guardada — ${plural(pax, 'pax', 'pax')}${lancha ? ' en ' + lancha : ''}`,
        {
          description: 'Mándale el enlace para que registre los nombres y firme.',
          duration: 10000,
          action: {
            label: 'Mandar el enlace',
            onClick: async () => {
              const { error: errEnlace } = await abrirWhatsApp({ ...data, id: registroId })
              if (errEnlace) toast.error(errEnlace.message)
            },
          },
        }
      )
      // Ella carga reservas en tanda: queda lista para la siguiente.
      setPasajeros([])
      reset({
        fecha: data.fecha, tipo: 'individual', estado: 'confirmada',
        canal_id: data.canal_id, vendida_por: data.vendida_por,
        adultos: 1, ninos: 0, infantes: 0, cortesias: 0,
        precio_adulto: 0, precio_nino: 0, precio_lancha: 0,
        impuestos_puerto: 'si',
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setGuardando(false)
  }

  if (cargandoCatalogos) {
    return <p className="max-w-3xl mx-auto px-4 py-10 text-tinta-2">Cargando lanchas, planes y tarifas…</p>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader
        title={isEdit ? 'Editar la reserva' : 'Nueva reserva'}
        subtitle={
          /**
           * Cuando ninguna temporada cubre la fecha, el sistema asume baja y
           * **congela ese precio** (regla 4). Decirlo aquí es la diferencia
           * entre un ajuste de dos minutos y una reserva vendida barata para
           * siempre que nadie descubre hasta facturar.
           */
          temporada ? (
            supuesta ? (
              <Link
                to="/config/temporadas"
                className="inline-flex items-center gap-1.5 text-[0.8125rem] px-2.5 py-1 rounded-[10px] font-bold bg-coral-50 text-coral-700 hover:bg-coral-100"
              >
                <Info size={13} />
                Esta fecha no cae en ninguna temporada cargada — se está usando el precio bajo
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-[10px] font-bold bg-blue-50 text-blue-700">
                <Info size={13} />
                Temporada {temporada === 'alta' ? 'alta' : 'baja'} — precios aplicados
              </span>
            )
          ) : null
        }
      />

      {borradorRecuperado && (
        <div className="flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 mb-5">
          <RotateCcw size={18} className="text-blue-700 shrink-0" />
          <p className="text-[15px] text-blue-700 flex-1">
            Recuperamos lo que estabas escribiendo.
          </p>
          <button
            type="button"
            onClick={() => {
              borrarBorrador(); setBorradorRecuperado(false); setPasajeros([])
              reset({
                fecha: manana(), tipo: 'individual', estado: 'confirmada',
                adultos: 1, ninos: 0, infantes: 0, cortesias: 0,
                precio_adulto: 0, precio_nino: 0, precio_lancha: 0, impuestos_puerto: 'si',
              })
            }}
            className="shrink-0 text-sm font-bold text-blue-700 underline min-h-[44px] px-2"
          >
            Empezar de cero
          </button>
        </div>
      )}

      {/**
        * Si la validación falla, se dice. Antes no: el formulario simplemente
        * no salía y el botón parecía muerto. Un fallo silencioso en el paso de
        * guardar es la peor clase de fallo — quien lo sufre no sabe si el
        * sistema está lento, roto, o si ya guardó.
        */}
      <form onSubmit={handleSubmit(onSubmit, noSePudoValidar)} className="flex flex-col gap-4">
        {/* Cuándo y qué tipo de ingreso: cambian precios, cupo y tiquetes */}
        <Card className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Controller name="fecha" control={control} render={({ field }) => (
            <DatePicker label="¿Qué día vienen?" value={field.value} onChange={field.onChange}
              error={errors.fecha?.message} />
          )} />
          <Controller name="estado" control={control} render={({ field }) => (
            /**
             * Solo dos estados se eligen a mano; los demás los dispara la
             * operación (regla 3). Pero el desplegable solo ofrecía esos dos,
             * así que una reserva que ya estaba en la isla mostraba
             * «— Seleccionar —»: la pantalla decía que no tenía estado, y el
             * primer clic la habría sacado de la isla desde un formulario.
             *
             * Ahora, cuando el estado lo puso la operación, se muestra y se
             * dice quién lo mueve. No es un campo bloqueado: es un dato.
             */
            MANUALES.includes(field.value)
              ? (
                <Select label="Estado" value={field.value} onChange={field.onChange}
                  options={[
                    { value: 'confirmada', label: 'Confirmada' },
                    { value: 'tentativa', label: 'Tentativa' },
                  ]} />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-tinta">Estado</span>
                  <div className="min-h-[44px] flex items-center">
                    <InsigniaEstado estado={field.value} />
                  </div>
                  <p className="text-[13px] text-tinta-2">
                    Lo puso el embarque, no se cambia aquí.
                  </p>
                </div>
              )
          )} />
          <Controller name="tipo_ingreso_id" control={control} render={({ field }) => (
            <Select label="Tipo de ingreso" value={field.value || ''} onChange={field.onChange}
              options={tiposIngreso.map(t => ({ value: t.id, label: t.nombre }))} />
          )} />

          {/* Proveedor: la única bandera que se decide por reserva */}
          {tipoIngresoElegido?.codigo === 'proveedor' && (
            <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-blue-50 p-4">
              <Controller name="cobra_cupo" control={control} render={({ field }) => (
                <Select
                  label="¿Se le cobra el cupo?"
                  value={field.value === true ? 'si' : field.value === false ? 'no' : ''}
                  onChange={v => field.onChange(v === 'si')}
                  placeholder="— Decidir —"
                  options={[
                    { value: 'si', label: 'Sí, se cobra' },
                    { value: 'no', label: 'No, va por cuenta del hotel' },
                  ]}
                />
              )} />
              {valores.cobra_cupo === true && (
                <Input label="Valor del cupo" type="number" min="0" {...register('valor_cupo')} />
              )}
            </div>
          )}
        </Card>

        {/* 1 · Quién viene */}
        <Seccion numero="1" titulo="¿Quién viene?">
          <Controller name="agencia_nombre" control={control} render={({ field }) => (
            <BuscadorAgencia label="Agencia o empresa (opcional)" value={field.value || ''}
              onChange={field.onChange} agencias={agencias} frecuentes={frecuentes} />
          )} />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">¿Individual o grupo?</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { valor: 'individual', etiqueta: 'Individual', ayuda: 'Una persona o familia' },
                { valor: 'grupo', etiqueta: 'Grupo', ayuda: 'Agencia, boda, empresa' },
              ].map(t => (
                <label key={t.valor} className="cursor-pointer">
                  <input type="radio" value={t.valor} {...register('tipo')} className="sr-only peer" />
                  <span className="flex flex-col rounded-xl px-4 py-3 min-h-[64px] justify-center bg-white ring-1 ring-linea peer-checked:bg-blue-600 peer-checked:ring-blue-600 peer-checked:[&_span]:text-white transition-colors">
                    <span className="font-bold text-[15px] text-tinta">{t.etiqueta}</span>
                    <span className="text-[13px] text-tinta-2">{t.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {valores.tipo === 'grupo' && (
            <Input label="Nombre del grupo" placeholder="Ej: Boda Herrera, Grupo Bavaria"
              {...register('nombre_grupo')} error={errors.nombre_grupo?.message} />
          )}

          <Input
            label={valores.tipo === 'grupo' ? 'Quién responde por el grupo' : 'Nombre del pasajero'}
            placeholder="Nombre completo"
            {...register('nombre_pasajero')} error={errors.nombre_pasajero?.message} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Documento (opcional)" placeholder="Cédula o pasaporte" {...register('identificacion')} />
            <Controller name="pais_id" control={control} render={({ field }) => (
              <Select label="País (opcional)" value={field.value || ''} onChange={field.onChange}
                placeholder="— País —"
                options={opcionesDePais(paises)} />
            )} />
          </div>

          {/* Si esa cédula ya vino antes, se ofrece lo que sabemos de ella.
              Solo al crear: en una reserva que ya existe, los datos son los que
              se acordaron ese día y no se tocan (regla 4). */}
          {!id && (
            <PrecargaPersona
              documento={valores.identificacion}
              onUsar={p => {
                setValue('nombre_pasajero', p.nombre_completo, { shouldDirty: true })
                if (p.pais_id) setValue('pais_id', p.pais_id, { shouldDirty: true })
                if (p.telefono && !valores.telefono) setValue('telefono', p.telefono, { shouldDirty: true })
                if (p.email && !valores.email) setValue('email', p.email, { shouldDirty: true })
                toast.success(`Datos de ${p.nombre_completo}`)
              }}
            />
          )}

          {/* El check-in remoto y las tarjetas viajan por aquí */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input label="Teléfono / WhatsApp" placeholder="300 123 4567" inputMode="tel"
                {...register('telefono')} error={errors.telefono?.message} />
              <p className="text-[13px] text-tinta-2 mt-1">Por aquí le llega el link de su reserva.</p>
            </div>
            <Input label="Correo" type="email" placeholder="nombre@correo.com"
              {...register('email')} error={errors.email?.message} />
          </div>
        </Seccion>

        {/* 2 · Cuántos y con qué plan */}
        <Seccion numero="2" titulo="¿Cuántos y con qué plan?">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Controller name="adultos" control={control} render={({ field }) => (
              <Stepper label="Adultos" value={field.value} onChange={field.onChange} min={1} />
            )} />
            <Controller name="ninos" control={control} render={({ field }) => (
              <Stepper label="Niños" ayuda="3 a 8 años" value={field.value} onChange={field.onChange} />
            )} />
            <Controller name="infantes" control={control} render={({ field }) => (
              <Stepper label="Infantes" ayuda="menos de 3" value={field.value} onChange={field.onChange} />
            )} />
            <Controller name="cortesias" control={control} render={({ field }) => (
              <Stepper label="Cortesías" ayuda="no pagan" value={field.value} onChange={field.onChange} />
            )} />
          </div>
          {errors.adultos && <p className="text-xs text-coral-600 font-bold">{errors.adultos.message}</p>}

          <Controller name="plan_id" control={control} render={({ field }) => (
            <TarjetasPlan planes={planes} temporada={temporada} value={field.value}
              onChange={field.onChange} error={errors.plan_id?.message} />
          )} />

          <div className="grid grid-cols-3 gap-3">
            <Input label="Precio adulto" type="number" min="0" {...register('precio_adulto')} />
            <Input label="Precio niño" type="number" min="0" {...register('precio_nino')} />
            <Input label="Lancha aparte" type="number" min="0" {...register('precio_lancha')} />
          </div>

          {/* El total, desglosado y a la vista mientras se arma */}
          <div className="rounded-2xl bg-blue-50 px-4 py-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-blue-700 mb-0.5">
              <Calculator size={16} />
              <span className="text-sm font-bold">Lo que se cobra</span>
            </div>
            {totalAdultos > 0 && (
              <p className="flex justify-between text-sm text-tinta tabular">
                <span>{plural(Number(valores.adultos) || 0, 'adulto', 'adultos')} × {formatCurrency(valores.precio_adulto)}</span>
                <span>{formatCurrency(totalAdultos)}</span>
              </p>
            )}
            {totalNinos > 0 && (
              <p className="flex justify-between text-sm text-tinta tabular">
                <span>{plural(Number(valores.ninos) || 0, 'niño', 'niños')} × {formatCurrency(valores.precio_nino)}</span>
                <span>{formatCurrency(totalNinos)}</span>
              </p>
            )}
            {totalLancha > 0 && (
              <p className="flex justify-between text-sm text-tinta tabular">
                <span>Lancha aparte</span><span>{formatCurrency(totalLancha)}</span>
              </p>
            )}
            {(Number(valores.infantes) > 0 || Number(valores.cortesias) > 0) && (
              <p className="text-[13px] text-tinta-2">
                {[
                  Number(valores.infantes) > 0 && plural(Number(valores.infantes), 'infante', 'infantes'),
                  Number(valores.cortesias) > 0 && plural(Number(valores.cortesias), 'cortesía', 'cortesías'),
                ].filter(Boolean).join(' y ')} — no se cobran
              </p>
            )}
            <p className="flex justify-between items-baseline border-t border-blue-200 pt-2 mt-1">
              <span className="font-bold text-blue-700">Total</span>
              <span className="text-xl font-bold text-blue-700 tabular">{formatCurrency(total)}</span>
            </p>
          </div>
        </Seccion>

        {/* 3 · Cómo llegan */}
        <Seccion numero="3" titulo="¿Cómo llegan?">
          <Controller name="lancha_id" control={control} render={({ field }) => (
            <FichasLancha lanchas={lanchas} ocupacion={ocupacion} value={field.value}
              onChange={field.onChange} paxNuevos={paxNuevos} error={errors.lancha_id?.message} />
          )} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller name="canal_id" control={control} render={({ field }) => (
              <Select label="Canal de venta" value={field.value} onChange={field.onChange}
                error={errors.canal_id?.message} placeholder="— Canal —"
                options={canales.map(c => ({ value: c.id, label: c.nombre }))} />
            )} />
            <Input label="Vendida por" placeholder="Nombre de la asesora" {...register('vendida_por')} />
          </div>
        </Seccion>

        {/* 4 · Cómo pagan */}
        <Seccion numero="4" titulo="¿Cómo pagan?">
          <Controller name="forma_pago" control={control} render={({ field }) => (
            <Select label="Forma de pago" value={field.value || ''} onChange={field.onChange}
              placeholder="— Sin definir —"
              options={[{ value: '', label: '— Sin definir —' },
                ...Object.entries(FORMA_PAGO_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
          )} />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Impuestos de puerto</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { valor: 'si', etiqueta: 'Ya pagados' },
                { valor: 'no', etiqueta: 'Se cobran en el muelle' },
                { valor: 'exe', etiqueta: 'Exento' },
              ].map(o => (
                <label key={o.valor} className="cursor-pointer">
                  <input type="radio" value={o.valor} {...register('impuestos_puerto')} className="sr-only peer" />
                  <span className="flex items-center justify-center text-center rounded-xl px-3 py-2.5 min-h-[56px] text-[13px] font-bold bg-white ring-1 ring-linea text-tinta-2 peer-checked:bg-blue-600 peer-checked:ring-blue-600 peer-checked:text-white transition-colors">
                    {o.etiqueta}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Voucher u OS (opcional)" {...register('voucher_os')} />
            <Input label="Folio Zeus (opcional)" {...register('folio_zeus')} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <textarea
              rows={2} {...register('observaciones')}
              placeholder="Lo que no cabe en ningún otro campo"
              className="w-full rounded-xl border border-linea bg-white px-3 py-2.5 text-sm resize-y focus:outline-none focus:border-blue-600"
            />
          </div>
        </Seccion>

        {/* Pasajeros */}
        <Seccion numero="5" titulo="¿Quiénes son?">
          <p className="text-sm text-tinta-2 -mt-2">
            Los nombres de quienes viajan. Puedes dejarlos para cuando la agencia te los mande.
          </p>
          <SeccionPasajeros
            plan={{
              adultos: Number(valores.adultos) || 0, ninos: Number(valores.ninos) || 0,
              infantes: Number(valores.infantes) || 0, cortesias: Number(valores.cortesias) || 0,
            }}
            pasajeros={pasajeros} onChange={setPasajeros} paises={paises}
            opcionesPlato={opcionesDelPlan}
          />
        </Seccion>

        {/* Solo al editar: una reserva que todavía no existe no tiene historia,
            y un bloque vacío ahí sería una promesa sin cumplir. */}
        {isEdit && <HistoriaDeLaReserva registroId={id} />}

        <div className="flex items-center gap-3 flex-wrap sticky bottom-0 bg-fondo/95 backdrop-blur py-3 -mx-4 px-4 border-t border-linea">
          <Button type="submit" size="lg" loading={guardando}>
            {isEdit ? 'Guardar cambios' : 'Guardar la reserva'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/reservas')}>
            Cancelar
          </Button>
          {!isEdit && (
            <span className="text-[13px] text-tinta-2 ml-auto">
              Al guardar, el formulario queda listo para la siguiente.
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
