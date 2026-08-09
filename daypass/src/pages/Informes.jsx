import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateShort, aFechaLocal, ESTADO_LABELS, FORMA_PAGO_LABELS } from '../lib/utils'
import Select from '../components/ui/Select'
import DatePicker from '../components/ui/DatePicker'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { EstadoError } from '../components/patrones'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Download, FileText, TrendingUp, Users, CalendarDays,
  BarChart2, Percent, RefreshCw, SlidersHorizontal, X, ChevronDown,
} from 'lucide-react'
import { reservaCon, CON_CANAL, CON_PAIS } from '../lib/columnas'

// ─── Paleta ───────────────────────────────────────────────────────────────────
// Ancla: navy de marca #1E2045 (LogoAzul) + dorado #B5904D (LogoCafe),
// con acentos que armonizan con ambos.
const C = ['#1e2045','#b5904d','#545d97','#0d9488','#7a82b3','#c2703f','#3f477c','#8a6a33','#a6accf','#5f8575']

const ESTADO_COLORS_PIE = {
  completada: '#0d9488', confirmada: '#1e2045', en_isla: '#545d97',
  tentativa: '#9ca3af', noshow: '#c2703f', cancelada: '#b91c1c',
}

const fmtCOP = v => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}
const fmtDate = str => {
  if (!str) return ''
  const [, m, d] = str.split('-')
  return `${d}/${m}`
}

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name === 'Ingresos' ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

function getPreset(preset) {
  const today = new Date()
  const fmt = aFechaLocal
  if (preset === '7d')  { const f = new Date(today); f.setDate(f.getDate() - 6);  return { from: fmt(f), to: fmt(today) } }
  if (preset === '15d') { const f = new Date(today); f.setDate(f.getDate() - 14); return { from: fmt(f), to: fmt(today) } }
  if (preset === '30d') { const f = new Date(today); f.setDate(f.getDate() - 29); return { from: fmt(f), to: fmt(today) } }
  if (preset === 'mes') { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: fmt(f), to: fmt(today) } }
  return { from: fmt(today), to: fmt(today) }
}

const FILTROS_INIT = {
  canal: '', lancha: '', plan: '', estado: '',
  tipo: '', formaPago: '', temporada: '', asesora: '',
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Informes() {
  const [preset, setPreset] = useState('15d')
  const [fechaDesde, setFechaDesde] = useState(() => getPreset('15d').from)
  const [fechaHasta, setFechaHasta] = useState(() => getPreset('15d').to)
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtros, setFiltros] = useState(FILTROS_INIT)

  // Catálogos para los dropdowns de filtro (extraídos de los datos cargados)
  const [cats, setCats] = useState({ canales: [], lanchas: [], planes: [], asesoras: [] })
  const [pasajeros, setPasajeros] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { fetchData() }, [fechaDesde, fechaHasta])

  async function fetchData() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('reservas')
      .select(reservaCon({ nivel: 'dinero', relaciones: ['lanchas (id, nombre)', 'planes (id, nombre, categoria)', CON_CANAL, CON_PAIS] }))
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .order('fecha', { ascending: true })
    const rows = data || []
    setError(err?.message || null)
    setRegistros(rows)

    // Origen: el país de cada pasajero con nombre propio manda sobre el de la
    // reserva. Solo se cae al de la reserva cuando esa reserva no tiene nombres.
    if (rows.length) {
      const { data: pax } = await supabase
        .from('pasajeros')
        .select('registro_id, pais_id, paises (id, codigo, nombre)')
        .in('registro_id', rows.map(r => r.id))
      setPasajeros(pax || [])
    } else {
      setPasajeros([])
    }

    // Construir catálogos únicos desde los datos
    const canalesMap = {}, lanchasMap = {}, planesMap = {}, asesoras = new Set()
    rows.forEach(r => {
      if (r.canales)  canalesMap[r.canal_id]  = r.canales
      if (r.lanchas)  lanchasMap[r.lancha_id]  = r.lanchas
      if (r.planes)   planesMap[r.plan_id]    = r.planes
      if (r.vendida_por) asesoras.add(r.vendida_por)
    })
    setCats({
      canales:  Object.values(canalesMap).sort((a,b) => a.nombre.localeCompare(b.nombre)),
      lanchas:  Object.values(lanchasMap).sort((a,b) => a.nombre.localeCompare(b.nombre)),
      planes:   Object.values(planesMap).sort((a,b)  => a.nombre.localeCompare(b.nombre)),
      asesoras: [...asesoras].sort(),
    })
    setLoading(false)
  }

  function applyPreset(p) {
    setPreset(p)
    const { from, to } = getPreset(p)
    setFechaDesde(from)
    setFechaHasta(to)
  }

  function setFiltro(key, val) {
    setFiltros(f => ({ ...f, [key]: val }))
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_INIT)
  }

  const filtrosActivos = Object.values(filtros).filter(Boolean).length

  // ─── Aplicar filtros sobre los registros cargados ─────────────────────────
  const filtrados = useMemo(() => {
    return registros.filter(r => {
      if (filtros.canal     && r.canal_id  !== filtros.canal)    return false
      if (filtros.lancha    && r.lancha_id !== filtros.lancha)   return false
      if (filtros.plan      && r.plan_id   !== filtros.plan)     return false
      if (filtros.estado    && r.estado    !== filtros.estado)   return false
      if (filtros.tipo      && r.tipo      !== filtros.tipo)     return false
      if (filtros.temporada && r.temporada !== filtros.temporada) return false
      if (filtros.formaPago && r.forma_pago !== filtros.formaPago) return false
      if (filtros.asesora   && r.vendida_por !== filtros.asesora) return false
      return true
    })
  }, [registros, filtros])

  const activos = useMemo(() =>
    filtrados.filter(r => !['cancelada', 'noshow'].includes(r.estado)),
    [filtrados]
  )

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalPax      = activos.reduce((s, r) => s + r.adultos + r.ninos, 0)
    const totalIngresos = activos.reduce((s, r) => s + (r.total_calculado || 0), 0)
    const dias          = new Set(activos.map(r => r.fecha)).size || 1
    const completadas   = filtrados.filter(r => r.estado === 'completada').length
    const canceladas    = filtrados.filter(r => ['cancelada', 'noshow'].includes(r.estado)).length
    const tasaNoShow    = filtrados.length > 0 ? Math.round((canceladas / filtrados.length) * 100) : 0
    const ingPorPax     = totalPax > 0 ? Math.round(totalIngresos / totalPax) : 0
    return { totalPax, totalIngresos, dias, completadas, canceladas, tasaNoShow,
             promPaxDia: Math.round(totalPax / dias), ingPorPax }
  }, [activos, filtrados])

  // ─── Series para gráficas ──────────────────────────────────────────────────
  const porDia = useMemo(() => {
    const map = {}
    activos.forEach(r => {
      if (!map[r.fecha]) map[r.fecha] = { fecha: r.fecha, Ingresos: 0, Pasajeros: 0 }
      map[r.fecha].Ingresos  += r.total_calculado || 0
      map[r.fecha].Pasajeros += r.adultos + r.ninos
    })
    return Object.values(map).sort((a,b) => a.fecha.localeCompare(b.fecha))
      .map(d => ({ ...d, label: fmtDate(d.fecha) }))
  }, [activos])

  const porCanal = useMemo(() => {
    const map = {}
    activos.forEach(r => {
      const key = r.canales?.nombre || 'Otro'
      if (!map[key]) map[key] = { canal: key, Pasajeros: 0, Ingresos: 0 }
      map[key].Pasajeros += r.adultos + r.ninos
      map[key].Ingresos  += r.total_calculado || 0
    })
    return Object.values(map).sort((a,b) => b.Pasajeros - a.Pasajeros)
  }, [activos])

  const porPlan = useMemo(() => {
    const map = {}
    activos.forEach(r => {
      const key = r.planes?.nombre || 'N/A'
      if (!map[key]) map[key] = { plan: key, Pasajeros: 0, Ingresos: 0 }
      map[key].Pasajeros += r.adultos + r.ninos
      map[key].Ingresos  += r.total_calculado || 0
    })
    return Object.values(map).sort((a,b) => b.Ingresos - a.Ingresos).slice(0, 8)
  }, [activos])

  const porEstado = useMemo(() => {
    const map = {}
    filtrados.forEach(r => { map[r.estado] = (map[r.estado] || 0) + 1 })
    return Object.entries(map).map(([estado, value]) => ({
      name: ESTADO_LABELS[estado] || estado, estado, value,
    }))
  }, [filtrados])

  const porLancha = useMemo(() => {
    const map = {}
    activos.forEach(r => {
      const key = r.lanchas?.nombre || 'N/A'
      if (!map[key]) map[key] = { lancha: key, Pasajeros: 0 }
      map[key].Pasajeros += r.adultos + r.ninos
    })
    return Object.values(map).sort((a,b) => b.Pasajeros - a.Pasajeros)
  }, [activos])

  const porTipo = useMemo(() => {
    const grupos = activos.filter(r => r.tipo === 'grupo')
    const indiv  = activos.filter(r => r.tipo === 'individual')
    return [
      { name: 'Grupos',       value: grupos.reduce((s,r) => s+r.adultos+r.ninos, 0) },
      { name: 'Individuales', value: indiv.reduce((s,r)  => s+r.adultos+r.ninos, 0) },
    ].filter(d => d.value > 0)
  }, [activos])

  const porFormaPago = useMemo(() => {
    const map = {}
    activos.forEach(r => {
      const key = FORMA_PAGO_LABELS[r.forma_pago] || 'Sin definir'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
  }, [activos])

  /**
   * De dónde viene la gente. Prioridad: el país del pasajero nominal; si la
   * reserva no tiene nombres cargados, se usa el país de la reserva y sus pax.
   */
  const porOrigen = useMemo(() => {
    const activosIds = new Set(activos.map(r => r.id))
    const conNombres = new Set()
    const map = {}

    pasajeros.forEach(p => {
      if (!activosIds.has(p.registro_id)) return
      conNombres.add(p.registro_id)
      const nombre = p.paises?.nombre || 'Sin especificar'
      map[nombre] = (map[nombre] || 0) + 1
    })

    activos.forEach(r => {
      if (conNombres.has(r.id)) return
      const nombre = r.paises?.nombre || 'Sin especificar'
      map[nombre] = (map[nombre] || 0) + r.adultos + r.ninos
    })

    return Object.entries(map)
      .map(([pais, Pasajeros]) => ({ pais, Pasajeros }))
      .sort((a, b) => b.Pasajeros - a.Pasajeros)
      .slice(0, 8)
  }, [activos, pasajeros])

  const cobertura = useMemo(() => {
    const activosIds = new Set(activos.map(r => r.id))
    const conNombres = new Set(
      pasajeros.filter(p => activosIds.has(p.registro_id)).map(p => p.registro_id)
    )
    return { conNombres: conNombres.size, total: activos.length }
  }, [activos, pasajeros])

  const tablaDia = useMemo(() =>
    porDia.map(d => ({
      ...d,
      registros: filtrados.filter(r => r.fecha === d.fecha && !['cancelada','noshow'].includes(r.estado)).length,
    })).reverse()
  , [porDia, filtrados])

  // ─── Exportar CSV ──────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ['Fecha','Nombre','Tipo','Estado','Lancha','Plan','Canal','Adultos','Niños','Total COP','Pago','Impuestos','Folio','Temporada','Asesora']
    const rows = filtrados.map(r => [
      r.fecha, r.nombre_pasajero, r.tipo, r.estado,
      r.lanchas?.nombre || '', r.planes?.nombre || '', r.canales?.codigo || '',
      r.adultos, r.ninos, r.total_calculado || 0,
      r.forma_pago || '', r.impuestos_puerto || '', r.folio_zeus || '',
      r.temporada || '', r.vendida_por || '',
    ])
    const csv = [headers, ...rows].map(row =>
      row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')
    ).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `daypass_informe_${fechaDesde}_${fechaHasta}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const PRESETS = [
    { key: '7d', label: '7 días' }, { key: '15d', label: '15 días' },
    { key: '30d', label: '30 días' }, { key: 'mes', label: 'Este mes' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        title="Informes"
        subtitle={
          filtrosActivos > 0
            ? `${formatDateShort(fechaDesde)} → ${formatDateShort(fechaHasta)} · ${filtrosActivos} filtro(s) activo(s)`
            : `${formatDateShort(fechaDesde)} → ${formatDateShort(fechaHasta)}`
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw size={14} />
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCSV} disabled={filtrados.length === 0}>
              <Download size={14} />
              CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={filtrados.length === 0}>
              <FileText size={14} />
              PDF
            </Button>
          </div>
        }
      />

      {/* ── Panel de fecha + filtros ── */}
      <Card className="mb-6 print:hidden overflow-hidden">
        {/* Fila de fechas */}
        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-gray-100">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-none">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  preset === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
            <span>Desde</span>
            <DatePicker
              value={fechaDesde}
              onChange={v => { setPreset('custom'); setFechaDesde(v) }}
              className="w-44"
            />
            <span>Hasta</span>
            <DatePicker
              value={fechaHasta}
              onChange={v => { setPreset('custom'); setFechaHasta(v) }}
              className="w-44"
            />
          </div>
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filtrosActivos > 0
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filtros
            {filtrosActivos > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {filtrosActivos}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform ${showFiltros ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Panel de filtros expandible */}
        {showFiltros && (
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FilterSelect
                label="Canal"
                value={filtros.canal}
                onChange={v => setFiltro('canal', v)}
                options={cats.canales.map(c => ({ value: c.id, label: c.nombre }))}
              />
              <FilterSelect
                label="Lancha"
                value={filtros.lancha}
                onChange={v => setFiltro('lancha', v)}
                options={cats.lanchas.map(l => ({ value: l.id, label: l.nombre }))}
              />
              <FilterSelect
                label="Plan"
                value={filtros.plan}
                onChange={v => setFiltro('plan', v)}
                options={cats.planes.map(p => ({ value: p.id, label: p.nombre }))}
              />
              <FilterSelect
                label="Estado"
                value={filtros.estado}
                onChange={v => setFiltro('estado', v)}
                options={Object.entries(ESTADO_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
              <FilterSelect
                label="Tipo"
                value={filtros.tipo}
                onChange={v => setFiltro('tipo', v)}
                options={[{ value: 'individual', label: 'Individual' }, { value: 'grupo', label: 'Grupo' }]}
              />
              <FilterSelect
                label="Temporada"
                value={filtros.temporada}
                onChange={v => setFiltro('temporada', v)}
                options={[{ value: 'baja', label: 'Baja' }, { value: 'alta', label: 'Alta' }]}
              />
              <FilterSelect
                label="Forma de pago"
                value={filtros.formaPago}
                onChange={v => setFiltro('formaPago', v)}
                options={Object.entries(FORMA_PAGO_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
              <FilterSelect
                label="Asesora"
                value={filtros.asesora}
                onChange={v => setFiltro('asesora', v)}
                options={cats.asesoras.map(a => ({ value: a, label: a }))}
              />
            </div>

            {filtrosActivos > 0 && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
                <div className="flex flex-wrap gap-2 flex-1">
                  {Object.entries(filtros).map(([key, val]) => {
                    if (!val) return null
                    const labels = {
                      canal: cats.canales.find(c => c.id === val)?.nombre,
                      lancha: cats.lanchas.find(l => l.id === val)?.nombre,
                      plan: cats.planes.find(p => p.id === val)?.nombre,
                      estado: ESTADO_LABELS[val],
                      tipo: val === 'grupo' ? 'Grupo' : 'Individual',
                      temporada: val === 'baja' ? 'Baja' : 'Alta',
                      formaPago: FORMA_PAGO_LABELS[val],
                      asesora: val,
                    }
                    return (
                      <span key={key} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        {labels[key] || val}
                        <button onClick={() => setFiltro(key, '')} className="hover:text-blue-900 ml-0.5">
                          <X size={11} />
                        </button>
                      </span>
                    )
                  })}
                </div>
                <button
                  onClick={limpiarFiltros}
                  className="text-xs text-gray-500 hover:text-red-600 font-medium transition-colors flex-none"
                >
                  Limpiar todo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Contador de resultados */}
        <div className="px-4 py-2.5 flex items-center gap-3 text-xs text-gray-500">
          <span>
            <b className="text-tinta">{filtrados.length}</b> reservas ·
            <b className="text-gray-800 ml-1">{kpis.totalPax}</b> pasajeros
            {filtrosActivos > 0 && (
              <span className="text-blue-600 ml-1">
                (de {registros.length} totales en el período)
              </span>
            )}
          </span>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">Cargando...</div>
      ) : error ? (
        <EstadoError error={error} onReintentar={fetchData} />
      ) : filtrados.length === 0 ? (
        <Card className="p-16 text-center">
          <BarChart2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-tinta-2 font-bold">Ninguna reserva coincide con estos filtros</p>
          {filtrosActivos > 0 && (
            <button onClick={limpiarFiltros} className="text-sm text-blue-600 hover:underline mt-2">
              Limpiar filtros
            </button>
          )}
        </Card>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard icon={<Users size={20} className="text-blue-600" />} bg="bg-blue-50"
              label="Total Pasajeros" value={kpis.totalPax.toLocaleString('es-CO')}
              sub={`${kpis.promPaxDia} pax/día · ${kpis.dias} días`} />
            <KpiCard icon={<TrendingUp size={20} className="text-emerald-600" />} bg="bg-emerald-50"
              label="Ingresos Proyectados" value={formatCurrency(kpis.totalIngresos)}
              sub={`${formatCurrency(kpis.ingPorPax)} / pax`} />
            <KpiCard icon={<CalendarDays size={20} className="text-purple-600" />} bg="bg-purple-50"
              label="Completados" value={kpis.completadas.toLocaleString('es-CO')}
              sub={`de ${filtrados.length} reservas`} />
            <KpiCard icon={<Percent size={20} className="text-orange-500" />} bg="bg-orange-50"
              label="No-show / Cancelados" value={`${kpis.tasaNoShow}%`}
              sub={`${kpis.canceladas} reservas`} />
          </div>

          {/* ── Ingresos por día ── */}
          <Card className="p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Ingresos por día (COP)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porDia} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis tickFormatter={fmtCOP} tick={{ fontSize: 11, fill: '#6b7280' }} width={60} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="Ingresos" fill="#1e2045" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* ── Pasajeros por día + Estados ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Pasajeros por día</h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={porDia} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="paxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1e2045" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1e2045" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} width={35} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Area type="monotone" dataKey="Pasajeros" stroke="#1e2045" strokeWidth={2} fill="url(#paxGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Distribución por estado</h2>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={210}>
                  <PieChart>
                    <Pie data={porEstado} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={52} outerRadius={84} paddingAngle={2}>
                      {porEstado.map((e, i) => (
                        <Cell key={i} fill={ESTADO_COLORS_PIE[e.estado] || C[i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v + ' reservas', n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 text-sm flex-1">
                  {porEstado.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-none"
                          style={{ background: ESTADO_COLORS_PIE[e.estado] || C[i] }} />
                        <span className="text-gray-600">{e.name}</span>
                      </div>
                      <span className="font-semibold text-gray-800">{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* ── Canales + Planes ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Mix de canales (pasajeros)</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porCanal} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="canal" width={120} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Bar dataKey="Pasajeros" radius={[0, 4, 4, 0]}>
                    {porCanal.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Top planes por ingresos</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porPlan} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtCOP} tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="plan" width={160} tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Bar dataKey="Ingresos" radius={[0, 4, 4, 0]}>
                    {porPlan.map((_, i) => <Cell key={i} fill={C[(i + 4) % C.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── De dónde viene la gente ── */}
          {porOrigen.length > 0 && (
            <Card className="p-5 mb-6">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
                <h2 className="text-sm font-semibold text-gray-700">De dónde viene la gente</h2>
                <span className="text-xs text-tinta-2">
                  {cobertura.conNombres > 0
                    ? `${cobertura.conNombres} de ${cobertura.total} reservas con nombres cargados — esas cuentan persona por persona`
                    : 'Contado por reserva: todavía no hay nombres cargados en este rango'}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(180, porOrigen.length * 34)}>
                <BarChart data={porOrigen} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="pais" width={130} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Bar dataKey="Pasajeros" radius={[0, 4, 4, 0]}>
                    {porOrigen.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ── Lanchas + Tipo + Forma de pago ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="p-5 lg:col-span-1">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Pasajeros por lancha</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porLancha} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="lancha" tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={30} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Bar dataKey="Pasajeros" radius={[4, 4, 0, 0]}>
                    {porLancha.map((_, i) => <Cell key={i} fill={C[(i + 2) % C.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Grupos vs Individuales</h2>
              <div className="flex items-center justify-center gap-6 h-[200px]">
                <ResponsiveContainer width="55%" height="100%">
                  <PieChart>
                    <Pie data={porTipo} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>
                      {porTipo.map((_, i) => <Cell key={i} fill={['#b5904d','#1e2045'][i]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v + ' pax', n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3 text-sm">
                  {porTipo.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-none"
                        style={{ background: ['#b5904d','#1e2045'][i] }} />
                      <div>
                        <div className="font-semibold text-gray-800">{d.value} pax</div>
                        <div className="text-xs text-gray-500">{d.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Forma de pago</h2>
              <div className="flex flex-col gap-2 mt-2">
                {porFormaPago.map((d, i) => {
                  const max = porFormaPago[0]?.value || 1
                  const pct = Math.round((d.value / max) * 100)
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{d.name}</span>
                        <span className="font-semibold text-gray-800">{d.value}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: C[i % C.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* ── Tabla resumen por día ── */}
          <Card className="mb-6">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Resumen por día</h2>
              <span className="text-xs text-gray-400">{tablaDia.length} días</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reservas</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pasajeros</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ing. / pax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tablaDia.map(d => (
                    <tr key={d.fecha} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-600">{formatDateShort(d.fecha)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{d.registros}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-gray-900">{d.Pasajeros}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-gray-900">{formatCurrency(d.Ingresos)}</td>
                      <td className="px-5 py-2.5 text-right text-gray-500 text-xs">
                        {d.Pasajeros > 0 ? formatCurrency(Math.round(d.Ingresos / d.Pasajeros)) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-semibold">
                    <td className="px-5 py-3 text-blue-700 text-xs uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-center text-blue-900">{filtrados.length}</td>
                    <td className="px-4 py-3 text-center text-blue-900">{kpis.totalPax}</td>
                    <td className="px-5 py-3 text-right text-blue-900">{formatCurrency(kpis.totalIngresos)}</td>
                    <td className="px-5 py-3 text-right text-blue-700 text-xs">
                      {kpis.totalPax > 0 ? formatCurrency(kpis.ingPorPax) : '—'} / pax
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function KpiCard({ icon, bg, label, value, sub }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 truncate">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-none ml-2`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <Select
        value={value}
        onChange={onChange}
        options={[{ value: '', label: 'Todos' }, ...options]}
      />
    </div>
  )
}
