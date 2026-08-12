import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateShort, hoyLocal, ESTADO_LABELS, FORMA_PAGO_LABELS } from '../lib/utils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PageHeader from '../components/layout/PageHeader'
import { EstadoError, Esqueleto, InsigniaEstado, EstadoVacio, TablaDatos, Fila } from '../components/patrones'
import Select from '../components/ui/Select'
import DatePicker from '../components/ui/DatePicker'
import BotonIcono from '../components/ui/BotonIcono'
import { Search, SearchX, Download, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import { reservaCon } from '../lib/columnas'
import { usePerfil } from '../hooks/usePerfil'
import { puedeVer } from '../lib/navegacion'

const PAGE_SIZE = 50

export default function Historial() {
  const navigate = useNavigate()
  const [registros, setRegistros] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    estado: '',
    vendidaPor: '',
    search: '',
  })

  const [lanchas, setLanchas] = useState([])
  const [canales, setCanales] = useState([])
  const [filtroLancha, setFiltroLancha] = useState('')
  const [filtroCanal, setFiltroCanal] = useState('')
  const [error, setError] = useState(null)

  const { rol } = usePerfil()
  const puedeEditar = puedeVer(rol, '/editar')

  useEffect(() => {
    supabase.from('lanchas').select('*').order('nombre').then(({ data }) => setLanchas(data || []))
    supabase.from('canales').select('*').order('nombre').then(({ data }) => setCanales(data || []))
  }, [])

  useEffect(() => {
    fetchRegistros()
  }, [page, filtros, filtroLancha, filtroCanal])

  async function fetchRegistros() {
    setLoading(true)
    let query = supabase
      .from('reservas')
      .select(reservaCon({ nivel: 'dinero', relaciones: ['lanchas (nombre)', 'planes (nombre)', 'canales (codigo, nombre)'] }), { count: 'exact' })
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filtros.fechaInicio) query = query.gte('fecha', filtros.fechaInicio)
    if (filtros.fechaFin) query = query.lte('fecha', filtros.fechaFin)
    if (filtros.estado) query = query.eq('estado', filtros.estado)
    if (filtros.vendidaPor) query = query.ilike('vendida_por', `%${filtros.vendidaPor}%`)
    if (filtros.search) query = query.ilike('nombre_pasajero', `%${filtros.search}%`)
    if (filtroLancha) query = query.eq('lancha_id', filtroLancha)
    if (filtroCanal) query = query.eq('canal_id', filtroCanal)

    const { data, count, error: err } = await query
    if (err) {
      setError(err.message)
    } else {
      setError(null)
      setRegistros(data || [])
      setTotal(count || 0)
    }
    setLoading(false)
  }

  function exportCSV() {
    const headers = ['Fecha','Nombre','Tipo','Estado','Lancha','Plan','Canal','Adultos','Niños','Total','Pago','Folio','Asesora']
    const rows = registros.map(r => [
      r.fecha, r.nombre_pasajero, r.tipo, r.estado,
      r.lanchas?.nombre, r.planes?.nombre, r.canales?.codigo,
      r.adultos, r.ninos, r.total_calculado,
      r.forma_pago || '', r.folio_zeus || '', r.vendida_por || ''
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daypass_historial_${hoyLocal()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="marco py-6">
      <PageHeader
        title="Historial de reservas"
        subtitle={`${total} reservas en total`}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCSV} disabled={registros.length === 0}>
            <Download size={14} />
            Exportar CSV
          </Button>
        }
      />

      {/* Filtros */}
      <Card className="p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-3" />
            <input
              type="text"
              placeholder="Buscar pasajero"
              aria-label="Buscar pasajero"
              value={filtros.search}
              onChange={e => { setFiltros(f => ({ ...f, search: e.target.value })); setPage(0) }}
              className="w-full pl-8 pr-3 min-h-[44px] text-sm border border-linea rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <DatePicker
            value={filtros.fechaInicio}
            onChange={v => { setFiltros(f => ({ ...f, fechaInicio: v })); setPage(0) }}
            placeholder="Fecha desde"
          />
          <DatePicker
            value={filtros.fechaFin}
            onChange={v => { setFiltros(f => ({ ...f, fechaFin: v })); setPage(0) }}
            placeholder="Fecha hasta"
          />
          <Select
            value={filtros.estado}
            onChange={v => { setFiltros(f => ({ ...f, estado: v })); setPage(0) }}
            options={[
              { value: '', label: 'Todos los estados' },
              ...Object.entries(ESTADO_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <Select
            value={filtroLancha}
            onChange={v => { setFiltroLancha(v); setPage(0) }}
            options={[
              { value: '', label: 'Todas las lanchas' },
              ...lanchas.map(l => ({ value: l.id, label: l.nombre })),
            ]}
          />
          <Select
            value={filtroCanal}
            onChange={v => { setFiltroCanal(v); setPage(0) }}
            options={[
              { value: '', label: 'Todos los canales' },
              ...canales.map(c => ({ value: c.id, label: c.nombre })),
            ]}
          />
        </div>
        <button
          onClick={() => { setFiltros({ fechaInicio:'', fechaFin:'', estado:'', vendidaPor:'', search:'' }); setFiltroLancha(''); setFiltroCanal(''); setPage(0) }}
          className="text-[13px] font-bold text-blue-700 hover:underline mt-2 min-h-[44px] px-2 -ml-2"
        >
          Limpiar filtros
        </button>
      </Card>

      {loading ? (
        <Esqueleto filas={6} />
      ) : error ? (
        <EstadoError error={error} onReintentar={fetchRegistros} />
      ) : registros.length === 0 ? (
        <Card>
          <EstadoVacio
            icono={SearchX}
            buscando
            titulo="Ninguna reserva coincide con estos filtros"
            detalle="Prueba con un rango de fechas más amplio."
          />
        </Card>
      ) : (
        <>
          <Card>
            <TablaDatos
              columnas={[
                { id: 'fecha', etiqueta: 'Fecha' },
                { id: 'pasajero', etiqueta: 'Pasajero' },
                { id: 'lancha', etiqueta: 'Lancha' },
                { id: 'plan', etiqueta: 'Plan' },
                { id: 'canal', etiqueta: 'Canal' },
                { id: 'pax', etiqueta: 'Pax', alinear: 'centro' },
                { id: 'total', etiqueta: 'Total', alinear: 'derecha' },
                { id: 'estado', etiqueta: 'Estado' },
                { id: 'folio', etiqueta: 'Folio' },
                { id: 'acciones', oculta: 'Editar' },
              ]}
            >
              {registros.map(r => (
                <Fila key={r.id}>
                  <td className="px-3 py-3 text-tinta-2 text-xs font-mono">{formatDateShort(r.fecha)}</td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-tinta">{r.nombre_pasajero}</div>
                    {r.agencia_nombre && <div className="text-xs text-tinta-2">{r.agencia_nombre}</div>}
                  </td>
                  <td className="px-3 py-3 text-xs text-tinta-2">{r.lanchas?.nombre || '—'}</td>
                  <td className="px-3 py-3 text-xs text-tinta-2">{r.planes?.nombre || '—'}</td>
                  <td className="px-3 py-3 text-xs text-tinta-2">{r.canales?.codigo || '—'}</td>
                  <td className="px-3 py-3 text-center tabular">
                    <span className="font-bold text-tinta">{r.adultos}</span>
                    {r.ninos > 0 && <span className="text-tinta-2 text-xs ml-1">+{r.ninos}n</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-tinta tabular">
                    {formatCurrency(r.total_calculado)}
                  </td>
                  <td className="px-3 py-3"><InsigniaEstado estado={r.estado} /></td>
                  <td className="px-3 py-3 text-xs font-mono text-verde-700">{r.folio_zeus || '—'}</td>
                  <td className="px-3 py-3">
                    {/* Gerencia consulta el historial pero no edita reservas:
                        el lápiz rebotaría en la guardia de rutas. */}
                    {puedeEditar && (
                      <BotonIcono
                        onClick={() => navigate(`/editar/${r.id}`)}
                        etiqueta={`Editar la reserva de ${r.nombre_pasajero}`}
                        titulo="Editar"
                      >
                        <Edit2 size={14} />
                      </BotonIcono>
                    )}
                  </td>
                </Fila>
              ))}
            </TablaDatos>
          </Card>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-tinta-2 tabular">
                Página {page + 1} de {totalPages} ({total} reservas)
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                  <ChevronLeft size={14} />
                  Anterior
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                  Siguiente
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
