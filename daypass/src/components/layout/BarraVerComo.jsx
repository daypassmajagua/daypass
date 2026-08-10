import { Eye, X } from 'lucide-react'
import { usePerfil } from '../../hooks/usePerfil'
import { verComo, PUEDE_VER_COMO } from '../../lib/verComo'
import { ETIQUETA_ROL, ROLES } from '../../lib/navegacion'
import Select from '../ui/Select'

/**
 * La barra de "estás mirando como otra persona".
 *
 * Va arriba de todo y no se puede ignorar a propósito: alguien que olvide que
 * está mirando como mesero va a creer que la app se le dañó. Y dice de frente
 * lo que esta herramienta **no** hace, que es lo más importante de todo el
 * componente — los permisos siguen siendo los suyos, y por eso va a seguir
 * viendo precios donde el mesero no los vería.
 */
export default function BarraVerComo() {
  const { rolReal, mirandoComo, puedeMirar } = usePerfil()
  if (!puedeMirar) return null

  const opciones = ROLES
    .filter(r => r !== rolReal)
    .map(r => ({ value: r, label: ETIQUETA_ROL[r] || r }))

  if (!mirandoComo) {
    // Sin mirada activa: un control discreto, no una barra. Esto se usa de vez
    // en cuando y no tiene por qué ocupar espacio todos los días.
    return (
      <div className="bg-fondo border-b border-linea px-4 py-1.5 flex items-center gap-2 justify-end">
        <Eye size={14} className="text-tinta-2 shrink-0" aria-hidden="true" />
        <span className="text-[13px] text-tinta-2">Ver la app como</span>
        <Select
          size="sm"
          value=""
          onChange={verComo}
          placeholder="— Elegir rol —"
          options={opciones}
          align="right"
          className="w-52"
        />
      </div>
    )
  }

  return (
    <div className="bg-arena-500 text-brand-950 px-4 py-2 flex items-center gap-3 flex-wrap sticky top-0 z-50">
      <Eye size={16} className="shrink-0" aria-hidden="true" />
      <p className="text-[14px] font-bold">
        Estás viendo la app como {ETIQUETA_ROL[mirandoComo] || mirandoComo}
      </p>
      <p className="text-[13px] opacity-80 min-w-0">
        Solo cambia el menú y a dónde entras. Los permisos siguen siendo los
        tuyos, así que el dinero se sigue viendo.
      </p>
      <button
        onClick={() => verComo(null)}
        className="ml-auto flex items-center gap-1.5 text-[14px] font-bold rounded-lg px-3 min-h-[36px] hover:bg-black/10"
      >
        <X size={16} />
        Volver a lo mío
      </button>
    </div>
  )
}

export { PUEDE_VER_COMO }
