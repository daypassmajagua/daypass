import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Copy, CheckCircle2, RefreshCw, Printer, Lock, Unlock } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { EstadoError, Esqueleto } from '../components/patrones'
import { formatDate, FORMA_PAGO_LABELS, IMPUESTOS_LABELS } from '../lib/utils'
import DateNav from '../components/ui/DateNav'
import FranjaDia from '../components/layout/FranjaDia'
import { useRegistrosEnVivo } from '../hooks/useDiaOperativo'
import { openPrintWindow, buildFoliosHTML } from '../lib/printDoc'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PageHeader from '../components/layout/PageHeader'
import { supabase } from '../lib/supabase'

export default function Folios() {
  const { fechaActiva, setFechaActiva } = useAppStore()
  const { registros, loading, error, updateRegistro, refetch } = useRegistros(fechaActiva)
  useRegistrosEnVivo(fechaActiva, refetch)
  const [folios, setFolios] = useState({})
  const [saving, setSaving] = useState({})
  const [listadoImpreso, setListadoImpreso] = useState(false)

  const activos = useMemo(() =>
    registros.filter(r => !['cancelada', 'noshow'].includes(r.estado)),
    [registros]
  )

  const byLancha = useMemo(() => {
    const map = {}
    activos.forEach(r => {
      const key = r.lanchas?.nombre || 'Sin lancha'
      if (!map[key]) map[key] = []
      map[key].push(r)
    })
    return map
  }, [activos])

  async function saveFolio(id, folio) {
    setSaving(prev => ({ ...prev, [id]: true }))
    const { error } = await updateRegistro(id, { folio_zeus: folio })
    if (error) toast.error('Error al guardar folio')
    else toast.success('Folio guardado')
    setSaving(prev => ({ ...prev, [id]: false }))
  }

  function imprimirListado() {
    const html = buildFoliosHTML(registros, fechaActiva)
    const ok = openPrintWindow(`Listado Folios Zeus — ${fechaActiva}`, html)
    if (ok) {
      setListadoImpreso(true)
      toast.success('Listado abierto — se enviará a impresora automáticamente')
    }
  }

  async function marcarCompletados() {
    const conFolio = activos.filter(r => {
      const folio = folios[r.id] !== undefined ? folios[r.id] : r.folio_zeus
      return folio && folio.trim() !== ''
    })
    if (conFolio.length === 0) {
      toast.error('Ninguna reserva tiene folio todavía. Escribe al menos uno para poder completarlas.')
      return
    }
    const promises = conFolio.map(r =>
      supabase.from('registros').update({ estado: 'completada' }).eq('id', r.id)
    )
    await Promise.all(promises)
    await refetch()
    toast.success(`${conFolio.length} ${conFolio.length === 1 ? 'reserva marcada' : 'reservas marcadas'} como completadas`)
  }

  function copiarListado() {
    let text = `LISTADO PARA FOLIOS — ${formatDate(fechaActiva)}\n${'─'.repeat(50)}\n\n`
    Object.entries(byLancha).forEach(([nombre, regs]) => {
      const pax = regs.reduce((s, r) => s + r.adultos + r.ninos, 0)
      text += `${nombre.toUpperCase()} — ${pax} personas\n`
      regs.forEach((r, i) => {
        const folio = folios[r.id] !== undefined ? folios[r.id] : r.folio_zeus
        text += `  ${i + 1}. ${r.nombre_pasajero}`
        if (r.agencia_nombre) text += ` | ${r.agencia_nombre}`
        text += ` | ${r.adultos} adultos`
        if (r.ninos > 0) text += ` ${r.ninos} niños`
        text += ` | ${r.planes?.nombre || ''}`
        if (r.forma_pago) text += ` | ${FORMA_PAGO_LABELS[r.forma_pago]}`
        text += ` | Imp: ${IMPUESTOS_LABELS[r.impuestos_puerto]}`
        text += ` | Folio: ${folio || '___'}\n`
      })
      text += '\n'
    })
    navigator.clipboard.writeText(text)
    toast.success('Listado copiado al portapapeles')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <FranjaDia />
      <PageHeader
        title="Listado para Folios Zeus"
        subtitle={formatDate(fechaActiva)}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DateNav value={fechaActiva} onChange={setFechaActiva} />
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw size={14} />
            </Button>
            <Button variant="secondary" size="sm" onClick={copiarListado} disabled={activos.length === 0}>
              <Copy size={14} />
              Copiar
            </Button>
            <Button
              size="sm"
              onClick={imprimirListado}
              disabled={activos.length === 0}
              className={listadoImpreso ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <Printer size={14} />
              {listadoImpreso ? 'Reimprimir' : 'Imprimir Listado'}
            </Button>
            <div className="relative group">
              <Button
                variant="success"
                size="sm"
                onClick={marcarCompletados}
                disabled={activos.length === 0 || !listadoImpreso}
              >
                {listadoImpreso
                  ? <><CheckCircle2 size={14} /> Marcar completados</>
                  : <><Lock size={14} /> Marcar completados</>
                }
              </Button>
              {!listadoImpreso && (
                <div className="absolute right-0 top-full mt-1 z-20 hidden group-hover:block">
                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 w-52 shadow-lg">
                    Imprime el listado primero para habilitar este botón
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Banner de workflow */}
      {!loading && activos.length > 0 && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 text-sm font-medium transition-all ${
          listadoImpreso
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          {listadoImpreso
            ? <><Unlock size={16} className="text-emerald-600 flex-none" /> Listado impreso — puedes ingresar los folios y marcar como completados cuando termines en Zeus.</>
            : <><Lock size={16} className="text-amber-600 flex-none" /> Imprime el listado antes de entrar a Zeus — el botón <strong>"Marcar completados"</strong> se habilitará automáticamente.</>
          }
        </div>
      )}

      {loading ? (
        <Esqueleto filas={4} />
      ) : error ? (
        <EstadoError error={error} onReintentar={refetch} />
      ) : activos.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-tinta-2">No hay reservas activas para este día</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(byLancha).map(([nombreLancha, regs]) => {
            const pax = regs.reduce((s, r) => s + r.adultos + r.ninos, 0)
            return (
              <Card key={nombreLancha}>
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between rounded-t-xl">
                  <h2 className="font-bold text-gray-800 uppercase text-sm tracking-wide">{nombreLancha}</h2>
                  <span className="text-sm text-gray-500">{pax} personas</span>
                </div>

                <div className="divide-y divide-gray-100">
                  {regs.map((r, i) => {
                    const folioValue = folios[r.id] !== undefined ? folios[r.id] : (r.folio_zeus || '')
                    return (
                      <div key={r.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-none w-6 text-sm font-bold text-gray-400">{i + 1}</div>

                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {r.tipo === 'grupo' && (
                              <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded mr-1">GRP</span>
                            )}
                            {r.nombre_pasajero}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            {r.agencia_nombre && <span>{r.agencia_nombre}</span>}
                            <span>{r.adultos}A{r.ninos > 0 ? ` ${r.ninos}N` : ''}</span>
                            <span>{r.planes?.nombre}</span>
                            {r.forma_pago && <span>{FORMA_PAGO_LABELS[r.forma_pago]}</span>}
                            <span className={
                              r.impuestos_puerto === 'si' ? 'text-green-600' :
                              r.impuestos_puerto === 'no' ? 'text-red-600 font-semibold' :
                              'text-gray-400'
                            }>
                              Imp: {IMPUESTOS_LABELS[r.impuestos_puerto]}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:w-56">
                          <label className="text-xs text-gray-500 font-medium flex-none">Folio:</label>
                          <input
                            type="text"
                            value={folioValue}
                            onChange={e => setFolios(prev => ({ ...prev, [r.id]: e.target.value }))}
                            onBlur={e => {
                              const val = e.target.value
                              if (val !== (r.folio_zeus || '')) saveFolio(r.id, val)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = e.target.value
                                if (val !== (r.folio_zeus || '')) saveFolio(r.id, val)
                                e.target.blur()
                              }
                            }}
                            placeholder="Número Zeus..."
                            className={`flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                              folioValue ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-mono' : 'border-gray-300'
                            }`}
                          />
                          {saving[r.id] && (
                            <span className="text-xs text-gray-400">...</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
