import { Check } from 'lucide-react'
import { classNames, formatCurrency } from '../../lib/utils'

/**
 * El plan como tarjetas con el precio a la vista, no un desplegable.
 * Elegir plan es elegir precio: esconderlo obliga a elegir a ciegas y
 * después verificar.
 */
export default function TarjetasPlan({ planes, temporada, value, onChange, error }) {
  const precioDe = p => (temporada === 'alta' ? p.precio_adulto_alta : p.precio_adulto_baja)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-tinta">Plan</label>
        {error && <span className="text-xs text-coral-600 font-bold">{error}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {planes.map(p => {
          const elegido = p.id === value
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={classNames(
                'flex items-center justify-between gap-3 rounded-xl px-4 py-3 min-h-[64px] text-left transition-colors',
                elegido
                  ? 'bg-blue-600 text-white'
                  : classNames(
                      'bg-white ring-1 hover:ring-blue-300',
                      error ? 'ring-coral-300' : 'ring-linea'
                    )
              )}
            >
              <span className="min-w-0">
                <span className={classNames(
                  'block font-bold text-[15px] truncate',
                  elegido ? 'text-white' : 'text-tinta'
                )}>
                  {p.nombre}
                </span>
                <span className={classNames(
                  'block text-[13px]',
                  elegido ? 'text-white/75' : 'text-tinta-2'
                )}>
                  {p.incluye_transporte === false ? 'Sin transporte' : 'Con transporte'}
                </span>
              </span>

              <span className="shrink-0 flex items-center gap-2">
                <span className={classNames(
                  'font-bold tabular text-[15px] text-right',
                  elegido ? 'text-white'
                    : precioDe(p) > 0 ? 'text-tinta' : 'text-tinta-2 font-normal text-[13px]'
                )}>
                  {/* Un plan sin tarifa en esta temporada no vale $0: no aplica. */}
                  {precioDe(p) > 0 ? formatCurrency(precioDe(p)) : 'Sin tarifa'}
                </span>
                {elegido && <Check size={18} />}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-[13px] text-tinta-2">
        Precio por adulto en temporada {temporada === 'alta' ? 'alta' : 'baja'}. Lo puedes ajustar abajo.
      </p>
    </div>
  )
}
