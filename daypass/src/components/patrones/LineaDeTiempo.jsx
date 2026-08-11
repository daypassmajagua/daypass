import { Fragment } from 'react'
import { classNames } from '../../lib/utils'
import EstadoVacio from './EstadoVacio'

/**
 * La historia de algo, contada como historia.
 *
 * Sirve para los seis: persona, agencia, reserva, plan, lancha y empleado. Por
 * eso **no sabe de dónde salieron los eventos**: recibe una lista ya
 * normalizada. Agregarle una fuente nueva —el folio con hora, el enlace
 * abierto— es agregar una fuente, no tocar esta pantalla.
 *
 * ── Las cuatro decisiones ───────────────────────────────────────────────────
 *
 * **Lo más reciente arriba.** La pregunta que trae a alguien a un perfil casi
 * siempre es *qué pasó ahora* o *por qué está así*, y eso está al final de la
 * historia. Una línea que arranca por «creada el 3 de agosto» obliga a leer
 * doce filas para llegar a lo único que se preguntó.
 *
 * **Se agrupa por lo que la cosa es.** Una reserva cabe entera y se agrupa por
 * día; una persona con cuatro años se agrupa por año, con el actual abierto y
 * los demás plegados con su resumen. Plegar veinte filas sería esconder lo que
 * no estorba; no plegar cien sería enterrar lo de esta semana.
 *
 * **Solo dos cosas se destacan**: lo que alguien hizo a mano —las excepciones
 * auditadas de la regla 3, que son por las que uno abre un perfil a
 * preguntar— y lo que pasó después del cierre. Todo lo demás es historia
 * normal y se ve como historia normal. Si todo se destaca, nada se destaca.
 *
 * **El vacío de autor se explica.** La firma existe desde la migración 024;
 * antes de eso nadie quedaba registrado. Decenas de eventos con el autor en
 * blanco parecerían un error del sistema, así que el corte se dice con
 * palabras. Un vacío explicado es información; uno silencioso es un defecto.
 */

/** `{ cuando, tipo, texto, quien, motivo, destacado }` — eso es todo lo que pide. */
export default function LineaDeTiempo({
  eventos = [],
  agruparPor = 'dia',      // dia · mes · anio
  desdeCuandoHayFirma,     // ISO: antes de esta fecha nadie quedaba registrado
  vacio,
  className = '',
}) {
  if (!eventos.length) {
    return vacio
      ? <EstadoVacio {...vacio} />
      : <p className="text-[15px] text-tinta-2 py-6">Todavía no hay nada que contar.</p>
  }

  const ordenados = [...eventos].sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)))
  const grupos = agrupar(ordenados, agruparPor)

  return (
    <div className={classNames('flex flex-col gap-5', className)}>
      {grupos.map(g => (
        <section key={g.clave}>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-tinta-2 mb-2">
            {g.titulo}
          </h3>

          <ol className="flex flex-col">
            {g.eventos.map((e, i) => {
              const sinFirma = !e.quien && desdeCuandoHayFirma
                && String(e.cuando) < String(desdeCuandoHayFirma)
              return (
                <Fragment key={`${e.cuando}-${i}`}>
                  <li className="flex gap-3 py-2 border-l-2 border-linea pl-4 -ml-px relative">
                    {/* El punto de la línea. Coral solo en lo que hay que mirar. */}
                    <span
                      className={classNames(
                        'absolute -left-[5px] top-[1.15rem] w-2 h-2 rounded-full',
                        e.destacado ? 'bg-coral-500' : 'bg-linea'
                      )}
                      aria-hidden="true"
                    />
                    <time className="text-[13px] text-tinta-2 tabular shrink-0 w-14 pt-0.5">
                      {hora(e.cuando)}
                    </time>
                    <div className="min-w-0 flex-1">
                      <p className={classNames(
                        'text-[15px]',
                        e.destacado ? 'font-bold text-tinta' : 'text-tinta'
                      )}>
                        {e.texto}
                      </p>
                      {e.motivo && (
                        <p className="text-[14px] text-tinta-2 italic">«{e.motivo}»</p>
                      )}
                      <p className="text-[13px] text-tinta-2">
                        {e.quien || (sinFirma ? 'sin registro de quién' : 'el sistema')}
                      </p>
                    </div>
                  </li>
                </Fragment>
              )
            })}
          </ol>
        </section>
      ))}

      {desdeCuandoHayFirma && (
        <p className="text-[13px] text-tinta-2 border-t border-linea pt-3">
          De antes del {fecha(desdeCuandoHayFirma)} no se guardaba quién hacía cada cosa. No es
          que falte el dato: en ese entonces no se registraba.
        </p>
      )}
    </div>
  )
}

// ─── Agrupar ──────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function agrupar(eventos, por) {
  const mapa = new Map()
  for (const e of eventos) {
    const clave = claveDe(e.cuando, por)
    if (!mapa.has(clave)) mapa.set(clave, { clave, titulo: tituloDe(e.cuando, por), eventos: [] })
    mapa.get(clave).eventos.push(e)
  }
  return [...mapa.values()]
}

function claveDe(cuando, por) {
  const s = String(cuando)
  if (por === 'anio') return s.slice(0, 4)
  if (por === 'mes') return s.slice(0, 7)
  return s.slice(0, 10)
}

function tituloDe(cuando, por) {
  const s = String(cuando)
  const [a, m, d] = s.slice(0, 10).split('-')
  if (por === 'anio') return a
  if (por === 'mes') return `${MESES[Number(m) - 1]} ${a}`
  return `${Number(d)} de ${MESES[Number(m) - 1]} ${a}`
}

/** Solo la hora: el día ya lo dice el encabezado del grupo. */
function hora(cuando) {
  const s = String(cuando)
  if (s.length <= 10) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fecha(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`
}
