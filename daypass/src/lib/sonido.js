/**
 * El canal que funciona cuando no se puede mirar.
 *
 * En el muelle, a las 8:20, la persona tiene el iPad en una mano, el sol de
 * frente y un guía hablándole al oído. El color confirma —y es el canal
 * principal— pero hay momentos en que ni siquiera hay visión periférica
 * disponible. Para eso es esto.
 *
 * ── Por qué sintetizado y no archivos ───────────────────────────────────────
 *
 * Dos osciladores y tres patrones pesan cero bytes y funcionan sin señal. Un
 * archivo .mp3 en el muelle sería un archivo que el service worker tiene que
 * cachear, que la actualización vuelve a bajar, y que puede fallar justo el día
 * que no hay red. Esto no puede fallar por red porque no viaja por red.
 *
 * ── Por qué hay que desbloquearlo ───────────────────────────────────────────
 *
 * En iOS el audio nace suspendido hasta que la persona toca algo. No es un
 * capricho de Safari: es lo que evita que las páginas suenen solas. Se
 * desbloquea con un gesto que ya existe —abrir el lector, tocar una fila— y no
 * con uno inventado para el permiso.
 *
 * ── El silencio se respeta y se recuerda ────────────────────────────────────
 *
 * Hay muelles ruidosos donde esto no se va a oír, y hay madrugadas en la
 * oficina. El interruptor vive en el aparato, como el modo: el iPad del muelle
 * decide por sí mismo, no por quién inició sesión.
 *
 * **Nada de esto es obligatorio.** Si el navegador no trae WebAudio, si el
 * contexto no arranca o si algo falla, todas las funciones no hacen nada y la
 * app sigue igual. El sonido acompaña al color; nunca lo reemplaza.
 */

const CLAVE_SILENCIO = 'daypass:silencio'

/** Los cuatro avisos, con su forma. Frecuencia en Hz, duración en ms. */
export const TONOS = {
  // Un pase válido. Agudo y corto: se oye por encima del ruido del muelle sin
  // sonar a alarma.
  ok: [{ hz: 880, ms: 80 }],

  // Ya había subido. Dos toques medios: informa, no regaña — es distinto de un
  // error y tiene que sonar distinto.
  repetido: [{ hz: 620, ms: 60 }, { hz: 620, ms: 60, desde: 130 }],

  // No es de hoy, o no se encontró. Grave y largo: la única señal que pide
  // que alguien mire la pantalla.
  error: [{ hz: 220, ms: 300 }],

  // La confirmación de cada toque en el muelle. Casi imperceptible a
  // propósito: se va a oír cuarenta veces en noventa segundos.
  tic: [{ hz: 1200, ms: 30, volumen: 0.12 }],
}

let contexto = null
let silenciado = leerSilencio()

function leerSilencio() {
  try {
    return localStorage.getItem(CLAVE_SILENCIO) === 'si'
  } catch {
    return false   // Safari en privado
  }
}

export function estaSilenciado() {
  return silenciado
}

export function alternarSilencio() {
  silenciado = !silenciado
  try { localStorage.setItem(CLAVE_SILENCIO, silenciado ? 'si' : 'no') }
  catch { /* sin persistencia, pero el silencio de esta sesión vale */ }
  return silenciado
}

/**
 * Arranca el audio. Se llama desde un gesto de la persona —abrir el lector—
 * porque fuera de un gesto iOS lo deja suspendido.
 */
export function desbloquearSonido() {
  if (contexto) {
    // Un contexto que quedó suspendido —la pestaña estuvo en segundo plano—
    // se reanuda sin volver a crearlo.
    if (contexto.state === 'suspended') contexto.resume().catch(() => {})
    return
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    contexto = new Ctx()
  } catch { contexto = null }
}

/**
 * Suena uno de los avisos. No hace nada si está silenciado, si el audio nunca
 * se desbloqueó o si el navegador no puede.
 */
export function tocar(tipo) {
  if (silenciado || !contexto) return
  const partes = TONOS[tipo]
  if (!partes) return

  try {
    if (contexto.state === 'suspended') contexto.resume().catch(() => {})
    const ahora = contexto.currentTime

    partes.forEach(({ hz, ms, desde = 0, volumen = 0.3 }) => {
      const osc = contexto.createOscillator()
      const gan = contexto.createGain()

      // Onda triangular: más suave que la cuadrada, que a este volumen suena a
      // alarma de electrodoméstico.
      osc.type = 'triangle'
      osc.frequency.value = hz

      const t0 = ahora + desde / 1000
      const t1 = t0 + ms / 1000

      // La rampa importa: un tono que arranca y para en seco produce un chasquido
      // que se oye más que el tono.
      gan.gain.setValueAtTime(0, t0)
      gan.gain.linearRampToValueAtTime(volumen, t0 + 0.008)
      gan.gain.setValueAtTime(volumen, t1 - 0.02)
      gan.gain.linearRampToValueAtTime(0, t1)

      osc.connect(gan).connect(contexto.destination)
      osc.start(t0)
      osc.stop(t1 + 0.01)
    })
  } catch { /* el sonido nunca detiene la operación */ }
}
