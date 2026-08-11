import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { classNames } from '../../lib/utils'
import Button from '../ui/Button'

/**
 * Una ficha: la página de un registro, no su ventana emergente.
 *
 * Sirve para plan, lancha, empleado, persona, agencia y reserva. Es el patrón
 * que convierte un catálogo en algo que se consulta, y no solo en algo que se
 * edita.
 *
 * ── Por qué página y no modal ───────────────────────────────────────────────
 *
 * Un modal no tiene dirección: no se puede compartir, no se puede volver a
 * abrir, y no puede ser el destino de una búsqueda. Buscar «Gold» tiene que
 * llevar a algún lado, y ese lado es esto. Además un modal obliga a que todo
 * quepa en una ventana, y una ficha con su historia no cabe.
 *
 * ── Las dos columnas ────────────────────────────────────────────────────────
 *
 * A la izquierda **lo que la cosa es** —lo editable—; a la derecha **en qué
 * estado está y qué se rompe si cambia**. Esa división es la que hace que se
 * pueda responder «¿puedo desactivar esto?» sin leer la pantalla entera.
 *
 * En pantalla angosta el riel baja al final: en un celular, lo primero sigue
 * siendo qué es la cosa.
 *
 * ── La barra de guardado ────────────────────────────────────────────────────
 *
 * Aparece **solo cuando hay cambios sin guardar**, igual que el indicador de
 * sincronización: el silencio es el estado sano. Y guarda de forma deliberada,
 * no al instante — marcar un embarque es un toque, pero cambiar un precio
 * merece confirmarse y poder descartarse.
 */
export default function Ficha({
  volverA,
  volverEtiqueta = 'Volver',
  titulo,
  subtitulo,
  insignia,          // el estado, arriba a la derecha del título
  acciones,          // lo que se puede hacer con esto
  children,          // la columna principal
  riel,              // la columna de estado y consecuencias
  hayCambios = false,
  guardando = false,
  onGuardar,
  onDescartar,
  className = '',
}) {
  return (
    <div className={classNames('max-w-5xl mx-auto px-4 pb-24', className)}>
      {volverA && (
        <Link
          to={volverA}
          className="inline-flex items-center gap-1 text-[14px] font-bold text-tinta-2 hover:text-blue-700 min-h-[44px]"
        >
          <ChevronRight size={15} className="rotate-180" />
          {volverEtiqueta}
        </Link>
      )}

      <header className="flex items-start justify-between gap-4 flex-wrap py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[26px] font-bold text-tinta tracking-[-.02em] text-balance">
              {titulo}
            </h1>
            {insignia}
          </div>
          {subtitulo && <p className="text-[15px] text-tinta-2 mt-0.5">{subtitulo}</p>}
        </div>
        {acciones && <div className="flex items-center gap-2 shrink-0">{acciones}</div>}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">
        <div className="flex flex-col gap-4 min-w-0">{children}</div>
        {riel && <aside className="flex flex-col gap-4 min-w-0">{riel}</aside>}
      </div>

      {/* Solo cuando hay algo que decir. Fija abajo, que es donde está la mano
          después de editar — y no arriba, donde habría que volver a subir. */}
      {hayCambios && (
        <div className="fixed left-0 right-0 bottom-0 z-40 aparecer
                        bg-tinta text-white px-4 py-3
                        pb-[calc(env(safe-area-inset-bottom)+12px)]
                        shadow-[0_-4px_20px_rgba(22,24,44,.18)]">
          <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap">
            <p className="text-[15px] font-bold flex-1 min-w-0">Hay cambios sin guardar</p>
            <button
              onClick={onDescartar}
              disabled={guardando}
              className="min-h-[44px] px-4 rounded-xl text-[15px] font-bold text-white/80 hover:bg-white/10 disabled:opacity-50"
            >
              Descartar
            </button>
            <Button onClick={onGuardar} loading={guardando}>Guardar</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * «Dónde se usa»: lo que hay que saber ANTES de desactivar algo.
 *
 * Es la pieza que convierte un interruptor en una decisión informada. Hoy
 * desactivar un plan es un botón sin consecuencia visible; con esto, dice a
 * cuántas reservas les importa.
 */
export function DondeSeUsa({ titulo = 'Dónde se usa', lineas = [], cargando = false }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(22,24,44,.05)]">
      <h2 className="text-[12px] font-bold uppercase tracking-wider text-tinta-2 mb-2">
        {titulo}
      </h2>
      {cargando ? (
        <p className="text-[15px] text-tinta-2">Contando…</p>
      ) : !lineas.length ? (
        <p className="text-[15px] text-tinta-2">No lo usa nada todavía.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lineas.map(l => (
            <li key={l.etiqueta} className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] text-tinta-2">{l.etiqueta}</span>
              <span className="text-[17px] font-bold text-tinta tabular shrink-0">{l.valor}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
