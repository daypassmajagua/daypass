import { useEffect, useState } from 'react'
import { Ticket, TriangleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { classNames, plural } from '../../lib/utils'
import Card from '../ui/Card'

/**
 * «Quedan 30 y mañana van 87.»
 *
 * Va en el cierre del día porque es el único momento en que todavía se puede
 * hacer algo: a las 7 de la noche se alcanza a comprar; a las 8 de la mañana,
 * con la gente en el muelle, no. Un día que arranca sin tiquetes es un día que
 * no zarpa.
 *
 * Cuando alcanza dice poco y en gris: la información que importa es cuando
 * **no** alcanza, y una alerta que grita todos los días deja de leerse.
 */
export default function AlertaTiquetes({ fecha }) {
  const [alerta, setAlerta] = useState(null)

  useEffect(() => {
    if (!fecha) return
    let vigente = true
    supabase.rpc('alerta_tiquetes', { p_fecha: fecha }).then(({ data }) => {
      if (vigente) setAlerta(data || null)
    })
    return () => { vigente = false }
  }, [fecha])

  // Sin datos —o sin saldo digitado todavía— no se dice nada. Un aviso de
  // "faltan 87" cuando el inventario nunca se cargó sería una falsa alarma
  // todos los días hasta que alguien lo apague y deje de mirarlo.
  if (!alerta) return null
  const saldos = alerta.saldos || {}
  const sinInventario = Object.values(saldos).every(v => !v)
  if (sinInventario && !alerta.necesita) return null

  const alcanza = alerta.alcanza
  const Icono = alcanza ? Ticket : TriangleAlert

  return (
    <Card className={classNames('p-5', !alcanza && 'ring-2 ring-coral-500')}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-tinta mb-3">
        <Icono size={18} className={alcanza ? 'text-blue-700' : 'text-coral-600'} />
        Tiquetes para mañana
      </h2>

      {sinInventario ? (
        <p className="text-[15px] text-tinta-2">
          Mañana van {plural(alerta.necesita, 'persona', 'personas')}, pero el
          inventario de tiquetes todavía no se ha cargado. Se digita una vez, en
          Configuración, y de ahí en adelante se lleva solo.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={classNames(
              'text-[28px] font-bold tabular',
              alcanza ? 'text-tinta' : 'text-coral-600'
            )}>
              {Object.entries(saldos).map(([t, n]) => `${n} de ${t}`).join(' · ')}
            </span>
            <span className="text-[15px] text-tinta-2">
              y mañana van {plural(alerta.necesita, 'persona', 'personas')}
            </span>
          </div>

          {!alcanza && (
            <p className="mt-3 text-sm font-bold text-coral-600 bg-coral-50 rounded-xl px-3 py-2">
              Faltan {alerta.faltan}. Cómpralos esta noche: mañana a las 8 ya no
              hay cómo.
            </p>
          )}
        </>
      )}
    </Card>
  )
}
