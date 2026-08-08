import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, MessageCircle, PhoneOff, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { classNames, formatDate, plural } from '../../lib/utils'

/**
 * Enviar la tarjeta de cada reserva por WhatsApp.
 *
 * El botón abre WhatsApp con el mensaje ya escrito: la asesora solo confirma
 * el envío. No se manda solo, a propósito — el WhatsApp es de ella y el
 * cliente responde por ahí.
 *
 * El estado es honesto: enviado, pendiente, o sin teléfono. Este último no es
 * un error del sistema sino un dato que falta, y hay que poder verlo.
 */

function soloDigitos(tel) {
  const limpio = (tel || '').replace(/\D/g, '')
  if (!limpio) return null
  // Colombia: si vienen 10 dígitos se antepone el indicativo.
  return limpio.length === 10 ? `57${limpio}` : limpio
}

function mensaje(reserva, url, fecha) {
  const quien = reserva.nombre_grupo || reserva.nombre_pasajero
  return `¡Hola ${quien}! 🌊\n\n` +
    `Tu Day Tour en el Hotel San Pedro de Majagua es el ${formatDate(fecha)}.\n\n` +
    `Aquí puedes registrar a quienes vienen, elegir el almuerzo y confirmar tu asistencia:\n${url}\n\n` +
    `Al terminar recibes tu pase para el muelle. ¡Nos vemos en las Islas del Rosario!`
}

export default function EnviarTarjetas({ fecha, registros, onCerrar }) {
  const [tokens, setTokens] = useState({})
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const vivas = registros.filter(r => !['cancelada', 'noshow'].includes(r.estado))
    if (!vivas.length) { setCargando(false); return }
    const { data } = await supabase
      .from('tokens_reserva')
      .select('*')
      .in('registro_id', vivas.map(r => r.id))
    const mapa = {}
    ;(data || []).forEach(t => { mapa[t.registro_id] = t })
    setTokens(mapa)
    setCargando(false)
  }, [registros])

  useEffect(() => { cargar() }, [cargar])

  const base = `${window.location.origin}/r/`

  async function marcarEnviado(registroId) {
    const { data: sesion } = await supabase.auth.getSession()
    await supabase.from('tokens_reserva').update({
      enviado_at: new Date().toISOString(),
      enviado_por: sesion?.session?.user?.id || null,
    }).eq('registro_id', registroId)
    await cargar()
  }

  function abrirWhatsApp(r) {
    const t = tokens[r.id]
    if (!t) return
    const tel = soloDigitos(r.telefono)
    const texto = encodeURIComponent(mensaje(r, base + t.token, fecha))
    window.open(
      tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`,
      '_blank'
    )
    marcarEnviado(r.id)
  }

  async function copiarLink(r) {
    const t = tokens[r.id]
    if (!t) return
    await navigator.clipboard.writeText(base + t.token)
    toast.success('Enlace copiado')
    marcarEnviado(r.id)
  }

  const vivas = registros.filter(r => !['cancelada', 'noshow'].includes(r.estado))
  const enviadas = vivas.filter(r => tokens[r.id]?.enviado_at).length
  const sinTelefono = vivas.filter(r => !soloDigitos(r.telefono)).length

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto overscroll-contain bg-white rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold text-tinta tracking-[-.01em]">Enviar las tarjetas</h2>
            <p className="text-sm text-tinta-2">
              {enviadas} de {vivas.length} enviadas
              {sinTelefono > 0 && ` · ${plural(sinTelefono, 'reserva sin teléfono', 'reservas sin teléfono')}`}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="icono-tactil w-11 h-11 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-fondo shrink-0"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>

        {cargando ? (
          <p className="text-tinta-2 py-6">Preparando los enlaces…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {vivas.map(r => {
              const t = tokens[r.id]
              const yaFue = Boolean(t?.enviado_at)
              const tel = soloDigitos(r.telefono)
              const abrio = (t?.veces_abierto || 0) > 0
              const hizoCheckIn = Boolean(r.check_in_at)

              return (
                <li key={r.id} className={classNames(
                  'flex items-center gap-3 rounded-xl px-4 py-3 flex-wrap',
                  hizoCheckIn ? 'bg-verde-50' : yaFue ? 'bg-fondo' : 'bg-white ring-1 ring-linea'
                )}>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-[15px] text-tinta truncate">
                      {r.nombre_grupo || r.nombre_pasajero}
                    </span>
                    <span className="block text-[13px] text-tinta-2">
                      {hizoCheckIn
                        ? 'Ya hizo su check-in'
                        : abrio
                          ? 'Abrió el enlace, sin terminar'
                          : yaFue
                            ? 'Enviada, sin abrir'
                            : tel ? 'Sin enviar' : 'Sin teléfono'}
                    </span>
                  </span>

                  {hizoCheckIn ? (
                    <Check size={20} className="text-verde-500 shrink-0" strokeWidth={3} />
                  ) : tel ? (
                    <button
                      onClick={() => abrirWhatsApp(r)}
                      className={classNames(
                        'shrink-0 inline-flex items-center gap-2 rounded-xl px-4 min-h-[44px] text-sm font-bold',
                        yaFue ? 'bg-white text-tinta-2 ring-1 ring-linea' : 'bg-verde-500 text-white'
                      )}
                    >
                      <MessageCircle size={16} />
                      {yaFue ? 'Reenviar' : 'WhatsApp'}
                    </button>
                  ) : (
                    <button
                      onClick={() => copiarLink(r)}
                      className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-coral-50 text-coral-700 px-4 min-h-[44px] text-sm font-bold"
                      title="Esta reserva no tiene teléfono: copia el enlace y mándalo por donde puedas"
                    >
                      <PhoneOff size={16} />
                      Copiar enlace
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-[13px] text-tinta-2">
          El enlace deja registrar los nombres, elegir almuerzo y firmar. Al terminar,
          el cliente recibe su pase con código para el muelle.
        </p>
      </div>
    </div>
  )
}
