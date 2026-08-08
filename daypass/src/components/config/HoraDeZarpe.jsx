import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'
import Card from '../ui/Card'

/**
 * La hora de zarpe: el único corte que le importa al cliente.
 *
 * Hasta esta hora el cliente puede registrar nombres, elegir almuerzo y
 * firmar desde su celular. Después ya está en la lancha, y lo que haya
 * quedado es lo que cocina ve cuando revisa los platos en la mañana.
 *
 * Antes esto lo decidía el cierre del día, que es de noche: quien abría su
 * enlace a las diez y cinco se encontraba la puerta cerrada.
 */
export default function HoraDeZarpe() {
  const [hora, setHora] = useState('')
  const [cocina, setCocina] = useState('')
  const [dias, setDias] = useState('')
  const [original, setOriginal] = useState({ hora: '', dias: '', cocina: '' })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('ajustes').select('clave, valor')
      .in('clave', ['checkin_cierra_hora', 'checkin_abre_dias', 'cocina_cierra_hora'])
      .then(({ data }) => {
        const mapa = {}
        ;(data || []).forEach(a => { mapa[a.clave] = a.valor })
        const h = (mapa.checkin_cierra_hora || '08:30').slice(0, 5)
        const d = mapa.checkin_abre_dias || '2'
        const c = (mapa.cocina_cierra_hora || h).slice(0, 5)
        setHora(h); setDias(d); setCocina(c)
        setOriginal({ hora: h, dias: d, cocina: c })
        setCargando(false)
      })
  }, [])

  const cambio = hora !== original.hora || dias !== original.dias || cocina !== original.cocina

  async function guardar() {
    setGuardando(true)
    const { data: sesion } = await supabase.auth.getSession()
    const quien = sesion?.session?.user?.id || null
    const cuando = new Date().toISOString()

    const escrituras = [
      supabase.from('ajustes')
        .update({ valor: hora, actualizado_at: cuando, actualizado_por: quien })
        .eq('clave', 'checkin_cierra_hora'),
      supabase.from('ajustes')
        .update({ valor: String(dias), actualizado_at: cuando, actualizado_por: quien })
        .eq('clave', 'checkin_abre_dias'),
      supabase.from('ajustes')
        .update({ valor: cocina, actualizado_at: cuando, actualizado_por: quien })
        .eq('clave', 'cocina_cierra_hora'),
    ]
    const errores = (await Promise.all(escrituras)).map(r => r.error).filter(Boolean)
    setGuardando(false)

    if (errores.length) { toast.error('No se pudo guardar. ' + errores[0].message); return }
    setOriginal({ hora, dias, cocina })
    toast.success(`El registro en línea cierra a las ${hora}`)
  }

  if (cargando) return null

  return (
    <Card className="p-5 mb-6 flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-tinta">
          <Clock size={18} className="text-blue-700" />
          Hasta cuándo puede el cliente hacer su check-in
        </h2>
        <p className="text-sm text-tinta-2 mt-1">
          El enlace deja de recibir cambios a esta hora del día del Day Tour, cuando
          zarpa la lancha. Cerrar el día ya no lo cierra: la gente hace su check-in
          de noche y esa es justo la hora en que se cerraba antes.
        </p>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-tinta">Hora de zarpe</span>
          <input
            type="time"
            value={hora}
            onChange={e => setHora(e.target.value)}
            className="rounded-xl border border-linea bg-white px-3.5 py-2.5 min-h-[44px] text-[16px] tabular focus:outline-none focus:border-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-tinta">Cocina cierra su lista</span>
          <input
            type="time"
            value={cocina}
            onChange={e => setCocina(e.target.value)}
            className="rounded-xl border border-linea bg-white px-3.5 py-2.5 min-h-[44px] text-[16px] tabular focus:outline-none focus:border-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-tinta">Almuerzo y firma se abren</span>
          <select
            value={dias}
            onChange={e => setDias(e.target.value)}
            className="rounded-xl border border-linea bg-white px-3.5 py-2.5 min-h-[44px] text-[16px] focus:outline-none focus:border-blue-600"
          >
            <option value="1">1 día antes</option>
            <option value="2">2 días antes</option>
            <option value="3">3 días antes</option>
            <option value="5">5 días antes</option>
            <option value="7">7 días antes</option>
          </select>
        </label>

        <Button onClick={guardar} loading={guardando} disabled={!cambio}>
          Guardar
        </Button>
      </div>

      <p className="text-[13px] text-tinta-2">
        Los nombres se reciben desde que existe la reserva, sin esperar esos días:
        un nombre cargado temprano es uno que nadie escribe en el muelle. La hora
        de cocina es la de siempre — para un día suelto se mueve desde la pantalla
        de Cocina, sin cambiar esta.
      </p>
    </Card>
  )
}
