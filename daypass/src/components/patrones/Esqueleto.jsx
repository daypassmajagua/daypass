import { classNames } from '../../lib/utils'

/**
 * Lo que se ve mientras carga: la forma del contenido, no una ruedita.
 *
 * Un spinner dice "espera" y nada más. Un esqueleto dice **qué va a aparecer**
 * y dónde, así que cuando llegan los datos el ojo ya sabe dónde mirar y la
 * página no salta. Además, si tarda de verdad, un esqueleto que ya tiene la
 * forma correcta se siente más rápido que un círculo girando.
 *
 * La animación respeta `prefers-reduced-motion`: hay gente a la que el
 * parpadeo le molesta físicamente, y la información —"esto está cargando"— se
 * entiende igual sin que se mueva.
 */

function Barra({ ancho = '100%', alto = '1rem', className = '' }) {
  return (
    <span
      className={classNames('block rounded-lg bg-linea animate-pulse motion-reduce:animate-none', className)}
      style={{ width: ancho, height: alto }}
    />
  )
}

export default function Esqueleto({ filas = 3, className = '' }) {
  // Anchos distintos por fila: uno parejo se lee como una tabla vacía, no como
  // contenido en camino.
  const anchos = ['72%', '58%', '81%', '64%', '76%']

  return (
    <div
      className={classNames('flex flex-col gap-2', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }, (_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-[0_1px_2px_rgba(22,24,44,.05)]"
          aria-hidden="true"
        >
          <div className="flex-1 flex flex-col gap-2">
            <Barra ancho={anchos[i % anchos.length]} alto=".95rem" />
            <Barra ancho="38%" alto=".8rem" />
          </div>
          <Barra ancho="3.5rem" alto="1.6rem" className="shrink-0" />
        </div>
      ))}
    </div>
  )
}

export { Barra }
