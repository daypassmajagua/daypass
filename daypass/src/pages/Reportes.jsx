import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LifeBuoy, TriangleAlert, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { classNames, formatDateShort } from '../lib/utils'
import { TIPOS_TICKET, ETIQUETA_ESTADO_TICKET } from '../lib/tickets'
import { EstadoError, Esqueleto } from '../components/patrones'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Select from '../components/ui/Select'

/**
 * En qué va lo que reportaste.
 *
 * Existe por una razón sencilla: quien reporta dos veces y no sabe qué pasó
 * con la primera, deja de reportar. Ver el estado es lo que mantiene vivo el
 * canal durante los meses de prueba.
 *
 * Quien mantiene el sistema ve todos y los mueve; la dirección los ve para
 * saber cómo va la prueba; cada quien ve los suyos. Eso lo decide la RLS de la
 * migración 021, no esta pantalla: aquí solo se pide la lista y el servidor
 * responde con lo que a cada quien le toca.
 */

const ESTADOS = ['nuevo', 'visto', 'en_curso', 'resuelto', 'no_va']

const TONO_ESTADO = {
  nuevo:    'bg-blue-50 text-blue-700',
  visto:    'bg-fondo text-tinta-2',
  en_curso: 'bg-aviso-50 text-aviso-700',
  resuelto: 'bg-verde-50 text-verde-600',
  no_va:    'bg-fondo text-tinta-2',
}

const ETIQUETA_TIPO = Object.fromEntries(
  TIPOS_TICKET.map(t => [t.valor, t.etiqueta])
)

export default function Reportes() {
  const { rol } = usePerfil()
  const puedeAtender = rol === 'super_admin'

  const [tickets, setTickets] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [soloPendientes, setSoloPendientes] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error: err } = await supabase
      .from('tickets')
      .select('*')
      .order('bloqueo', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    if (err) setError(err.message)
    else { setError(null); setTickets(data || []) }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function mover(id, estado) {
    const { error: err } = await supabase.rpc('atender_ticket', {
      p_ticket_id: id, p_estado: estado,
    })
    if (err) toast.error('No se pudo cambiar. ' + err.message)
    else { toast.success(`Ahora está "${ETIQUETA_ESTADO_TICKET[estado]}"`); await cargar() }
  }

  const visibles = soloPendientes
    ? tickets.filter(t => !['resuelto', 'no_va'].includes(t.estado))
    : tickets

  return (
    <div className="max-w-4xl mx-auto px-4">
      <PageHeader
        title="Reportes"
        subtitle={puedeAtender ? 'Lo que reporta el equipo' : 'Lo que has reportado'}
        actions={
          <button
            onClick={() => setSoloPendientes(!soloPendientes)}
            className="text-[14px] font-bold text-tinta-2 px-3 min-h-[40px] rounded-xl hover:bg-fondo"
          >
            {soloPendientes ? 'Con cerrados' : 'Solo abiertos'}
          </button>
        }
      />

      {cargando ? (
        <Esqueleto filas={3} />
      ) : error ? (
        <EstadoError error={error} onReintentar={cargar} />
      ) : !visibles.length ? (
        <Card className="p-12 text-center">
          <LifeBuoy size={32} className="mx-auto text-tinta-2/50 mb-3" aria-hidden="true" />
          <p className="text-tinta-2 text-[17px]">
            {soloPendientes ? 'No hay reportes abiertos.' : 'Todavía no hay reportes.'}
          </p>
          <p className="text-tinta-2 text-[15px] mt-1">
            El botón para reportar está abajo a la derecha, en toda pantalla.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {visibles.map(t => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start gap-3">
                {t.bloqueo && (
                  <TriangleAlert size={18} className="text-coral-600 shrink-0 mt-0.5"
                    aria-label="Bloqueó la operación" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-tinta">{t.titulo}</p>
                  <p className="text-[13px] text-tinta-2 mt-0.5">
                    {ETIQUETA_TIPO[t.tipo] || t.tipo}
                    {' · '}{t.reportado_por_nombre || 'alguien'}
                    {' · '}{formatDateShort(t.created_at)}
                    {t.contexto?.ruta && <> · {t.contexto.ruta}</>}
                  </p>
                </div>

                <span className={classNames(
                  'shrink-0 px-3 py-1.5 rounded-[10px] text-[13px] font-bold',
                  TONO_ESTADO[t.estado] || 'bg-fondo text-tinta-2'
                )}>
                  {ETIQUETA_ESTADO_TICKET[t.estado] || t.estado}
                </span>

                <button
                  onClick={() => setAbierto(abierto === t.id ? null : t.id)}
                  className="shrink-0 p-1.5 rounded-lg text-tinta-2 hover:bg-fondo"
                  aria-label={abierto === t.id ? 'Cerrar el detalle' : 'Ver el detalle'}
                >
                  <ChevronDown size={18}
                    className={classNames('transition-transform', abierto === t.id && 'rotate-180')} />
                </button>
              </div>

              {abierto === t.id && (
                <div className="mt-3 pt-3 border-t border-linea flex flex-col gap-3">
                  {t.detalle && <p className="text-[15px] text-tinta whitespace-pre-wrap">{t.detalle}</p>}

                  {t.respuesta && (
                    <div className="rounded-xl bg-verde-50 px-3 py-2.5">
                      <p className="text-[13px] font-bold text-verde-600 mb-0.5">Respuesta</p>
                      <p className="text-[15px] text-tinta whitespace-pre-wrap">{t.respuesta}</p>
                    </div>
                  )}

                  {t.captura && (
                    <img src={t.captura} alt="La pantalla cuando se reportó"
                      className="w-full rounded-xl ring-1 ring-linea" />
                  )}

                  {/* El contexto, plegado y crudo: no es para leerlo de corrido,
                      es para que quien arregla no tenga que preguntar. */}
                  {t.contexto && (
                    <details className="text-[13px]">
                      <summary className="text-tinta-2 cursor-pointer select-none">
                        Lo que capturó el sistema
                      </summary>
                      <pre className="mt-1.5 bg-fondo rounded-lg px-3 py-2 overflow-x-auto text-[12px] text-tinta-2">
                        {JSON.stringify(t.contexto, null, 2)}
                      </pre>
                    </details>
                  )}

                  {puedeAtender && (
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-tinta-2">Mover a</span>
                      <Select
                        size="sm"
                        value={t.estado}
                        onChange={v => mover(t.id, v)}
                        options={ESTADOS.map(e => ({ value: e, label: ETIQUETA_ESTADO_TICKET[e] }))}
                        className="w-40"
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
