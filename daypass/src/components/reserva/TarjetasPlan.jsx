import { formatCurrency } from '../../lib/utils'
import TarjetaOpcion from '../ui/TarjetaOpcion'

/**
 * El plan como tarjetas con el precio a la vista, no un desplegable.
 * Elegir plan es elegir precio: esconderlo obliga a elegir a ciegas y
 * después verificar.
 *
 * La tarjeta en sí es `ui/TarjetaOpcion` — el mismo gesto que elegir el modo
 * del aparato o activar un plan desde su ficha. Lo que vive aquí es lo único
 * propio del plan: de qué precio se habla según la temporada.
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
        {planes.map(p => (
          <TarjetaOpcion
            key={p.id}
            titulo={p.nombre}
            detalle={p.incluye_transporte === false ? 'Sin transporte' : 'Con transporte'}
            // Un plan sin tarifa en esta temporada no vale $0: no aplica.
            secundario={precioDe(p) > 0 ? formatCurrency(precioDe(p)) : 'Sin tarifa'}
            elegida={p.id === value}
            error={Boolean(error)}
            onClick={() => onChange(p.id)}
          />
        ))}
      </div>

      <p className="text-[13px] text-tinta-2">
        Precio por adulto en temporada {temporada === 'alta' ? 'alta' : 'baja'}. Lo puedes ajustar abajo.
      </p>
    </div>
  )
}
