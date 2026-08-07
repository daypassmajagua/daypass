import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Copy, RefreshCw, Printer } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { formatDate } from '../lib/utils'
import DateNav from '../components/ui/DateNav'
import { openPrintWindow, buildTentativoHTML } from '../lib/printDoc'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PageHeader from '../components/layout/PageHeader'

export default function Tentativo() {
  const { fechaActiva, setFechaActiva } = useAppStore()
  const { registros, loading, refetch } = useRegistros(fechaActiva)

  const activos = useMemo(() =>
    registros.filter(r => !['cancelada', 'noshow'].includes(r.estado)),
    [registros]
  )
  const confirmados = useMemo(() =>
    registros.filter(r => ['confirmada', 'en_isla', 'completada'].includes(r.estado)),
    [registros]
  )
  const tentativas = useMemo(() =>
    registros.filter(r => r.estado === 'tentativa'),
    [registros]
  )

  const texto = useMemo(() => {
    const fechaLarga = formatDate(fechaActiva)
    const totalAdultos = activos.reduce((s, r) => s + r.adultos, 0)
    const totalNinos = activos.reduce((s, r) => s + r.ninos, 0)
    const totalCortesias = activos.reduce((s, r) => s + r.cortesias, 0)
    const totalPax = activos.reduce((s, r) => s + r.adultos + r.ninos, 0)

    // Mix de canales
    const canalMap = {}
    activos.forEach(r => {
      if (!r.canales) return
      const key = r.canales.codigo
      if (!canalMap[key]) canalMap[key] = { nombre: r.canales.nombre, codigo: r.canales.codigo, pax: 0 }
      canalMap[key].pax += r.adultos + r.ninos
    })
    const canalesLineas = Object.values(canalMap)
      .filter(c => c.pax > 0)
      .map(c => `- ${c.nombre} (${c.codigo}): ${c.pax} pax`)
      .join('\n')

    const grupos = activos.filter(r => r.tipo === 'grupo')
    const individuales = activos.filter(r => r.tipo === 'individual')

    const gruposLineas = grupos.map(r =>
      `- ${r.nombre_pasajero}${r.nombre_grupo ? ' — ' + r.nombre_grupo : ''}` +
      `${r.agencia_nombre ? ' — ' + r.agencia_nombre : ''}` +
      ` — ${r.adultos} adultos${r.ninos > 0 ? ` + ${r.ninos} niños` : ''}` +
      ` — ${r.planes?.nombre || ''}` +
      ` — ${r.lanchas?.nombre || ''}` +
      (r.voucher_os ? `\n  Voucher: ${r.voucher_os}` : '')
    ).join('\n')

    const individualesLineas = individuales.map(r =>
      `- ${r.nombre_pasajero}` +
      ` — ${r.adultos} adultos${r.ninos > 0 ? ` + ${r.ninos} niños` : ''}` +
      ` — ${r.planes?.nombre || ''}` +
      ` — ${r.lanchas?.nombre || ''}`
    ).join('\n')

    const tentativasLineas = tentativas.map(r =>
      `- ${r.nombre_pasajero} — ${r.adultos + r.ninos} pax — ${r.planes?.nombre || ''}`
    ).join('\n')

    let result = `TENTATIVO DAYPASS — ${fechaLarga}\n`
    result += `${'─'.repeat(50)}\n\n`
    result += `Total proyectado: ${totalPax} personas\n`
    result += `→ ${totalAdultos} adultos | ${totalNinos} niños | ${totalCortesias} cortesías\n\n`

    if (canalesLineas) {
      result += `Por canal:\n${canalesLineas}\n\n`
    }

    if (grupos.length > 0) {
      result += `GRUPOS:\n${gruposLineas}\n\n`
    }

    if (individuales.length > 0) {
      result += `INDIVIDUALES:\n${individualesLineas}\n\n`
    }

    if (tentativas.length > 0) {
      const tPax = tentativas.reduce((s, r) => s + r.adultos + r.ninos, 0)
      result += `⚠️ Tentativas (no confirmadas): ${tPax} personas\n${tentativasLineas}`
    }

    return result.trim()
  }, [activos, tentativas, fechaActiva])

  function copiar() {
    navigator.clipboard.writeText(texto)
    toast.success('Tentativo copiado al portapapeles')
  }

  function imprimir() {
    const html = buildTentativoHTML(registros, fechaActiva)
    const ok = openPrintWindow(`Tentativo DayPASS — ${fechaActiva}`, html)
    if (ok) toast.success('Documento abierto — se enviará a impresora automáticamente')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader
        title="Generador de Tentativo"
        subtitle={formatDate(fechaActiva)}
        actions={
          <div className="flex items-center gap-2">
            <DateNav value={fechaActiva} onChange={setFechaActiva} />
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw size={14} />
            </Button>
            <Button variant="secondary" size="sm" onClick={copiar} disabled={loading || activos.length === 0}>
              <Copy size={14} />
              Copiar texto
            </Button>
            <Button size="sm" onClick={imprimir} disabled={loading || activos.length === 0}>
              <Printer size={14} />
              Imprimir Tentativo
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : activos.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Sin registros activos para este día</p>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500">
              <b className="text-gray-900">{activos.reduce((s,r)=>s+r.adultos+r.ninos,0)}</b> personas confirmadas
              {tentativas.length > 0 && (
                <span className="ml-2 text-orange-600">· <b>{tentativas.reduce((s,r)=>s+r.adultos+r.ninos,0)}</b> tentativas</span>
              )}
            </div>
            <Button size="sm" onClick={copiar}>
              <Copy size={14} />
              Copiar
            </Button>
          </div>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-4 leading-relaxed border border-gray-200">
            {texto}
          </pre>
        </Card>
      )}
    </div>
  )
}
