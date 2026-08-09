import { useState } from 'react'
import { LifeBuoy, X, Camera, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import useAppStore from '../../store/useAppStore'
import { useModo } from '../../lib/modo'
import { classNames } from '../../lib/utils'
import { TIPOS_TICKET, capturarPantalla, enviarTicket } from '../../lib/tickets'

/**
 * El botón de reportar, en todas las pantallas y en los tres modos.
 *
 * Vive en el marco de la app y no en cada pantalla porque el fallo que más
 * importa —el que pasa con la fila esperando— ocurre en el muelle y en la
 * isla, que son justamente las dos pantallas sin barra. Un canal de reportes
 * que solo existe en la oficina no recoge los reportes que valen.
 *
 * Se pregunta lo mínimo: qué tipo es, una frase, y si dejó a alguien parado.
 * Todo lo demás lo captura el sistema. Escribir un reporte no puede costar más
 * que el problema que se está reportando.
 */
export default function BotonReportar() {
  const [abierto, setAbierto] = useState(false)
  const [captura, setCaptura] = useState(null)
  const [preparando, setPreparando] = useState(false)

  const modo = useModo()
  const fechaActiva = useAppStore(s => s.fechaActiva)

  async function abrir() {
    setPreparando(true)
    // La foto va antes de abrir: después, la pantalla sería este formulario.
    setCaptura(await capturarPantalla())
    setPreparando(false)
    setAbierto(true)
  }

  return (
    <>
      <button
        onClick={abrir}
        disabled={preparando}
        aria-label="Reportar un problema"
        className={classNames(
          'fixed z-30 right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)]',
          'flex items-center justify-center rounded-full shadow-lg transition-colors',
          'bg-white text-brand-900 ring-1 ring-linea hover:bg-fondo disabled:opacity-60',
          // En el muelle y la isla se usa de pie y con una mano.
          modo.conBarra ? 'w-11 h-11' : 'w-14 h-14'
        )}
        title="Reportar un problema"
      >
        <LifeBuoy size={modo.conBarra ? 20 : 24} />
      </button>

      {abierto && (
        <Formulario
          captura={captura}
          onQuitarCaptura={() => setCaptura(null)}
          onCerrar={() => setAbierto(false)}
          modo={modo.id}
          fechaActiva={fechaActiva}
        />
      )}
    </>
  )
}

function Formulario({ captura, onQuitarCaptura, onCerrar, modo, fechaActiva }) {
  const [tipo, setTipo] = useState('no_funciona')
  const [titulo, setTitulo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [bloqueo, setBloqueo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    if (!titulo.trim()) return

    setEnviando(true)
    const { enCola } = await enviarTicket({
      tipo, bloqueo, titulo, detalle, captura, modo, fechaActiva,
    })
    setEnviando(false)
    onCerrar()

    toast.success(
      enCola
        ? 'Reporte guardado. Sale solo cuando haya señal.'
        : 'Reporte enviado. Gracias.'
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <form
        onSubmit={enviar}
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto
                   pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-linea sticky top-0 bg-white">
          <h2 className="text-[18px] font-bold text-tinta">Contar qué pasó</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar"
            className="p-2 -mr-2 rounded-xl text-tinta-2 hover:bg-fondo">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {TIPOS_TICKET.map(t => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                className={classNames(
                  'rounded-xl px-2 py-3 text-left transition-colors ring-1',
                  tipo === t.valor
                    ? 'bg-brand-900 text-white ring-brand-900'
                    : 'bg-fondo text-tinta ring-transparent hover:ring-linea'
                )}
              >
                <span className="block text-[14px] font-bold">{t.etiqueta}</span>
                <span className={classNames('block text-[12px] mt-0.5',
                  tipo === t.valor ? 'text-white/70' : 'text-tinta-2')}>
                  {t.detalle}
                </span>
              </button>
            ))}
          </div>

          <label className="block">
            <span className="block text-[14px] font-bold text-tinta mb-1.5">¿Qué pasó?</span>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="En una frase"
              autoFocus
              maxLength={140}
              className="w-full rounded-xl border border-linea px-3 min-h-[48px] text-[16px]
                         focus:outline-none focus:ring-2 focus:ring-brand-900/30"
            />
          </label>

          <label className="block">
            <span className="block text-[14px] font-bold text-tinta mb-1.5">
              Detalle <span className="font-normal text-tinta-2">(opcional)</span>
            </span>
            <textarea
              value={detalle}
              onChange={e => setDetalle(e.target.value)}
              rows={3}
              placeholder="Qué estabas haciendo, qué esperabas que pasara"
              className="w-full rounded-xl border border-linea px-3 py-2 text-[16px] resize-y
                         focus:outline-none focus:ring-2 focus:ring-brand-900/30"
            />
          </label>

          {/* La casilla que cambia la prioridad de todo. */}
          <button
            type="button"
            onClick={() => setBloqueo(!bloqueo)}
            className={classNames(
              'flex items-start gap-3 rounded-xl px-3 py-3 text-left ring-1 transition-colors',
              bloqueo ? 'bg-coral-50 ring-coral-500' : 'bg-fondo ring-transparent hover:ring-linea'
            )}
          >
            <TriangleAlert
              size={20}
              className={classNames('shrink-0 mt-0.5', bloqueo ? 'text-coral-600' : 'text-tinta-2')}
              aria-hidden="true"
            />
            <span>
              <span className="block text-[15px] font-bold text-tinta">Me bloqueó la operación</span>
              <span className="block text-[13px] text-tinta-2">
                No pude seguir trabajando. Se mira de primero.
              </span>
            </span>
          </button>

          {captura ? (
            <div className="rounded-xl bg-fondo p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-tinta-2">
                  <Camera size={14} /> Foto de la pantalla
                </span>
                <button type="button" onClick={onQuitarCaptura}
                  className="flex items-center gap-1 text-[13px] text-tinta-2 hover:text-coral-600 px-2 py-1 rounded-lg">
                  <Trash2 size={14} /> Quitar
                </button>
              </div>
              <img src={captura} alt="Lo que se ve en la pantalla ahora"
                className="w-full rounded-lg ring-1 ring-linea max-h-40 object-cover object-top" />
              <p className="text-[12px] text-tinta-2 mt-2">
                Si en la pantalla se ve el dato de un cliente, quítala.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-tinta-2">Sin foto de la pantalla.</p>
          )}

          <p className="text-[13px] text-tinta-2">
            Va con la pantalla donde estás, el día activo y lo que el sistema
            sepa del aparato. No hace falta que lo escribas.
          </p>
        </div>

        <div className="px-5 pb-4 flex gap-2 justify-end">
          <button type="button" onClick={onCerrar}
            className="px-4 min-h-[48px] rounded-xl text-[15px] font-bold text-tinta-2 hover:bg-fondo">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !titulo.trim()}
            className="px-5 min-h-[48px] rounded-xl bg-brand-900 text-white text-[15px] font-bold
                       disabled:opacity-40"
          >
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}
