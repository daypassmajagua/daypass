import { CloudOff, RotateCcw, TriangleAlert } from 'lucide-react'
import Button from '../ui/Button'

/**
 * Cuando algo falló: qué pasó y cómo se arregla. Nunca un código.
 *
 * Hoy no existe en ninguna pantalla — si una consulta falla, la lista se queda
 * vacía y parece que no hay reservas. Eso es peor que un error: es un error
 * que miente.
 *
 * Dos casos que se ven distinto porque se resuelven distinto:
 *
 *  · **Sin señal** — no falló nada, falta red. En el muelle y en la isla es lo
 *    normal, y la copia local sigue sirviendo. No hay que alarmar.
 *  · **Falló de verdad** — ahí sí se ofrece reintentar y se guarda el detalle
 *    técnico, pero plegado: a Daniela no le sirve `PGRST202`, y a quien lo
 *    tenga que arreglar sí.
 *
 * Siempre hay salida. Un error sin botón deja a alguien atrapado a las ocho de
 * la mañana con la fila esperando.
 */
export default function EstadoError({ error, onReintentar, className = '' }) {
  const sinRed = typeof navigator !== 'undefined' && !navigator.onLine
  const detalle = typeof error === 'string' ? error : error?.message

  const Icono = sinRed ? CloudOff : TriangleAlert

  return (
    <div className={'flex flex-col items-center text-center gap-3 py-10 px-6 ' + className}>
      <Icono
        size={30}
        strokeWidth={1.5}
        className={sinRed ? 'text-tinta-2/60' : 'text-coral-600/70'}
        aria-hidden="true"
      />

      <p className="text-[17px] font-bold text-tinta text-balance max-w-md">
        {sinRed ? 'Sin señal' : 'No se pudo cargar esto'}
      </p>

      <p className="text-[15px] text-tinta-2 text-balance max-w-md">
        {sinRed
          ? 'Lo que ya estaba descargado sigue funcionando. Vuelve a intentarlo cuando haya red.'
          : 'Puede ser algo pasajero. Vuelve a intentarlo; si sigue igual, avísale a quien maneja el sistema.'}
      </p>

      {onReintentar && (
        <Button variant="secondary" onClick={onReintentar} className="mt-1">
          <RotateCcw size={16} />
          Volver a intentar
        </Button>
      )}

      {/* El detalle técnico existe pero no estorba: quien lo necesita lo abre. */}
      {detalle && (
        <details className="mt-2 max-w-md w-full text-left">
          <summary className="text-[13px] text-tinta-2 cursor-pointer select-none">
            Detalle técnico
          </summary>
          <p className="mt-1.5 text-[13px] text-tinta-2 font-mono break-words bg-fondo rounded-lg px-3 py-2">
            {detalle}
          </p>
        </details>
      )}
    </div>
  )
}
