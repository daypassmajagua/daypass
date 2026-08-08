import { Link } from 'react-router-dom'
import Button from '../ui/Button'

/**
 * Cuando no hay nada que mostrar.
 *
 * Un vacío **no es un error**: casi siempre es una invitación. "Todavía no hay
 * reservas para el 15 de agosto" no significa que algo falló, significa que
 * nadie ha vendido todavía — y lo que hace falta es el botón para crear la
 * primera, no una cara triste.
 *
 * Hay dos vacíos distintos y conviene no confundirlos:
 *
 *  · **No hay nada todavía** → invita a crear. Trae acción.
 *  · **No hay nada que coincida** → la búsqueda no encontró. NO trae acción:
 *    lo que hace falta es cambiar la búsqueda, y ofrecer "crear" ahí sería
 *    empujar a crear algo que a lo mejor ya existe con otro nombre.
 *
 * Antes cada pantalla escribía el suyo: hay ocho vacíos distintos repartidos
 * entre Cocina, Embarque, Equipo, Isla y SeccionPasajeros, cada uno con su
 * tamaño de letra y su tono.
 */
export default function EstadoVacio({
  icono: Icono,
  titulo,
  detalle,
  accion,          // { etiqueta, a } → enlace · { etiqueta, onClick } → botón
  buscando = false,  // el vacío de "no coincide", que no invita a crear
  className = '',
}) {
  return (
    <div className={'flex flex-col items-center text-center gap-3 py-10 px-6 ' + className}>
      {Icono && (
        <Icono
          size={30}
          strokeWidth={1.5}
          className={buscando ? 'text-tinta-2/50' : 'text-blue-700/40'}
          aria-hidden="true"
        />
      )}

      <p className="text-[17px] font-bold text-tinta text-balance max-w-md">{titulo}</p>

      {detalle && (
        <p className="text-[15px] text-tinta-2 text-balance max-w-md">{detalle}</p>
      )}

      {/* En el vacío de búsqueda no se ofrece crear: lo que falta es cambiar
          lo que se escribió, no dar de alta algo que quizá ya existe. */}
      {accion && !buscando && (
        accion.a
          ? <Button as={Link} to={accion.a} className="mt-1">{accion.etiqueta}</Button>
          : <Button onClick={accion.onClick} className="mt-1">{accion.etiqueta}</Button>
      )}
    </div>
  )
}
