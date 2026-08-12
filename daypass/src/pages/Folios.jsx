import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Copy, CheckCircle2, ClipboardList, Printer, Lock, Unlock } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { EstadoError, Esqueleto, EstadoVacio } from '../components/patrones'
import { classNames, formatDate, plural, FORMA_PAGO_LABELS, IMPUESTOS_LABELS } from '../lib/utils'
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
    <div className="marco py-6">
      <FranjaDia />
      {/**
        * El título es «Folios» y no «Listado para Folios Zeus».
        *
        * Es el trunk test de Krug: quien cae en una página tiene que reconocer
        * en el título el enlace que tocó. El menú dice «Folios» y la página
        * decía otra cosa —más larga, con el nombre de otro sistema adentro—,
        * así que por un segundo no era evidente si había llegado a donde iba.
        * Que este listado alimente a Zeus se dice en el subtítulo, que es donde
        * va el contexto.
        */}
      <PageHeader
        title="Folios"
        subtitle={`${formatDate(fechaActiva)} · para cargarlos en Zeus`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DateNav value={fechaActiva} onChange={setFechaActiva} />
            <Button variant="secondary" size="sm" onClick={copiarListado} disabled={activos.length === 0}>
              <Copy size={14} />
              Copiar
            </Button>
            {/* La acción principal se mueve con el trabajo: antes de imprimir
                la de esta pantalla es imprimir; después de imprimir es marcar.
                Antes las dos eran primarias a la vez —y una con un verde
                esmeralda inyectado a mano que no existe en el sistema—, así que
                a las siete de la mañana había que leer para saber cuál seguía. */}
            <Button
              variant={listadoImpreso ? 'secondary' : 'primary'}
              size="sm"
              onClick={imprimirListado}
              disabled={activos.length === 0}
            >
              <Printer size={14} />
              {listadoImpreso ? 'Reimprimir' : 'Imprimir listado'}
            </Button>
            {/* Por qué está bloqueado se dice **debajo del botón y siempre**,
                no en un globo al pasar el mouse: esta pantalla se usa en iPad y
                ahí no hay hover — el globo no existía para quien más lo
                necesitaba. Era además el único tooltip flotante de la app. */}
            <div className="flex flex-col items-end gap-1">
              <Button
                size="sm"
                onClick={marcarCompletados}
                disabled={activos.length === 0 || !listadoImpreso}
              >
                {listadoImpreso ? <CheckCircle2 size={14} /> : <Lock size={14} />}
                Marcar completados
              </Button>
              {!listadoImpreso && activos.length > 0 && (
                <span className="text-[13px] text-tinta-2">Primero imprime el listado</span>
              )}
            </div>
          </div>
        }
      />

      {/* En qué va el trabajo. Estaba en esmeralda y ámbar de fábrica —nueve
          clases fuera del sistema— cuando el sistema ya tiene los dos colores
          con ese significado exacto: verde es «hecho y guardado», aviso es
          «algo que revisar». */}
      {!loading && activos.length > 0 && (
        <div className={classNames(
          'flex items-center gap-3 px-4 py-3 rounded-xl mb-4 text-sm font-bold',
          listadoImpreso ? 'bg-verde-50 text-verde-700' : 'bg-aviso-50 text-aviso-700'
        )}>
          {listadoImpreso
            ? <><Unlock size={16} className="flex-none" /> Listado impreso. Escribe los folios y marca completados cuando termines en Zeus.</>
            : <><Lock size={16} className="flex-none" /> Imprime el listado antes de entrar a Zeus.</>
          }
        </div>
      )}

      {loading ? (
        <Esqueleto filas={4} />
      ) : error ? (
        <EstadoError error={error} onReintentar={refetch} />
      ) : activos.length === 0 ? (
        <Card>
          <EstadoVacio
            icono={ClipboardList}
            titulo="No hay reservas activas este día"
            detalle="Cuando las haya, aquí se escriben sus folios de Zeus."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(byLancha).map(([nombreLancha, regs]) => {
            const pax = regs.reduce((s, r) => s + r.adultos + r.ninos, 0)
            return (
              <Card key={nombreLancha}>
                <div className="px-5 py-3 bg-fondo border-b border-linea flex items-center justify-between rounded-t-xl">
                  <h2 className="font-bold text-tinta uppercase text-sm tracking-wide">{nombreLancha}</h2>
                  <span className="text-sm text-tinta-2 tabular">{plural(pax, 'persona', 'personas')}</span>
                </div>

                <div className="divide-y divide-linea">
                  {regs.map((r, i) => {
                    const folioValue = folios[r.id] !== undefined ? folios[r.id] : (r.folio_zeus || '')
                    return (
                      <div key={r.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-none w-6 text-sm font-bold text-tinta-3 tabular">{i + 1}</div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-tinta text-sm truncate">
                            {r.tipo === 'grupo' && (
                              <span className="text-xs bg-arena-100 text-arena-700 px-1.5 py-0.5 rounded mr-1">Grupo</span>
                            )}
                            {r.nombre_pasajero}
                          </div>
                          {/* Decía «2A 2N», que hay que saberse. Es la columna que
                              se lee contra reloj mientras se digita en Zeus: dos
                              abreviaturas ahí cuestan más de lo que ahorran. */}
                          <div className="text-xs text-tinta-2 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            {r.agencia_nombre && <span>{r.agencia_nombre}</span>}
                            <span className="tabular">
                              {plural(r.adultos, 'adulto', 'adultos')}
                              {r.ninos > 0 && ` · ${plural(r.ninos, 'niño', 'niños')}`}
                            </span>
                            <span>{r.planes?.nombre}</span>
                            {r.forma_pago && <span>{FORMA_PAGO_LABELS[r.forma_pago]}</span>}
                            {/* Solo «Exento» se distingue, y en gris: es la
                                excepción. Que alguien pague o no el impuesto es
                                lo acordado, no un error — pintarlo de rojo le
                                robaba peso al coral que sí pide algo. */}
                            <span className={r.impuestos_puerto === 'exe' ? 'text-tinta-3' : ''}>
                              Impuesto: {IMPUESTOS_LABELS[r.impuestos_puerto]}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:w-56">
                          <label className="text-xs text-tinta-2 font-bold flex-none">Folio:</label>
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
                            placeholder="Número de Zeus"
                            aria-label={`Folio de ${r.nombre_pasajero}`}
                            className={classNames(
                              'flex-1 text-sm rounded-xl border px-3 min-h-[44px] transition-colors',
                              'focus:outline-none focus:ring-2 focus:ring-blue-400',
                              folioValue
                                ? 'border-verde-500 bg-verde-50 text-verde-700 font-mono'
                                : 'border-linea'
                            )}
                          />
                          {saving[r.id] && (
                            <span className="text-xs text-tinta-3">guardando…</span>
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
