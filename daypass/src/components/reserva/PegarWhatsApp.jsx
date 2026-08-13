import { useMemo, useState } from 'react'
import { ClipboardPaste, Wand2, X } from 'lucide-react'
import { parseReserva } from '../../lib/parseReserva'
import { hoyLocal, formatDate, plural } from '../../lib/utils'
import Button from '../ui/Button'
import BotonIcono from '../ui/BotonIcono'

/**
 * Pegar el WhatsApp de la agencia y que el formulario se llene solo.
 *
 * El grueso de las reservas entra así —«Para mañana 4 pax Gold, a nombre de
 * Rafael. Aviatur»— y hoy se digita campo por campo. Pegar y revisar es el
 * mismo trabajo hecho una vez.
 *
 * ── Se ve antes de aplicarse ────────────────────────────────────────────────
 *
 * La vista previa no es un adorno: es la diferencia entre una ayuda y una
 * caja negra. Quien pega ve exactamente qué entendió el sistema **antes** de
 * que toque el formulario, y lo que no entendió sencillamente no aparece.
 * Nada se guarda: se propone.
 */
export default function PegarWhatsApp({ planes, agencias, onAplicar }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')

  const { campos, origen } = useMemo(
    () => (texto.trim()
      ? parseReserva(texto, { hoy: hoyLocal(), planes, agencias })
      : { campos: {}, origen: {} }),
    [texto, planes, agencias]
  )

  const entendido = Object.keys(campos).length > 0

  function aplicar() {
    onAplicar(campos, origen)
    setTexto('')
    setAbierto(false)
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 self-start rounded-xl bg-blue-50 text-blue-700 px-4 min-h-[44px] text-sm font-bold hover:bg-blue-100 transition-colors"
      >
        <ClipboardPaste size={16} />
        Pegar el WhatsApp de la agencia
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-tinta">Pega el mensaje tal como llegó</p>
          <p className="text-[13px] text-tinta-2">
            No hay que limpiarlo ni ordenarlo. Lo que se entienda se propone; lo demás se deja.
          </p>
        </div>
        <BotonIcono onClick={() => setAbierto(false)} etiqueta="Cerrar">
          <X size={18} />
        </BotonIcono>
      </div>

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        autoFocus
        rows={4}
        placeholder={'Buenas! Para mañana 4 pax Gold, a nombre de Rafael Gómez. Aviatur'}
        aria-label="El mensaje de la agencia"
        className="w-full rounded-xl border border-linea bg-white px-3 py-2.5 text-[15px] text-tinta placeholder-tinta-3 focus:outline-none focus:border-blue-600"
      />

      {texto.trim() && (
        entendido ? (
          <div className="rounded-xl bg-white px-4 py-3 flex flex-col gap-1.5">
            <p className="text-[12px] font-bold uppercase tracking-wider text-tinta-2">
              Esto es lo que entendí
            </p>
            <ul className="text-[15px] text-tinta flex flex-col gap-0.5">
              {origen.fecha && <Linea que="Cuándo" valor={`${formatDate(campos.fecha)} (${origen.fecha})`} />}
              {origen.pax && <Linea que="Cuántos" valor={origen.pax} />}
              {origen.plan && <Linea que="Plan" valor={origen.plan} />}
              {origen.agencia && <Linea que="Agencia" valor={origen.agencia} />}
              {origen.nombre && <Linea que="A nombre de" valor={origen.nombre} />}
              {origen.tipo && <Linea que="Tipo" valor="Grupo" />}
            </ul>
          </div>
        ) : (
          <p className="text-[15px] text-tinta-2 bg-white rounded-xl px-4 py-3">
            De este mensaje no pude sacar nada en limpio. Llénalo a mano — es lo mismo
            que hacías antes, no se perdió nada.
          </p>
        )
      )}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={aplicar} disabled={!entendido}>
          <Wand2 size={16} />
          Llenar el formulario
        </Button>
        {entendido && (
          <span className="text-[13px] text-tinta-2">
            {plural(Object.keys(origen).length, 'dato', 'datos')} · todo editable después
          </span>
        )}
      </div>
    </div>
  )
}

function Linea({ que, valor }) {
  return (
    <li className="flex gap-2">
      <span className="text-tinta-2 w-28 shrink-0">{que}</span>
      <span className="font-bold">{valor}</span>
    </li>
  )
}
