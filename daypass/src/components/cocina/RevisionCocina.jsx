import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChefHat, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { classNames, hora12, plural } from '../../lib/utils'
import Button from '../ui/Button'

/**
 * Con qué número preparó cocina.
 *
 * El almuerzo lo comanda el mesero en la mesa, así que lo que el cliente eligió
 * en su check-in es un pronóstico: sirve para preparar, no para obligar. Por
 * eso ya no se congela a ninguna hora — un cliente que elige a las nueve suma
 * información, y cerrarle la puerta solo hacía el pronóstico peor.
 *
 * Pero el mesero llega a la mesa a comandar y necesita saber si lo que cocina
 * tiene enfrente se parece a lo que va a pedir la gente. Eso es lo que se
 * marca aquí: quien le lleva el número lo deja anotado, con la hora y con el
 * conteo de ese instante, y desde entonces la pantalla dice cuánto se movió.
 *
 * No se puede deducir de las marcas de tiempo de la base: el check-in borra y
 * reinserta la lista completa, así que todos los pasajeros de una reserva
 * dicen "modificado ahora" en cuanto alguien la toca. Por eso es un hecho que
 * alguien registra, no un cálculo.
 */
export default function RevisionCocina({ fecha, cocina, onCambio }) {
  const [revision, setRevision] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [marcando, setMarcando] = useState(false)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('revision_cocina', { p_fecha: fecha })
    // Sin la migración 013 corrida no hay nada que mostrar: callarse es mejor
    // que inventar que nadie ha revisado.
    if (error) { setRevision(undefined); setCargando(false); return }
    setRevision(data || null)
    setCargando(false)
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  async function marcar() {
    setMarcando(true)
    const { error } = await supabase.rpc('marcar_revision_cocina', {
      p_fecha: fecha,
      p_conteo: {
        almuerzos: cocina.totalAlmuerzos,
        sin_elegir: cocina.sinElegir,
        restricciones: cocina.restricciones.length,
      },
    })
    setMarcando(false)
    if (error) { toast.error('No se pudo marcar. ' + error.message); return }
    await cargar()
    onCambio?.()
    toast.success('Anotado: cocina tiene este número')
  }

  if (cargando || revision === undefined) return null

  const cuando = revision?.revisado_at
  const anterior = revision?.conteo?.almuerzos
  const movio = typeof anterior === 'number' ? cocina.totalAlmuerzos - anterior : 0

  return (
    <div className={classNames(
      'rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-3',
      cuando ? 'bg-white shadow-[0_1px_2px_rgba(22,24,44,.05)]' : 'bg-[#fff4d6]'
    )}>
      {cuando
        ? <Check size={20} className="text-verde-500 shrink-0" strokeWidth={3} />
        : <ChefHat size={20} className="text-[#6b4d05] shrink-0" />}

      <div className="min-w-0 flex-1">
        {cuando ? (
          <>
            <p className="text-[15px] font-bold text-tinta">
              Cocina tiene {plural(anterior ?? 0, 'almuerzo', 'almuerzos')} desde
              las {hora12(cuando)}
              {revision.revisado_por ? `, por ${revision.revisado_por}` : ''}
            </p>
            <p className={classNames(
              'text-[13px]',
              movio !== 0 ? 'font-bold text-coral-700' : 'text-tinta-2'
            )}>
              {movio === 0
                ? 'No se ha movido desde entonces.'
                : movio > 0
                  ? `Desde entonces subió a ${cocina.totalAlmuerzos}: ${movio} más que no alcanzaron a ver.`
                  : `Desde entonces bajó a ${cocina.totalAlmuerzos}: ${Math.abs(movio)} menos.`}
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-bold text-[#6b4d05]">
              Cocina todavía no tiene este número
            </p>
            <p className="text-[13px] text-[#6b4d05]/80">
              Márcalo al pasárselo. Después, esta pantalla dice cuánto se movió
              desde entonces — que es lo que el mesero necesita saber antes de
              comandar.
            </p>
          </>
        )}
      </div>

      <Button
        size="sm"
        variant={cuando ? 'secondary' : 'primary'}
        loading={marcando}
        onClick={marcar}
      >
        {cuando ? 'Volver a pasárselo' : 'Ya se lo pasé'}
      </Button>
    </div>
  )
}
