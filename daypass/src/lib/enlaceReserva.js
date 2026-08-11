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

/**
 * ── Los textos viven en la base, no aquí ────────────────────────────────────
 *
 * Estos dos mensajes estaban escritos en este archivo, con el nombre del hotel
 * y el del muelle adentro. Es lo que la regla 22 prohíbe, y no por purismo:
 * cambiarle una coma al mensaje que se le manda a sesenta clientes al mes era
 * una tarea de programación y un despliegue.
 *
 * Desde la 031 son ajustes que edita quien los usa. Lo de abajo es **el
 * respaldo**, palabra por palabra el mismo texto: si el ajuste no existe
 * todavía —o alguien lo deja vacío— el cliente recibe esto y no un mensaje en
 * blanco, que sería mucho peor que uno viejo.
 */
export const PLANTILLA_RESPALDO = {
  mensaje_invitacion:
    '¡Hola {nombre}! 🌊\n\n' +
    'Tu Day Tour en el Hotel San Pedro de Majagua es el {fecha}.\n\n' +
    'Antes de venir necesitamos el nombre y el documento de cada persona: la Capitanía de Puerto lo exige para poder zarpar. ' +
    'Ahí mismo eliges el almuerzo y confirmas tu asistencia:\n{enlace}\n\n' +
    'Al terminar recibes tu pase para el muelle. ¡Nos vemos en las Islas del Rosario!',

  mensaje_pase:
    '¡Hola {nombre}! 🌊\n\n' +
    'Todo listo para tu Day Tour del {fecha}.\n\n' +
    'Aquí está tu pase para presentar en el muelle:\n{enlace}\n\n' +
    'Te esperamos en el muelle de La Bodeguita. ¡Nos vemos!',
}

/** Las marcas que la plantilla puede usar. La pantalla las muestra al editar. */
export const MARCAS = [
  { marca: '{nombre}', que: 'el titular, o el nombre del grupo' },
  { marca: '{fecha}', que: 'la fecha del pasadía, en palabras' },
  { marca: '{enlace}', que: 'la dirección del check-in o del pase' },
]

/** Reemplaza las marcas. Lo que no reconoce lo deja como está, a la vista. */
export function llenarPlantilla(plantilla, { nombre, fecha, enlace }) {
  return String(plantilla || '')
    .replaceAll('{nombre}', nombre ?? '')
    .replaceAll('{fecha}', fecha ?? '')
    .replaceAll('{enlace}', enlace ?? '')
}

/** Trae la plantilla de la base, con el respaldo si no está o está vacía. */
export async function plantillaDe(clave) {
  const { data } = await supabase.from('ajustes').select('valor').eq('clave', clave).maybeSingle()
  const valor = (data?.valor || '').trim()
  return valor || PLANTILLA_RESPALDO[clave] || ''
}

/** Antes del cierre: invita a hacer el check-in. */
export async function mensajeInvitacion(registro, url) {
  return llenarPlantilla(await plantillaDe('mensaje_invitacion'), {
    nombre: registro.nombre_grupo || registro.nombre_pasajero,
    fecha: formatDate(registro.fecha),
    enlace: url,
  })
}

/** Después del cierre: ya no hay check-in, se manda el pase. */
export async function mensajeTarjeta(registro, url) {
  return llenarPlantilla(await plantillaDe('mensaje_pase'), {
    nombre: registro.nombre_grupo || registro.nombre_pasajero,
    fecha: formatDate(registro.fecha),
    enlace: url,
  })
}

/**
 * Abre WhatsApp con el mensaje escrito y deja rastro del envío.
 * No se manda solo a propósito: el WhatsApp es de la coordinadora y el
 * cliente le responde por ahí.
 */
export async function abrirWhatsApp(registro, { cerrado = false } = {}) {
  // La ventana se abre YA, antes de cualquier await. Safari en iPad —el
  // aparato de la asesora— cuenta window.open como emergente y lo bloquea si
  // no sale del toque del dedo, y buscar el token de por medio rompe esa
  // cadena. Se abre vacía y después se le pone la dirección.
  const ventana = window.open('', '_blank')

  const token = await tokenDe(registro.id)
  if (!token) {
    ventana?.close()
    return { error: { message: 'Esta reserva todavía no tiene enlace' } }
  }

  const url = enlaceDe(token)
  const texto = cerrado
    ? await mensajeTarjeta(registro, url)
    : await mensajeInvitacion(registro, url)
  const tel = telefonoWhatsApp(registro.telefono)
  const destino = tel
    ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`

  if (ventana) ventana.location.href = destino
  else window.open(destino, '_blank')   // si igual la bloquearon, se reintenta

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
