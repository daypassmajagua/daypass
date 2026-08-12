import { Link } from 'react-router-dom'
import { CalendarOff, CalendarPlus } from 'lucide-react'
import { fraseFecha, hora12, plural, hoyLocal } from '../../lib/utils'
import EstadoVacio from '../patrones/EstadoVacio'

/**
 * El día en una frase.
 *
 * Es lo primero que se lee a las 7 a.m. y responde las preguntas reales:
 * cuántos van, en qué lanchas, y qué falta. Cada cifra que falta es un enlace
 * que lleva directo a resolverla.
 */

function Cifra({ children, a }) {
  if (!a) return <b className="font-bold text-tinta tabular">{children}</b>
  return (
    <Link
      to={a}
      className="font-bold text-coral-600 tabular underline decoration-coral-400 decoration-2 underline-offset-2 hover:decoration-coral-600"
    >
      {children}
    </Link>
  )
}

export default function FraseDelDia({ fecha, pax, lanchas, resumen, dia, hayReservas }) {
  /**
   * Un día vacío no siempre quiere decir lo mismo.
   *
   * Decía «Crea la primera» para **cualquier** día sin reservas, incluido uno
   * que ya pasó — y un día ido no se puede vender: la fecha ya no existe como
   * opción. Ofrecer la acción imposible es peor que no ofrecer ninguna, porque
   * quien la sigue termina con una reserva creada para otro día sin darse
   * cuenta.
   *
   * Un día pasado sin gente **no es un pendiente: es un hecho** — temporada
   * baja, un domingo cerrado, una bandera roja. Se dice y ya.
   */
  if (!hayReservas) {
    const yaPaso = fecha < hoyLocal()
    return (
      <EstadoVacio
        className="py-6"
        icono={yaPaso ? CalendarOff : CalendarPlus}
        titulo={
          yaPaso
            ? `No hubo operación ${fraseFecha(fecha).toLowerCase()}.`
            : `Todavía no hay reservas para ${fraseFecha(fecha).toLowerCase()}.`
        }
        detalle={yaPaso ? 'Ningún día del pasado se puede vender.' : null}
        accion={yaPaso ? null : { etiqueta: 'Crear la primera', a: '/nuevo' }}
      />
    )
  }

  const faltantes = []
  if (resumen.faltanNombres > 0) {
    faltantes.push(
      <span key="n">
        <Cifra a="/reservas">{resumen.faltanNombres}</Cifra>{' '}
        {resumen.faltanNombres === 1 ? 'nombre' : 'nombres'}
      </span>
    )
  }
  if (resumen.sinPago > 0) {
    faltantes.push(
      <span key="p">
        <Cifra a="/reservas">{resumen.sinPago}</Cifra>{' '}
        {resumen.sinPago === 1 ? 'pago' : 'pagos'} por confirmar
      </span>
    )
  }
  if (resumen.sinFolio > 0) {
    faltantes.push(
      <span key="f">
        <Cifra a="/folios">{resumen.sinFolio}</Cifra>{' '}
        {resumen.sinFolio === 1 ? 'folio' : 'folios'}
      </span>
    )
  }

  const cerradoA = hora12(dia?.cerrado_tentativo_at)

  return (
    // La frase no crece con la pantalla. Es la línea que se lee de un vistazo
    // a las siete de la mañana, y estirada a 1800 px se vuelve un renglón de
    // ciento diez caracteres: el ojo llega al final y ya no sabe por dónde
    // volver. El ancho de la oficina es para las tablas, no para el texto.
    <div className="flex flex-col gap-2 max-w-[68ch]">
      <p className="text-[22px] sm:text-[26px] font-bold tracking-[-.02em] leading-snug text-tinta text-balance">
        <span className="first-letter:uppercase">{fraseFecha(fecha)}</span> van{' '}
        <b className="tabular">{pax}</b> {pax === 1 ? 'persona' : 'personas'} en{' '}
        <b className="tabular">{lanchas}</b> {lanchas === 1 ? 'lancha' : 'lanchas'}.
        {faltantes.length > 0 && (
          <>
            {' '}Faltan{' '}
            {faltantes.map((f, i) => (
              <span key={i}>
                {i > 0 && (i === faltantes.length - 1 ? ' y ' : ', ')}
                {f}
              </span>
            ))}
            .
          </>
        )}
      </p>

      {faltantes.length === 0 && (
        <p className="text-[15px] text-verde-500 font-bold">
          {cerradoA
            ? `Todo listo. Cerraste el tentativo a las ${cerradoA}.`
            : 'Todo listo. Solo falta cerrar el tentativo.'}
        </p>
      )}

      {resumen.tardios > 0 && (
        <p className="text-[15px] text-coral-600 font-bold">
          {plural(resumen.tardios, 'reserva cambió', 'reservas cambiaron')} después del cierre.
        </p>
      )}
    </div>
  )
}
