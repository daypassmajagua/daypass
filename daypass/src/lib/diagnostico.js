/**
 * Lo que el sistema sabe de sí mismo cuando algo falla.
 *
 * Existe por una razón concreta: el reporte útil se escribe con la fila
 * esperando, con una mano, y en esa situación nadie va a contar en qué pantalla
 * estaba ni copiar un error de consola. Si el contexto no se captura solo, no
 * se captura (regla 23).
 *
 * Los errores se guardan en un anillo corto en memoria. **No se envía nada por
 * su cuenta**: solo viajan si alguien decide reportar, y viajan dentro de ese
 * reporte. Un registro de errores que se manda solo es telemetría, y eso no es
 * lo que se acordó.
 */

const MAX_ERRORES = 8

/** Anillo en memoria: se pierde al recargar, y está bien. */
const errores = []

function anotarError(origen, texto) {
  if (!texto) return
  errores.push({
    en: new Date().toISOString(),
    origen,
    // Un error largo no aporta más que su principio y llena la fila.
    texto: String(texto).slice(0, 500),
  })
  if (errores.length > MAX_ERRORES) errores.shift()
}

let instalado = false

/**
 * Engancha la escucha de errores. Se llama una vez, al arrancar la app.
 *
 * `console.error` se envuelve en vez de reemplazarse: lo que se imprimía se
 * sigue imprimiendo. Quitarle a alguien la consola para poder leerla sería un
 * mal negocio.
 */
export function escucharErrores() {
  if (instalado || typeof window === 'undefined') return
  instalado = true

  const original = console.error
  console.error = (...args) => {
    anotarError('console', args.map(a => a?.message || String(a)).join(' '))
    original.apply(console, args)
  }

  window.addEventListener('error', e => {
    anotarError('window', e?.error?.message || e?.message)
  })

  window.addEventListener('unhandledrejection', e => {
    anotarError('promesa', e?.reason?.message || String(e?.reason || ''))
  })
}

export function ultimosErrores() {
  return [...errores]
}

/** Qué aparato es este, en palabras y no en un user agent de 200 caracteres. */
function dispositivo() {
  const ua = navigator.userAgent
  if (/iPad/i.test(ua)) return 'iPad'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/Android/i.test(ua)) return 'Android'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  return 'Otro'
}

/**
 * El contexto completo de un reporte.
 *
 * Todo esto se captura; nada se pregunta. Lo que no se sepa va en null antes
 * que inventado: un contexto que miente es peor que uno incompleto.
 */
export function contextoActual({ modo, fechaActiva, enCola } = {}) {
  return {
    ruta: typeof location !== 'undefined' ? location.pathname : null,
    fecha_activa: fechaActiva || null,
    modo: modo || null,
    version: import.meta.env.MODE,
    dispositivo: dispositivo(),
    pantalla: typeof screen !== 'undefined' ? `${screen.width}×${screen.height}` : null,
    // Instalada en la pantalla de inicio o abierta en el navegador: cambia
    // cómo se comporta el iPad y es lo primero que uno pregunta.
    instalada: typeof matchMedia !== 'undefined'
      ? matchMedia('(display-mode: standalone)').matches
      : null,
    en_linea: typeof navigator !== 'undefined' ? navigator.onLine : null,
    eventos_en_cola: enCola ?? null,
    errores: ultimosErrores(),
  }
}
