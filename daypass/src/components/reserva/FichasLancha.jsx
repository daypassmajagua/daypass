import { Check } from 'lucide-react'
import { classNames } from '../../lib/utils'

/**
 * La lancha con su ocupación dibujada: "MAJ 1 — 32/40".
 *
 * Asignar lancha es repartir cupo. Si va llena tiene que verse antes de
 * elegirla, no después de guardar. Elegir una llena no se bloquea —a veces
 * hay que sobrevender a propósito y ya se sabe— pero se avisa.
 */
export default function FichasLancha({ lanchas, ocupacion, value, onChange, paxNuevos = 0, error }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-tinta">Lancha</label>
        {error && <span className="text-xs text-coral-600 font-bold">{error}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {lanchas.map(l => {
          const usados = ocupacion[l.id] || 0
          const cupo = l.capacidad || 0
          // La reserva que se está creando no cuenta dos veces al editarla.
          const conEsta = usados + (l.id === value ? 0 : paxNuevos)
          const pct = cupo ? Math.min(100, Math.round((conEsta / cupo) * 100)) : 0
          const llena = cupo > 0 && conEsta > cupo
          const justa = cupo > 0 && !llena && conEsta === cupo
          const elegida = l.id === value

          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange(l.id)}
              className={classNames(
                'flex flex-col gap-2 rounded-xl px-3.5 py-3 min-h-[76px] text-left transition-colors',
                elegida
                  ? 'bg-blue-600 text-white'
                  : classNames('bg-white ring-1 hover:ring-blue-300', error ? 'ring-coral-300' : 'ring-linea')
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={classNames(
                  'font-bold text-[15px] truncate',
                  elegida ? 'text-white' : 'text-tinta'
                )}>
                  {l.nombre}
                </span>
                {elegida && <Check size={16} className="shrink-0" />}
              </span>

              <span className="flex flex-col gap-1">
                <span className={classNames(
                  'text-[13px] font-bold tabular',
                  elegida ? 'text-white/85'
                    : llena ? 'text-peligro-500'
                    : justa ? 'text-coral-600'
                    : 'text-tinta-2'
                )}>
                  {cupo ? `${usados}/${cupo} pax` : `${usados} pax`}
                  {llena && ' · sobrecupo'}
                  {justa && ' · llena'}
                </span>

                {cupo > 0 && (
                  <span className={classNames(
                    'h-1.5 rounded-full overflow-hidden',
                    elegida ? 'bg-white/25' : 'bg-fondo'
                  )}>
                    <span
                      className={classNames(
                        'block h-full rounded-full',
                        elegida ? 'bg-white'
                          : llena || justa ? 'bg-coral-500'
                          : 'bg-blue-600'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
