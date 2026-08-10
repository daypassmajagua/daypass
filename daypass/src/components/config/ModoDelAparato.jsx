import { useState } from 'react'
import { Building2, Anchor, Palmtree, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useModo, MODOS } from '../../lib/modo'
import { classNames } from '../../lib/utils'
import Card from '../ui/Card'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

/**
 * En qué modo está ESTE aparato.
 *
 * El proveedor de modos existía desde la fase de diseño, pero no había forma
 * de cambiarlo: quedaba en oficina para siempre y por eso nunca se vio que la
 * app se adaptara. Esto es lo que faltaba.
 *
 * **Se marca por aparato, no por persona.** El iPad del muelle se configura
 * una vez y abre siempre así, sin importar quién inicie sesión; desde un
 * computador el modo muelle no tiene sentido. Por eso vive en el aparato y no
 * en el perfil: si viajara con la cuenta, Daniela abriría su computador en
 * modo muelle solo porque ayer estuvo en el muelle.
 *
 * Salir del modo muelle pide confirmación: ese iPad está configurado así a
 * propósito, y cambiarlo por curiosidad un martes a las 8 de la mañana deja la
 * pantalla del embarque con letra de oficina.
 */

const ICONOS = { oficina: Building2, muelle: Anchor, isla: Palmtree }

const COMO_SE_USA = {
  oficina: 'Sentada, con tiempo. Letra de 16 y el menú completo.',
  muelle: 'De pie, con una mano y a pleno sol. Letra de 18 y objetivos grandes.',
  isla: 'De paso y mirando de lejos. Letra de 20.',
}

export default function ModoDelAparato() {
  const modo = useModo()
  const [confirmando, setConfirmando] = useState(null)

  function elegir(id) {
    if (id === modo.id) return
    // Salir del muelle sí pregunta; entrar, no. Equivocarse entrando se ve al
    // instante; equivocarse saliendo se descubre con la fila esperando.
    if (modo.id === 'muelle') { setConfirmando(id); return }
    aplicar(id)
  }

  function aplicar(id) {
    modo.cambiar(id)
    setConfirmando(null)
    toast.success(`Este aparato queda en modo ${MODOS[id].nombre.toLowerCase()}`)
  }

  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-bold text-tinta mb-1">Modo de este aparato</h2>
      <p className="text-[13px] text-tinta-2 mb-4">
        Cambia el tamaño de todo según dónde se use. Se guarda en este aparato,
        no en tu cuenta: el iPad del muelle abre siempre en muelle, entre quien
        entre.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {Object.values(MODOS).map(m => {
          const Icono = ICONOS[m.id]
          const activo = m.id === modo.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => elegir(m.id)}
              aria-pressed={activo}
              className={classNames(
                'rounded-xl px-4 py-3.5 text-left ring-1 transition-colors',
                activo
                  ? 'bg-brand-900 text-white ring-brand-900'
                  : 'bg-fondo text-tinta ring-transparent hover:ring-linea'
              )}
            >
              <span className="flex items-center gap-2 font-bold text-[15px]">
                <Icono size={17} aria-hidden="true" />
                {m.nombre}
                {activo && <span className="ml-auto text-[12px] font-bold opacity-70">Ahora</span>}
              </span>
              <span className={classNames(
                'block text-[13px] mt-1',
                activo ? 'text-white/70' : 'text-tinta-2'
              )}>
                {COMO_SE_USA[m.id]}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-[13px] text-tinta-2 mt-3">
        En muelle e isla la app <b>nunca muestra dinero</b>. No es por permisos:
        esas pantallas las ven el pasajero, el guía y la fila entera.
      </p>

      <Modal
        open={Boolean(confirmando)}
        onClose={() => setConfirmando(null)}
        title="Sacar este aparato del modo muelle"
      >
        <div className="flex items-start gap-3 mb-4">
          <TriangleAlert size={20} className="text-coral-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[15px] text-tinta">
            Si este es el iPad del embarque, va a quedar con letra y objetivos de
            oficina — que a pleno sol y con una mano ocupada se usan mal.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setConfirmando(null)}>Dejarlo en muelle</Button>
          <Button variant="danger" onClick={() => aplicar(confirmando)}>
            Cambiar de todos modos
          </Button>
        </div>
      </Modal>
    </Card>
  )
}
