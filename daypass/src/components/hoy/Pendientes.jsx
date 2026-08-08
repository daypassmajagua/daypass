import { Check } from 'lucide-react'
import { fraseFecha } from '../../lib/utils'
import { TarjetaPendiente } from '../patrones'

/**
 * Lo pendiente del día, como lista de tareas con nombre propio.
 *
 * La fila salió de aquí a `patrones/TarjetaPendiente` para que el cierre, la
 * isla y el panorama de la directora usen la misma. Esto se queda con lo que
 * es propio de "Hoy": el estado de que no falta nada.
 *
 * Ese vacío no usa `EstadoVacio` a propósito. Los demás vacíos del sistema
 * dicen "todavía no hay nada, crea el primero"; este dice lo contrario —**ya
 * está todo hecho**— y merece verse como un logro, en verde, y no como una
 * invitación a llenar algo.
 */
export default function Pendientes({ lista, fecha }) {
  if (!lista.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-verde-50 px-5 py-4">
        <Check size={20} className="text-verde-500 shrink-0" aria-hidden="true" />
        <p className="font-bold text-verde-600 text-[15px]">
          Todo listo para {fraseFecha(fecha).toLowerCase()}.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {lista.map(p => <TarjetaPendiente key={p.id} pendiente={p} />)}
    </ul>
  )
}
