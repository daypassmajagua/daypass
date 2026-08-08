import EstadoVacio from './EstadoVacio'
import Esqueleto from './Esqueleto'
import EstadoError from './EstadoError'
import { classNames } from '../../lib/utils'

/**
 * El patrón más usado del sistema: una lista de filas del día.
 *
 * Lo comparten el listado del día, folios, llegadas y el embarque. No es una
 * tabla: en iPad y en el muelle una tabla de diez columnas es ilegible, y en
 * el computador las mismas filas se ven bien si están bien compuestas.
 *
 * Lo que aporta —y lo que nadie estaba haciendo igual en cada pantalla— es que
 * **los tres estados vienen incluidos**. Una lista no está terminada hasta que
 * responde bien a las tres preguntas: qué muestra mientras carga, qué muestra
 * cuando no hay nada, y qué muestra cuando falló. Hoy hay ocho vacíos
 * distintos repartidos por el código y ni un solo estado de error.
 *
 * Las filas las pinta quien la usa: cada pantalla sabe cómo se ve su fila.
 * Esto se encarga del marco, los estados y el agrupado.
 */
export default function ListaDelDia({
  items,
  children,           // (item, indice) => fila
  clave,              // item => clave estable; por defecto item.id
  cargando = false,
  error = null,
  onReintentar,
  vacio,              // props de EstadoVacio
  buscando = false,   // hay una búsqueda activa: cambia el vacío
  encabezado,
  separadas = false,  // filas con línea entre ellas en vez de espacio
  className = '',
}) {
  if (error) {
    return <EstadoError error={error} onReintentar={onReintentar} />
  }

  if (cargando) {
    return <Esqueleto filas={4} />
  }

  if (!items?.length) {
    return (
      <EstadoVacio
        buscando={buscando}
        {...(buscando && vacio?.buscando ? vacio.buscando : vacio)}
      />
    )
  }

  return (
    <div className={className}>
      {encabezado}
      <ul className={classNames(
        separadas ? 'divide-y divide-linea' : 'flex flex-col gap-2'
      )}>
        {items.map((item, i) => (
          <li key={clave ? clave(item) : (item.id ?? i)}>
            {children(item, i)}
          </li>
        ))}
      </ul>
    </div>
  )
}
