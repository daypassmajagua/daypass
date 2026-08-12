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

  /**
   * En dos columnas cuando la pantalla da.
   *
   * Al llevar la oficina al ancho completo, esta lista fue lo primero que se
   * rompió, y no se veía venir leyendo el código: cada tarjeta lleva el
   * problema a la izquierda y el botón que lo resuelve a la derecha, así que a
   * 1800 px quedaban **separados por metro y medio de nada**. Había que cruzar
   * la pantalla con la vista para unir «faltan 28 nombres» con «Agregar los
   * nombres», que es justo lo que la proximidad existe para evitar.
   *
   * Dos columnas resuelven las dos cosas a la vez: se aprovecha el ancho y
   * cada pendiente vuelve a caber en un golpe de vista. De paso, ocho
   * pendientes pasan de ocho filas a cuatro.
   */
  return (
    <ul className="grid grid-cols-1 xl:grid-cols-2 gap-2">
      {lista.map(p => <TarjetaPendiente key={p.id} pendiente={p} />)}
    </ul>
  )
}
