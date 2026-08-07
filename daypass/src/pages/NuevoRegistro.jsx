import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useTemporada } from '../hooks/useTemporada'
import { formatCurrency, FORMA_PAGO_LABELS } from '../lib/utils'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import { Calculator, Info } from 'lucide-react'
import useAppStore from '../store/useAppStore'

const schema = z.object({
  fecha: z.string().min(1),
  tipo: z.enum(['individual', 'grupo']),
  estado: z.string().default('confirmada'),
  nombre_pasajero: z.string().min(1, 'El nombre es obligatorio'),
  nombre_grupo: z.string().optional(),
  identificacion: z.string().optional(),
  lancha_id: z.string().min(1, 'La lancha es obligatoria'),
  pais_id: z.string().optional(),
  plan_id: z.string().min(1, 'El plan es obligatorio'),
  canal_id: z.string().min(1, 'El canal es obligatorio'),
  agencia_nombre: z.string().optional(),
  adultos: z.coerce.number().min(1, 'Mínimo 1 adulto'),
  ninos: z.coerce.number().min(0).default(0),
  infantes: z.coerce.number().min(0).default(0),
  cortesias: z.coerce.number().min(0).default(0),
  precio_adulto: z.coerce.number().min(0),
  precio_nino: z.coerce.number().min(0).default(0),
  precio_lancha: z.coerce.number().min(0).default(0),
  forma_pago: z.string().optional(),
  impuestos_puerto: z.enum(['si', 'no', 'exe']).default('si'),
  voucher_os: z.string().optional(),
  folio_zeus: z.string().optional(),
  observaciones: z.string().optional(),
  vendida_por: z.string().optional(),
}).refine(data => {
  if (data.tipo === 'grupo' && !data.nombre_grupo) return false
  return true
}, { message: 'El nombre del grupo es obligatorio', path: ['nombre_grupo'] })

export default function NuevoRegistro() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { fechaActiva } = useAppStore()
  const isEdit = Boolean(id)

  const [lanchas, setLanchas] = useState([])
  const [planes, setPlanes] = useState([])
  const [canales, setCanales] = useState([])
  const [paises, setPaises] = useState([])
  const [agencias, setAgencias] = useState([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(true)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha: fechaActiva,
      tipo: 'individual',
      estado: 'confirmada',
      adultos: 1,
      ninos: 0,
      infantes: 0,
      cortesias: 0,
      precio_adulto: 0,
      precio_nino: 0,
      precio_lancha: 0,
      impuestos_puerto: 'si',
    },
  })

  const fechaValue = watch('fecha')
  const { temporada } = useTemporada(fechaValue)

  const tipoValue = watch('tipo')
  const planIdValue = watch('plan_id')
  const adultosValue = watch('adultos') || 0
  const ninosValue = watch('ninos') || 0
  const precioAdultoValue = watch('precio_adulto') || 0
  const precioNinoValue = watch('precio_nino') || 0
  const precioLanchaValue = watch('precio_lancha') || 0
  const impuestosValue = watch('impuestos_puerto')

  const totalCalculado = (adultosValue * precioAdultoValue) + (ninosValue * precioNinoValue) + precioLanchaValue

  // Load catalogs
  useEffect(() => {
    async function load() {
      const [l, p, c, pa, a] = await Promise.all([
        supabase.from('lanchas').select('*').eq('activa', true).order('nombre'),
        supabase.from('planes').select('*').eq('activo', true).order('nombre'),
        supabase.from('canales').select('*').order('nombre'),
        supabase.from('paises').select('*').order('nombre'),
        supabase.from('agencias').select('*').eq('activa', true).order('nombre'),
      ])
      setLanchas(l.data || [])
      setPlanes(p.data || [])
      setCanales(c.data || [])
      setPaises(pa.data || [])
      setAgencias(a.data || [])
      setLoadingCatalogs(false)
    }
    load()
  }, [])

  // Load existing record for edit
  useEffect(() => {
    if (!isEdit || !id) return
    supabase.from('registros').select('*').eq('id', id).single().then(({ data }) => {
      if (data) reset(data)
    })
  }, [id, isEdit, reset])

  // Auto-fill prices when plan changes
  useEffect(() => {
    if (!planIdValue || !temporada || loadingCatalogs) return
    const plan = planes.find(p => p.id === planIdValue)
    if (!plan) return
    const pa = temporada === 'alta' ? plan.precio_adulto_alta : plan.precio_adulto_baja
    const pn = temporada === 'alta' ? plan.precio_nino_alta : plan.precio_nino_baja
    setValue('precio_adulto', pa || 0)
    setValue('precio_nino', pn || 0)
  }, [planIdValue, temporada, planes, setValue, loadingCatalogs])

  async function onSubmit(data) {
    setSaving(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id

    const payload = {
      ...data,
      temporada: temporada || 'baja',
      generada_por: userId,
      nombre_grupo: data.tipo === 'grupo' ? data.nombre_grupo : null,
    }

    let error
    if (isEdit) {
      const res = await supabase.from('registros').update(payload).eq('id', id)
      error = res.error
    } else {
      const res = await supabase.from('registros').insert(payload)
      error = res.error
    }

    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      toast.success(isEdit ? 'Registro actualizado' : 'Pasadía registrado correctamente')
      if (!isEdit) {
        reset({
          fecha: data.fecha,
          tipo: 'individual',
          estado: 'confirmada',
          adultos: 1,
          ninos: 0,
          infantes: 0,
          cortesias: 0,
          precio_adulto: 0,
          precio_nino: 0,
          precio_lancha: 0,
          impuestos_puerto: 'si',
        })
      }
    }
    setSaving(false)
  }

  if (loadingCatalogs) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-400 text-sm">
        Cargando catálogos...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <PageHeader
        title={isEdit ? 'Editar Registro' : 'Nuevo Pasadía'}
        subtitle={
          temporada ? (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              temporada === 'alta' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <Info size={12} />
              Temporada {temporada === 'alta' ? 'ALTA' : 'BAJA'}
            </span>
          ) : null
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Fecha y estado */}
        <Card className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha"
              type="date"
              {...register('fecha')}
              error={errors.fecha?.message}
            />
            <Select label="Estado" {...register('estado')}>
              <option value="confirmada">Confirmada</option>
              <option value="tentativa">Tentativa</option>
              <option value="en_isla">En Isla</option>
              <option value="completada">Completada</option>
              <option value="noshow">No Show</option>
              <option value="cancelada">Cancelada</option>
            </Select>
          </div>
        </Card>

        {/* Pasajero */}
        <Card className="p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-gray-700">Pasajero / Grupo</h3>

          {/* Tipo */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Tipo</label>
            <div className="flex gap-3">
              {['individual', 'grupo'].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={t}
                    {...register('tipo')}
                    className="text-blue-600"
                  />
                  <span className="text-sm capitalize text-gray-700">{t === 'individual' ? 'Individual' : 'Grupo'}</span>
                </label>
              ))}
            </div>
          </div>

          <Input
            label={tipoValue === 'grupo' ? 'Nombre del líder / contacto' : 'Nombre del pasajero'}
            placeholder="Nombre completo"
            {...register('nombre_pasajero')}
            error={errors.nombre_pasajero?.message}
          />

          {tipoValue === 'grupo' && (
            <Input
              label="Nombre del grupo / Voucher / OS *"
              placeholder="Ej: Grupo Bavarian, Voucher TT-2345"
              {...register('nombre_grupo')}
              error={errors.nombre_grupo?.message}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Identificación"
              placeholder="CC, Pasaporte..."
              {...register('identificacion')}
            />
            <Select label="País" {...register('pais_id')}>
              <option value="">— País —</option>
              {paises.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Select>
          </div>
        </Card>

        {/* Logística */}
        <Card className="p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-gray-700">Logística</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Lancha *" {...register('lancha_id')} error={errors.lancha_id?.message}>
              <option value="">— Lancha —</option>
              {lanchas.map(l => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </Select>
            <Select label="Canal de venta *" {...register('canal_id')} error={errors.canal_id?.message}>
              <option value="">— Canal —</option>
              {canales.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          </div>
          <div>
            <Input
              label="Agencia / Empresa"
              placeholder="Nombre de agencia (opcional)"
              {...register('agencia_nombre')}
              list="agencias-list"
            />
            <datalist id="agencias-list">
              {agencias.map(a => (
                <option key={a.id} value={a.nombre} />
              ))}
            </datalist>
          </div>
          <Input
            label="Vendida por"
            placeholder="Nombre de la asesora"
            {...register('vendida_por')}
          />
        </Card>

        {/* Plan y precios */}
        <Card className="p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-gray-700">Plan y Precios</h3>
          <Select label="Plan *" {...register('plan_id')} error={errors.plan_id?.message}>
            <option value="">— Seleccionar plan —</option>
            {planes.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>

          {/* Personas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input label="Adultos *" type="number" min="1" {...register('adultos')} error={errors.adultos?.message} />
            <Input label="Niños (3-8a)" type="number" min="0" {...register('ninos')} />
            <Input label="Infantes (<3a)" type="number" min="0" {...register('infantes')} />
            <Input label="Cortesías" type="number" min="0" {...register('cortesias')} />
          </div>

          {/* Precios editables */}
          <div className="grid grid-cols-3 gap-3">
            <Input label="Precio Adulto" type="number" min="0" step="1" {...register('precio_adulto')} />
            <Input label="Precio Niño" type="number" min="0" step="1" {...register('precio_nino')} />
            <Input label="Precio Lancha" type="number" min="0" step="1" {...register('precio_lancha')} />
          </div>

          {/* Total */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700">
              <Calculator size={18} />
              <span className="text-sm font-medium">Total calculado</span>
            </div>
            <span className="text-xl font-bold text-blue-800">{formatCurrency(totalCalculado)}</span>
          </div>
        </Card>

        {/* Pago e impuestos */}
        <Card className="p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-gray-700">Pago</h3>
          <Select label="Forma de pago" {...register('forma_pago')}>
            <option value="">— Seleccionar —</option>
            {Object.entries(FORMA_PAGO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Impuestos de Puerto *</label>
            <div className="flex gap-3">
              {[
                { value: 'si', label: 'SÍ', color: 'bg-green-100 text-green-700 border-green-300' },
                { value: 'no', label: 'NO', color: 'bg-red-100 text-red-700 border-red-300' },
                { value: 'exe', label: 'EXE', color: 'bg-gray-100 text-gray-600 border-gray-300' },
              ].map(({ value, label, color }) => (
                <label key={value} className="flex-1">
                  <input type="radio" value={value} {...register('impuestos_puerto')} className="sr-only" />
                  <div className={`flex items-center justify-center py-3 rounded-xl border-2 cursor-pointer font-bold text-sm transition-all ${
                    impuestosValue === value
                      ? color + ' border-current shadow-sm scale-[1.02]'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}>
                    {label}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* Documentos y notas */}
        <Card className="p-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-gray-700">Documentos y Notas</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Voucher / OS" placeholder="Número de OS" {...register('voucher_os')} />
            <Input label="Folio Zeus" placeholder="Folio en Zeus" {...register('folio_zeus')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Notas operativas, indicaciones especiales..."
              {...register('observaciones')}
            />
          </div>
        </Card>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3 pb-6">
          <Button
            type="submit"
            loading={saving}
            size="lg"
            className="flex-1"
          >
            {isEdit ? 'Actualizar Registro' : 'Guardar Pasadía'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => navigate('/dia')}
          >
            Ver Listado
          </Button>
        </div>
      </form>
    </div>
  )
}
