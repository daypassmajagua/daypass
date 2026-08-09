import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { aFechaLocal, classNames, hoyLocal, diaRelativo } from '../../lib/utils'
import { ESTADO_DIA_LABELS } from '../../hooks/useDiaOperativo'
import DatePicker from '../ui/DatePicker'

/**
 * Hoy y Mañana como dos pestañas grandes — ahí vive el 95% del trabajo —
 * y un calendario para el resto.
 */

const ESTADO_TONO = {
  planeando:         'bg-blue-50 text-blue-700',
  tentativo_cerrado: 'bg-verde-50 text-verde-600',
  en_operacion:      'bg-brand-900 text-white',
  cerrado:           'bg-linea text-tinta-2',
}

function manana() {
  const [y, m, d] = hoyLocal().split('-').map(Number)
  return aFechaLocal(new Date(y, m - 1, d + 1))
}

export default function SelectorDia({ fecha, onChange, estadoManana }) {
  const [abriendoCalendario, setAbriendoCalendario] = useState(false)
  const { clave } = diaRelativo(fecha)
  const otroDia = clave !== 'hoy' && clave !== 'manana'

  const pestanas = [
    { clave: 'hoy', etiqueta: 'Hoy', valor: hoyLocal() },
    { clave: 'manana', etiqueta: 'Mañana', valor: manana() },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1.5 p-1.5 bg-white rounded-2xl shadow-[0_1px_2px_rgba(22,24,44,.05)]">
        {pestanas.map(p => {
          const activa = clave === p.clave
          return (
            <button
              key={p.clave}
              onClick={() => { onChange(p.valor); setAbriendoCalendario(false) }}
              className={classNames(
                'flex items-center gap-2 px-5 min-h-[44px] rounded-xl text-[15px] font-bold transition-colors',
                activa ? 'bg-blue-600 text-white' : 'text-tinta-2 hover:bg-blue-50 hover:text-blue-700'
              )}
            >
              {p.etiqueta}
              {p.clave === 'manana' && estadoManana && (
                <span className={classNames(
                  'px-2 py-0.5 rounded-lg text-[11px] font-bold',
                  activa ? 'bg-white/20 text-white' : ESTADO_TONO[estadoManana]
                )}>
                  {ESTADO_DIA_LABELS[estadoManana]}
                </span>
              )}
            </button>
          )
        })}

        <button
          onClick={() => setAbriendoCalendario(v => !v)}
          className={classNames(
            'flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-[15px] font-bold transition-colors',
            otroDia ? 'bg-blue-600 text-white' : 'text-tinta-2 hover:bg-blue-50 hover:text-blue-700'
          )}
          aria-label="Elegir otra fecha"
        >
          <CalendarDays size={18} />
          <span className="hidden sm:inline">Otro día</span>
        </button>
      </div>

      {(abriendoCalendario || otroDia) && (
        <DatePicker value={fecha} onChange={onChange} className="w-52" />
      )}
    </div>
  )
}
