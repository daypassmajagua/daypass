import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { classNames } from '../../lib/utils'
import BotonIcono from '../ui/BotonIcono'

/**
 * El panel lateral: un perfil que se abre al lado sin soltar la lista.
 *
 * ── La tesis ────────────────────────────────────────────────────────────────
 *
 * **Un perfil casi nunca es un destino: es una consulta.** Se abre para
 * responder algo —«¿esta señora ya vino?», «¿esta reserva tiene folio?»— y se
 * vuelve a lo que se estaba haciendo. Una página te saca de la lista y te
 * cobra el regreso; un panel la deja detrás, viva y en su sitio, y cerrar
 * cuesta un toque.
 *
 * ── Y sin embargo tiene dirección ───────────────────────────────────────────
 *
 * Esto no contradice lo que se decidió con la ficha del plan. Lo que se
 * descartó no fue el panel: fue **el modal sin dirección**, el que no se puede
 * compartir, ni recargar, ni ser el destino de una búsqueda. Este panel vive
 * en una URL —`/clientes/:id`— y ahí está la diferencia entera: la dirección
 * es lo que lo hace un sitio, el panel es lo que lo hace barato de abrir.
 *
 * Quien llega directo por la dirección ve la lista detrás igual, porque la
 * pantalla la carga de todos modos. No hay dos caminos.
 *
 * ── En el celular no hay «al lado» ──────────────────────────────────────────
 *
 * Por debajo de `lg` ocupa la pantalla completa. Un panel lateral de 480px en
 * un teléfono de 390 no es un panel: es una página con menos sitio y un velo
 * inútil encima. Es el mismo componente cambiando de forma, no dos.
 *
 * ── El teclado ──────────────────────────────────────────────────────────────
 *
 * El foco entra al panel al abrir y **vuelve exactamente a donde estaba** al
 * cerrar — a la fila que se tocó, no al principio de la lista. Es lo que hace
 * que se pueda recorrer una lista con el teclado abriendo y cerrando fichas.
 * Escape cierra; el velo también.
 */
export default function PanelLateral({
  titulo,
  subtitulo,
  insignia,
  acciones,
  onCerrar,
  children,
  ancho = 'lg:max-w-[30rem]',
}) {
  const panelRef = useRef(null)
  // Quién tenía el foco antes de abrir. Se guarda una vez y se devuelve al
  // cerrar: sin esto el foco se va al principio del documento y recorrer la
  // lista con el teclado se vuelve imposible.
  const veniaDe = useRef(null)

  useEffect(() => {
    veniaDe.current = document.activeElement
    panelRef.current?.focus()
    return () => {
      if (veniaDe.current instanceof HTMLElement) veniaDe.current.focus()
    }
  }, [])

  useEffect(() => {
    function alTeclado(e) {
      if (e.key === 'Escape') onCerrar?.()
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [onCerrar])

  return (
    <>
      {/* El velo es tenue a propósito: la lista de atrás sigue siendo
          información, no decoración. Sirve de blanco para cerrar. */}
      <div
        className="fixed inset-0 z-40 bg-tinta/25 lg:bg-tinta/15"
        onClick={onCerrar}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={classNames(
          'fixed z-50 inset-0 lg:inset-y-0 lg:left-auto lg:right-0 w-full',
          ancho,
          'bg-white flex flex-col shadow-[-12px_0_40px_rgba(22,24,44,.16)]',
          'entra-de-lado focus:outline-none'
        )}
      >
        <header className="shrink-0 flex items-start gap-3 px-5 pt-[calc(env(safe-area-inset-top)+18px)] pb-4 border-b border-linea">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[22px] font-bold text-tinta tracking-[-.02em] text-balance">
                {titulo}
              </h2>
              {insignia}
            </div>
            {subtitulo && <p className="text-[15px] text-tinta-2 mt-0.5">{subtitulo}</p>}
          </div>
          <BotonIcono onClick={onCerrar} etiqueta="Cerrar" className="-mr-2 -mt-1.5">
            <X size={20} />
          </BotonIcono>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          {children}
        </div>

        {acciones && (
          <div className="shrink-0 border-t border-linea px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex items-center gap-2 flex-wrap">
            {acciones}
          </div>
        )}
      </aside>
    </>
  )
}
