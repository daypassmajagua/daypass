import { Link } from 'react-router-dom'
import { fraseFecha, hora12, plural } from '../../lib/utils'

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
  if (!hayReservas) {
    return (
      <p className="text-[22px] sm:text-[26px] font-bold tracking-[-.02em] leading-snug text-tinta text-balance">
        Todavía no hay reservas para {fraseFecha(fecha).toLowerCase()}.{' '}
        <Link to="/nuevo" className="text-blue-600 underline decoration-2 underline-offset-2">
          Crea la primera
        </Link>
      </p>
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
    <div className="flex flex-col gap-2">
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
