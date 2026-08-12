import { useEffect, useRef, useState } from 'react'
import { Check, CloudUpload, RefreshCw, WifiOff, X } from 'lucide-react'
import { useOffline } from '../../lib/offline/useOffline'
import { descartar } from '../../lib/offline/cola'
import { classNames, hora12, plural } from '../../lib/utils'
import BotonIcono from '../ui/BotonIcono'

/**
 * El estado de lo que falta por subir. **Solo cuando hay algo que decir.**
 *
 * Antes vivía puesto en la barra con un visto verde permanente que decía
 * «Todo guardado». Es la misma trampa que la regla de los colores: si el
 * estado sano ocupa espacio todos los días, deja de leerse — y el día que se
 * pone ámbar tampoco se ve, porque esa esquina ya se aprendió a ignorar.
 *
 * Ahora hay tres situaciones y cada una pesa lo que debe:
 *
 *   · **todo bien y con señal** → nada. El silencio ES el estado sano.
 *   · **acaba de guardarse lo último** → un aviso leve abajo a la derecha que
 *     se va solo en dos segundos y medio. Confirma sin quedarse.
 *   · **sin señal, o con cosas esperando** → la ficha en la barra, como
 *     siempre: eso sí cambia lo que alguien decide hacer.
 *
 * `muelle` lo pinta en alto contraste y con objetivos grandes.
 */
const DURA_AVISO = 2500

export default function IndicadorSync({ muelle = false }) {
  const { enLinea, pendientes, sincronizando, forzar, listarPendientes } = useOffline()
  const [abierto, setAbierto] = useState(false)
  const [lista, setLista] = useState([])
  const [recienGuardado, setRecienGuardado] = useState(false)
  const habiaPendientes = useRef(false)

  // El aviso solo aparece cuando algo pasó de estar esperando a estar guardado.
  // Al entrar a la app no hay nada que celebrar, y por eso se recuerda si
  // antes había algo: sin eso, cada carga saludaría con un «todo guardado».
  useEffect(() => {
    if (pendientes > 0) { habiaPendientes.current = true; return }
    if (!habiaPendientes.current) return
    habiaPendientes.current = false
    setRecienGuardado(true)
    const t = setTimeout(() => setRecienGuardado(false), DURA_AVISO)
    return () => clearTimeout(t)
  }, [pendientes])

  useEffect(() => {
    if (!abierto) return
    listarPendientes().then(setLista)
  }, [abierto, pendientes, listarPendientes])

  const todoGuardado = pendientes === 0
  const tono = todoGuardado && enLinea
    ? 'verde'
    : pendientes > 0 ? 'ambar' : 'gris'

  const texto = !enLinea && pendientes > 0
    ? `${plural(pendientes, 'cambio guardado', 'cambios guardados')} en este iPad`
    : !enLinea
      ? 'Sin señal — puedes seguir trabajando'
      : pendientes > 0
        ? `${plural(pendientes, 'cambio', 'cambios')} subiendo`
        : 'Todo guardado'

  const detalle = !enLinea && pendientes > 0
    ? 'Se suben solos al volver la señal'
    : null

  // Nada que decir: ni ficha en la barra ni aviso. Solo queda el panel, que
  // se abre desde donde haga falta cuando vuelva a haber algo.
  const callado = enLinea && pendientes === 0

  if (callado && !recienGuardado && !abierto) return null

  if (callado) {
    return (
      <>
        {recienGuardado && (
          <div
            className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40
                       flex items-center gap-2 rounded-xl bg-verde-50 text-verde-600
                       px-3.5 py-2.5 text-[14px] font-bold shadow-[0_4px_16px_rgba(22,24,44,.12)]
                       aparecer pointer-events-none"
            role="status"
            aria-live="polite"
          >
            <Check size={16} strokeWidth={3} />
            Todo guardado
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className={classNames(
          'flex items-center gap-2 rounded-xl font-bold transition-colors',
          muelle ? 'px-4 min-h-[52px] text-[16px] ring-2' : 'px-3 min-h-[40px] text-[13px]',
          tono === 'verde' && (muelle ? 'bg-white text-verde-600 ring-verde-500' : 'bg-verde-50 text-verde-600'),
          tono === 'ambar' && (muelle ? 'bg-coral-50 text-coral-700 ring-coral-500' : 'bg-coral-50 text-coral-700'),
          tono === 'gris'  && (muelle ? 'bg-white text-sol-tinta-2 ring-sol-linea' : 'bg-fondo text-tinta-2')
        )}
        title="Ver el estado de la conexión"
      >
        {!enLinea
          ? <WifiOff size={muelle ? 20 : 15} />
          : pendientes > 0
            ? <CloudUpload size={muelle ? 20 : 15} className={sincronizando ? 'motion-safe:animate-pulse' : ''} />
            : <Check size={muelle ? 20 : 15} strokeWidth={3} />}
        {/* En pantallas apretadas el ícono basta; el detalle está a un toque.
            Salvo cuando hay algo pendiente: eso siempre se lee. */}
        <span className={classNames('truncate', !muelle && pendientes === 0 && 'hidden lg:inline')}>
          {texto}
        </span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto overscroll-contain bg-white rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-bold text-tinta">{texto}</h2>
                <p className="text-sm text-tinta-2">
                  {detalle || (enLinea ? 'La conexión está bien.' : 'Sin conexión en este momento.')}
                </p>
              </div>
              <BotonIcono onClick={() => setAbierto(false)} etiqueta="Cerrar">
                <X size={22} />
              </BotonIcono>
            </div>

            {lista.length > 0 && (
              <ul className="flex flex-col gap-2">
                {lista.map(item => (
                  <li key={item.client_id} className="flex items-center gap-3 rounded-xl bg-fondo px-4 py-3">
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-[15px] text-tinta truncate">
                        {item.descripcion}
                      </span>
                      <span className="block text-[13px] text-tinta-2 tabular">
                        {hora12(item.creado_en)}
                        {item.intentos > 0 && ` · ${plural(item.intentos, 'intento', 'intentos')}`}
                      </span>
                      {item.ultimo_error && (
                        <span className="block text-[13px] text-coral-600 font-bold mt-0.5">
                          {item.ultimo_error}
                        </span>
                      )}
                    </span>
                    {/* Descartar solo lo que el servidor rechaza siempre:
                        es una decisión humana, no automática. */}
                    {item.intentos >= 3 && (
                      <button
                        onClick={async () => { await descartar(item.client_id); setLista(await listarPendientes()) }}
                        className="shrink-0 rounded-lg px-3 min-h-[40px] text-[13px] font-bold text-peligro-500 bg-peligro-50"
                      >
                        Descartar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {lista.length === 0 && (
              <p className="text-tinta-2 text-[15px] py-2">
                No hay nada esperando. Todo lo que has marcado ya está en el servidor.
              </p>
            )}

            <button
              onClick={forzar}
              disabled={sincronizando || !enLinea || pendientes === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-bold min-h-[52px] text-[16px] disabled:opacity-40"
            >
              <RefreshCw size={18} className={sincronizando ? 'motion-safe:animate-spin' : ''} />
              {sincronizando ? 'Subiendo…' : 'Subir ahora'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
