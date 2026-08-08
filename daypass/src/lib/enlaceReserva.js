import { supabase } from './supabase'
import { formatDate } from './utils'

/**
 * El enlace de la reserva y su mensaje.
 *
 * Vive aquí y no dentro de una pantalla porque se manda desde varios
 * lugares: al crear la reserva, desde el listado del día, y al cerrar.
 *
 * Ojo con el momento: el check-in se cierra cuando se cierra el día. Si el
 * enlace solo se mandara en el cierre, el cliente lo recibiría justo cuando
 * deja de servir. Por eso lo importante es mandarlo al crear la reserva.
 */

/** Colombia: si vienen 10 dígitos se antepone el indicativo. */
export function telefonoWhatsApp(tel) {
  const limpio = (tel || '').replace(/\D/g, '')
  if (!limpio) return null
  return limpio.length === 10 ? `57${limpio}` : limpio
}

export async function tokenDe(registroId) {
  const { data } = await supabase
    .from('tokens_reserva')
    .select('token')
    .eq('registro_id', registroId)
    .limit(1)
    .maybeSingle()
  return data?.token || null
}

export function enlaceDe(token) {
  return `${window.location.origin}/r/${token}`
}

/** Antes del cierre: invita a hacer el check-in. */
export function mensajeInvitacion(registro, url) {
  const quien = registro.nombre_grupo || registro.nombre_pasajero
  return `¡Hola ${quien}! 🌊\n\n` +
    `Tu Day Tour en el Hotel San Pedro de Majagua es el ${formatDate(registro.fecha)}.\n\n` +
    `Antes de venir necesitamos el nombre y el documento de cada persona: la Capitanía de Puerto lo exige para poder zarpar. ` +
    `Ahí mismo eliges el almuerzo y confirmas tu asistencia:\n${url}\n\n` +
    `Al terminar recibes tu pase para el muelle. ¡Nos vemos en las Islas del Rosario!`
}

/** Después del cierre: ya no hay check-in, se manda el pase. */
export function mensajeTarjeta(registro, url) {
  const quien = registro.nombre_grupo || registro.nombre_pasajero
  return `¡Hola ${quien}! 🌊\n\n` +
    `Todo listo para tu Day Tour del ${formatDate(registro.fecha)}.\n\n` +
    `Aquí está tu pase para presentar en el muelle:\n${url}\n\n` +
    `Te esperamos en el muelle de La Bodeguita. ¡Nos vemos!`
}

/**
 * Abre WhatsApp con el mensaje escrito y deja rastro del envío.
 * No se manda solo a propósito: el WhatsApp es de la coordinadora y el
 * cliente le responde por ahí.
 */
export async function abrirWhatsApp(registro, { cerrado = false } = {}) {
  const token = await tokenDe(registro.id)
  if (!token) return { error: { message: 'Esta reserva todavía no tiene enlace' } }

  const url = enlaceDe(token)
  const texto = cerrado ? mensajeTarjeta(registro, url) : mensajeInvitacion(registro, url)
  const tel = telefonoWhatsApp(registro.telefono)

  window.open(
    tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
        : `https://wa.me/?text=${encodeURIComponent(texto)}`,
    '_blank'
  )

  const { data: sesion } = await supabase.auth.getSession()
  await supabase.from('tokens_reserva').update({
    enviado_at: new Date().toISOString(),
    enviado_por: sesion?.session?.user?.id || null,
  }).eq('registro_id', registro.id)

  return { url, error: null }
}

/** Cuando no hay teléfono: copiar el enlace y mandarlo por donde se pueda. */
export async function copiarEnlace(registro) {
  const token = await tokenDe(registro.id)
  if (!token) return { error: { message: 'Esta reserva todavía no tiene enlace' } }
  const url = enlaceDe(token)
  await navigator.clipboard.writeText(url)

  const { data: sesion } = await supabase.auth.getSession()
  await supabase.from('tokens_reserva').update({
    enviado_at: new Date().toISOString(),
    enviado_por: sesion?.session?.user?.id || null,
  }).eq('registro_id', registro.id)

  return { url, error: null }
}
