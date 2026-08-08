import Modal from '../ui/Modal'
import Button from '../ui/Button'

/**
 * Preguntar antes de hacer algo, o no preguntar y dejar deshacer.
 *
 * La regla ya estaba decidida y estaba repartida por cuatro pantallas:
 *
 *   **Lo destructivo se deshace, no se confirma.** Borrar una reserva, marcar
 *   un no-show, quitar a alguien de una lista: se hace de una y aparece un
 *   aviso de ocho segundos para deshacerlo. Preguntar "¿estás segura?" antes
 *   de cada cosa entrena a la gente a decir que sí sin leer, y entonces la
 *   pregunta ya no protege nada.
 *
 *   **Solo se confirma lo que no se puede deshacer.** Cerrar el día, cerrar un
 *   zarpe, unir dos personas. Ahí sí, porque después no hay vuelta.
 *
 * Por eso este componente **no** es el diálogo por defecto: es la excepción, y
 * usarlo debería costar un momento de duda. Si lo que vas a confirmar se puede
 * deshacer, no lo uses — usa un toast con acción.
 *
 * Para lo que sí es irreversible, el diálogo dice **qué va a pasar**, no
 * pregunta si estás seguro. "Se va a cerrar el día y la cocina recibe el
 * conteo" informa; "¿estás seguro?" no dice nada.
 */
export default function ConfirmarAccion({
  abierto,
  titulo,
  children,          // qué va a pasar, en una o dos frases
  etiquetaConfirmar,
  variante = 'primary',   // 'danger' si además borra algo
  cargando = false,
  onConfirmar,
  onCancelar,
}) {
  return (
    <Modal open={abierto} onClose={onCancelar} title={titulo}>
      <div className="text-[15px] text-tinta">{children}</div>
      <div className="flex gap-3 justify-end mt-5">
        <Button variant="ghost" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Button>
        <Button variant={variante} onClick={onConfirmar} loading={cargando}>
          {etiquetaConfirmar}
        </Button>
      </div>
    </Modal>
  )
}
