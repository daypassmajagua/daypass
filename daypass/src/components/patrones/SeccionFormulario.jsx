import Card from '../ui/Card'
import { classNames } from '../../lib/utils'

/**
 * Un bloque de formulario: número, título, por qué se pregunta, y los campos.
 *
 * Sale de Reserva, que es donde el orden importa: los campos están agrupados
 * en el orden en que Daniela piensa —cuándo vienen, quién, cuántos, cuánto—
 * y no en el orden en que están las columnas de la tabla.
 *
 * El `porque` no es relleno. La regla 23 dice que **cada campo justifica por
 * qué se pregunta**, y una sección que no puede explicarse en una línea
 * probablemente esté pidiendo algo que no hace falta. Es una prueba de diseño
 * disfrazada de texto de ayuda.
 *
 * El número solo aparece si se le pasa: numerar da orden cuando el formulario
 * **es** una secuencia, y es puro ruido cuando son bloques independientes.
 */
export default function SeccionFormulario({
  numero,
  titulo,
  porque,
  children,
  className = '',
}) {
  return (
    <Card className={classNames('p-5 flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-.01em] text-tinta">
          {numero != null && (
            <span
              className="w-7 h-7 shrink-0 rounded-lg bg-blue-50 text-blue-700 text-sm font-bold flex items-center justify-center tabular"
              aria-hidden="true"
            >
              {numero}
            </span>
          )}
          {titulo}
        </h2>
        {porque && <p className="text-[13px] text-tinta-2">{porque}</p>}
      </div>
      {children}
    </Card>
  )
}
