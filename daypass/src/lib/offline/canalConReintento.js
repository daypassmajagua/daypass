import { supabase } from '../supabase'

/**
 * Un canal de tiempo real que se vuelve a levantar solo.
 *
 * Sin esto, cuando el wifi parpadea el canal muere en silencio y la pantalla
 * se queda mostrando datos viejos sin que nadie se entere — que es peor que
 * mostrar un error. El reintento crece hasta 30 segundos para no castigar la
 * red cuando de verdad no hay señal.
 *
 * @param nombre     Tema del canal.
 * @param configurar (canal) => canal, donde se enganchan los .on(...)
 * @param alReconectar  Se llama cuando el canal vuelve: hay que recargar,
 *                      porque los cambios de mientras no llegaron.
 * @returns función para desmontar
 */
export function canalConReintento(nombre, configurar, alReconectar) {
  let canal = null
  let temporizador = null
  let intentos = 0
  let vivo = true
  let huboCaida = false

  function esperaDelIntento() {
    return Math.min(30_000, 1000 * 2 ** Math.min(intentos, 5))
  }

  function conectar() {
    if (!vivo) return
    canal = configurar(supabase.channel(nombre))

    canal.subscribe(estado => {
      if (!vivo) return

      if (estado === 'SUBSCRIBED') {
        intentos = 0
        // Al volver de una caída, lo que pasó mientras tanto no llegó por
        // el canal: hay que ir a buscarlo.
        if (huboCaida) { huboCaida = false; alReconectar?.() }
        return
      }

      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(estado)) {
        huboCaida = true
        reintentar()
      }
    })
  }

  function reintentar() {
    if (!vivo || temporizador) return
    const espera = esperaDelIntento()
    intentos++
    temporizador = setTimeout(() => {
      temporizador = null
      if (!vivo) return
      if (canal) { supabase.removeChannel(canal); canal = null }
      conectar()
    }, espera)
  }

  // Volver de segundo plano en el iPad suele matar el canal sin avisar.
  function alVolverAlFrente() {
    if (document.visibilityState === 'visible' && navigator.onLine && vivo) {
      huboCaida = true
      if (canal) { supabase.removeChannel(canal); canal = null }
      clearTimeout(temporizador); temporizador = null
      intentos = 0
      conectar()
    }
  }

  conectar()
  document.addEventListener('visibilitychange', alVolverAlFrente)
  window.addEventListener('online', alVolverAlFrente)

  return () => {
    vivo = false
    clearTimeout(temporizador)
    document.removeEventListener('visibilitychange', alVolverAlFrente)
    window.removeEventListener('online', alVolverAlFrente)
    if (canal) supabase.removeChannel(canal)
  }
}
