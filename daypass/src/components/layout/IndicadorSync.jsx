import { useEffect, useState } from 'react'
import { Check, CloudUpload, RefreshCw, WifiOff, X } from 'lucide-react'
import { useOffline } from '../../lib/offline/useOffline'
import { descartar } from '../../lib/offline/cola'
import { classNames, hora12, plural } from '../../lib/utils'

/**
 * El estado de la sincronización, siempre a la vista.
 *
 * Nunca se esconde y nunca dice "sincronizar": la asesora tiene que poder
 * responder de un vistazo si lo que acaba de marcar ya quedó guardado o
 * está esperando señal en el iPad.
 *
 * `muelle` lo pinta en alto contraste y con objetivos grandes.
 */
export default function IndicadorSync({ muelle = false }) {
  const { enLinea, pendientes, sincronizando, forzar, listarPendientes } = useOffline()
  const [abierto, setAbierto] = useState(false)
  const [lista, setLista] = useState([])

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

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className={classNames(
          'flex items-center gap-2 rounded-xl font-bold transition-colors',
          muelle ? 'px-4 min-h-[52px] text-[16px] ring-2' : 'px-3 min-h-[40px] text-[13px]',
          tono === 'verde' && (muelle ? 'bg-white text-verde-600 ring-verde-500' : 'bg-verde-50 text-verde-600'),
          tono === 'ambar' && (muelle ? 'bg-coral-50 text-coral-700 ring-coral-500' : 'bg-coral-50 text-coral-700'),
          tono === 'gris'  && (muelle ? 'bg-white text-[#3a3d52] ring-[#c8c9d4]' : 'bg-fondo text-tinta-2')
        )}
        title="Ver el estado de la sincronización"
      >
        {!enLinea
          ? <WifiOff size={muelle ? 20 : 15} />
          : pendientes > 0
            ? <CloudUpload size={muelle ? 20 : 15} className={sincronizando ? 'motion-safe:animate-pulse' : ''} />
            : <Check size={muelle ? 20 : 15} strokeWidth={3} />}
        <span className="truncate">{texto}</span>
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
              <button
                onClick={() => setAbierto(false)}
                className="icono-tactil w-11 h-11 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-fondo shrink-0"
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
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
                        className="shrink-0 rounded-lg px-3 min-h-[40px] text-[13px] font-bold text-[#d2322d] bg-[#fce9e8]"
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
