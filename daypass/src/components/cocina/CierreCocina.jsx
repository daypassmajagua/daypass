import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Lock, RotateCcw, Unlock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { classNames } from '../../lib/utils'
import Button from '../ui/Button'

/**
 * Hasta cuándo recibe cocina cambios de almuerzo, ese día.
 *
 * Por defecto es la hora de zarpe: cuando la gente sube a la lancha ya no
 * puede cambiar nada. Pero un día concreto no siempre se parece a la regla —la
 * lancha se atrasa, o cocina pide el número temprano porque el grupo es
 * grande—, así que la coordinadora lo mueve aquí sin tocar la configuración
 * general: cambiar el martes no puede cambiar todos los martes.
 *
 * Mover esto NO toca los nombres ni la firma. Esos llegan hasta que zarpa la
 * lancha pase lo que pase: un nombre no mueve ningún número y la Capitanía los
 * pide todos.
 */

/** La hora de Cartagena, aunque el aparato esté puesto en otra zona. */
function horaEnBogota() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date())
}

function enPalabras(hhmm) {
  const [h, m] = (hhmm || '').split(':').map(Number)
  if (Number.isNaN(h)) return '—'
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`
}

export default function CierreCocina({ fecha, onCambio }) {
  const [estado, setEstado] = useState(null)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const [{ data: hora }, { data: abierta }, { data: dia }] = await Promise.all([
      supabase.rpc('hora_cierre_cocina', { p_fecha: fecha }),
      supabase.rpc('cocina_abierta', { p_fecha: fecha }),
      supabase.from('dias_operativos')
        .select('cocina_cierra_a, cocina_cierra_por_nombre')
        .eq('fecha', fecha).maybeSingle(),
    ])
    // Sin hora no hay migración 010 corrida. Callarse es mejor que decir
    // "cerrado" por defecto: cocina se pondría a cocinar con un número que
    // todavía se está moviendo.
    if (!hora) { setEstado(null); return }

    setEstado({
      hora: hora.slice(0, 5),
      abierta: Boolean(abierta),
      esExcepcion: Boolean(dia?.cocina_cierra_a),
      quien: dia?.cocina_cierra_por_nombre || null,
    })
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  async function fijar(hora) {
    setGuardando(true)
    const { error } = await supabase.rpc('fijar_cierre_cocina', {
      p_fecha: fecha, p_hora: hora,
    })
    setGuardando(false)
    if (error) { toast.error('No se pudo cambiar la hora. ' + error.message); return }
    setEditando(false)
    await cargar()
    onCambio?.()
    toast.success(
      hora ? `Cocina recibe cambios hasta las ${enPalabras(hora)}`
           : 'Vuelve a la hora de siempre'
    )
  }

  if (!estado) return null

  return (
    <div className={classNames(
      'rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-3',
      estado.abierta ? 'bg-white shadow-[0_1px_2px_rgba(22,24,44,.05)]' : 'bg-fondo'
    )}>
      {estado.abierta
        ? <Unlock size={20} className="text-verde-500 shrink-0" />
        : <Lock size={20} className="text-tinta-2 shrink-0" />}

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-tinta">
          {estado.abierta
            ? `Recibe cambios de almuerzo hasta las ${enPalabras(estado.hora)}`
            : `Cerrado desde las ${enPalabras(estado.hora)} — este número ya no se mueve`}
        </p>
        <p className="text-[13px] text-tinta-2">
          {estado.esExcepcion
            ? `Hora puesta a mano para este día${estado.quien ? ` por ${estado.quien}` : ''}`
            : 'La hora de siempre'}
          {' · '}
          Los nombres y la firma siguen llegando hasta que zarpa la lancha.
        </p>
      </div>

      {editando ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="time"
            value={borrador}
            onChange={e => setBorrador(e.target.value)}
            className="rounded-xl border border-linea bg-white px-3 py-2 min-h-[44px] text-[16px] tabular focus:outline-none focus:border-blue-600"
          />
          <Button size="sm" loading={guardando} onClick={() => fijar(borrador)}>
            Guardar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {estado.esExcepcion && (
            <Button
              size="sm"
              variant="ghost"
              loading={guardando}
              onClick={() => fijar(null)}
              title="Devolver este día a la hora configurada"
            >
              <RotateCcw size={14} />
              La de siempre
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setBorrador(estado.hora); setEditando(true) }}
          >
            Cambiar la hora
          </Button>
          {estado.abierta && (
            <Button size="sm" loading={guardando} onClick={() => fijar(horaEnBogota())}>
              <Lock size={14} />
              Cerrar ahora
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
