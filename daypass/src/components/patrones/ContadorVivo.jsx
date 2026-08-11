import { useEffect, useRef, useState } from 'react'
import { classNames } from '../../lib/utils'

/**
 * Un número que cambia solo, sin parecer que se dañó.
 *
 * Nace para «en la isla ahora»: el dato que nadie tenía y que se mueve cuando
 * alguien embarca o desembarca, sin que quien mira haya tocado nada. Un número
 * que cambia por su cuenta es sospechoso por defecto —la primera reacción es
 * pensar que la pantalla falló—, así que hay que decir que el cambio es
 * legítimo antes de que a nadie le dé tiempo de dudar.
 *
 * ── Las cuatro decisiones ───────────────────────────────────────────────────
 *
 * **No se mueve de sitio ni cambia de tamaño.** Lo que salta de posición
 * parece roto. El ancho se reserva con `tabular-nums`, así que pasar de 9 a 10
 * no corre nada de lugar.
 *
 * **El dígito hace el tic del contador mecánico**: el viejo se va hacia arriba
 * mientras el nuevo entra desde abajo. Es el gesto que la gente ya asocia con
 * algo que cuenta en vivo, y no hay que enseñarlo.
 *
 * **El destello es una clase de estado, no una animación.** Parece un detalle
 * y no lo es: con `prefers-reduced-motion` las animaciones se apagan, y si el
 * aviso viviera en un keyframe, esas personas perderían la información de que
 * algo acaba de cambiar. Así el tic se apaga —que es movimiento— y el destello
 * se queda —que es información—.
 *
 * **Las ráfagas se agrupan.** Cuando bajan veinte personas de la lancha, el
 * número salta veinte veces en dos segundos. El valor se muestra siempre al
 * día —jamás se retrasa el dato— pero el aviso se dispara una vez cada 300 ms:
 * lo que sobra es el parpadeo, no la cifra.
 *
 * ── La edad, que es media función ───────────────────────────────────────────
 *
 * En la isla no hay señal la mitad del tiempo. Un número viejo que se sabe
 * viejo es información; uno viejo que parece fresco es una mentira. Por eso
 * `edad` se muestra siempre que exista, y no solo cuando pasa un umbral.
 */
export default function ContadorVivo({
  valor,
  etiqueta,
  sufijo,
  edad,                 // texto ya formateado: 'hace 12 min'
  // lg (isla, panorama) · md (en línea, fondo claro) · oscuro (la franja navy)
  tamano = 'lg',
  className = '',
}) {
  const [reciente, setReciente] = useState(false)
  const previo = useRef(valor)
  const ultimoAviso = useRef(0)

  useEffect(() => {
    if (previo.current === valor) return
    previo.current = valor

    // Una ráfaga entera se anuncia una vez. `Date.now` va aquí y no en el
    // render: en el cuerpo del componente sería impuro.
    const ahora = Date.now()
    if (ahora - ultimoAviso.current < 300) return
    ultimoAviso.current = ahora

    setReciente(true)
    const t = setTimeout(() => setReciente(false), 700)
    return () => clearTimeout(t)
  }, [valor])

  const grande = tamano === 'lg'

  /**
   * Sobre fondo oscuro el color se hereda del contenedor.
   *
   * La franja del día es navy, y con los tonos de tinta el número quedaba casi
   * invisible: se veía la etiqueta y no la cifra, que es exactamente al revés
   * de lo que hace falta. Con `currentColor` el mismo componente sirve en la
   * isla —fondo claro— y en la franja, sin dos versiones que mantener.
   */
  const enOscuro = tamano === 'oscuro'
  const colorCifra = enOscuro ? '' : 'text-tinta'
  const colorApoyo = enOscuro ? 'opacity-75' : 'text-tinta-2'

  return (
    <div
      className={classNames(
        'inline-flex flex-col rounded-xl px-3 py-2 transition-colors duration-500',
        reciente && !enOscuro ? 'bg-mar-50' : '',
        // En oscuro el destello es del color del texto, no un fondo claro que
        // rompería la franja.
        reciente && enOscuro ? 'bg-white/15' : '',
        className
      )}
      // Lo lee el lector de pantalla cuando cambia, sin robarle el foco a nadie.
      role="status"
      aria-live="polite"
    >
      {etiqueta && (
        <span className={classNames(
          'font-bold uppercase tracking-wider',
          colorApoyo,
          grande ? 'text-[13px]' : 'text-[11px]'
        )}>
          {etiqueta}
        </span>
      )}

      <span className="flex items-baseline gap-1.5">
        <span
          // La clave fuerza el remonte del nodo en cada valor: es lo que hace
          // que el dígito nuevo entre animado en vez de reemplazarse en seco.
          key={valor}
          className={classNames(
            'tabular font-bold tic-entra',
            colorCifra,
            grande ? 'text-[44px] leading-none' : 'text-[20px] leading-none'
          )}
        >
          {valor}
        </span>
        {sufijo && (
          <span className={classNames(colorApoyo, grande ? 'text-[17px]' : 'text-[13px]')}>
            {sufijo}
          </span>
        )}
      </span>

      {edad && (
        <span className={classNames(colorApoyo, grande ? 'text-[13px]' : 'text-[11px]')}>
          {edad}
        </span>
      )}
    </div>
  )
}
