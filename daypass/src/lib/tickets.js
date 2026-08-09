import { supabase } from './supabase'
import { encolar, contarPendientes } from './offline/cola'
import { contextoActual } from './diagnostico'

/**
 * Reportar algo que no funciona, desde donde sea y con o sin señal.
 *
 * Los tres tipos son los que de verdad se distinguen en la operación. Más
 * opciones no darían más información: darían una pausa mientras alguien decide
 * en cuál encaja lo suyo.
 */
export const TIPOS_TICKET = [
  { valor: 'no_funciona', etiqueta: 'No funciona', detalle: 'Se rompió o no hace lo que debería' },
  { valor: 'se_ve_mal',   etiqueta: 'Se ve mal',   detalle: 'Se entiende mal, se sale, no se lee' },
  { valor: 'idea',        etiqueta: 'Idea',        detalle: 'Algo que ayudaría' },
]

export const ETIQUETA_ESTADO_TICKET = {
  nuevo:    'Enviado',
  visto:    'Visto',
  en_curso: 'En eso',
  resuelto: 'Resuelto',
  no_va:    'No va',
}

/**
 * La foto de la pantalla, si el navegador puede.
 *
 * Se toma **antes** de abrir el formulario: si se tomara después, la captura
 * sería del formulario y no de lo que la persona está reportando.
 *
 * `html2canvas` se carga solo en este momento —import dinámico— para que no
 * viaje en el paquete principal: es una librería grande al servicio de algo
 * que se usa de vez en cuando, y el iPad del muelle descarga ese paquete cada
 * vez que se actualiza la app.
 *
 * Si falla, se sigue sin foto. Un reporte sin imagen sirve; un botón que se
 * queda pensando no.
 */
export async function capturarPantalla() {
  try {
    const { default: html2canvas } = await import('html2canvas')
    const lienzo = await html2canvas(document.body, {
      // A la mitad de resolución: se ve perfecto para entender qué pasaba y
      // pesa una cuarta parte, que importa cuando esto viaja por la red del
      // muelle o se queda esperando en la cola.
      scale: Math.min(window.devicePixelRatio || 1, 1) * 0.5,
      logging: false,
      useCORS: true,
      backgroundColor: null,
    })
    return lienzo.toDataURL('image/jpeg', 0.7)
  } catch {
    return null
  }
}

/**
 * Manda el reporte. Nunca falla por falta de red: entra a la cola del aparato,
 * igual que un embarque, y sale cuando haya señal.
 *
 * Quién reporta NO viaja desde aquí: lo sella el servidor con la sesión
 * (migración 021). Mandarlo desde el aparato sería confiar en el aparato.
 */
export async function enviarTicket({ tipo, bloqueo, titulo, detalle, captura, modo, fechaActiva }) {
  const fila = {
    client_id: crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tipo,
    bloqueo: Boolean(bloqueo),
    titulo: (titulo || '').trim(),
    detalle: (detalle || '').trim() || null,
    captura: captura || null,
    contexto: contextoActual({ modo, fechaActiva, enCola: await contarPendientes() }),
  }

  if (!navigator.onLine) {
    await encolar('tickets', fila, `Reporte: ${fila.titulo}`, fila.client_id)
    return { enCola: true, error: null }
  }

  const { error } = await supabase.from('tickets').insert(fila)
  if (error) {
    // Si el servidor no responde, la cola lo intenta después. Que alguien
    // pierda un reporte porque justo se cayó la red es lo único que este
    // canal no se puede permitir.
    await encolar('tickets', fila, `Reporte: ${fila.titulo}`, fila.client_id)
    return { enCola: true, error: null }
  }

  return { enCola: false, error: null }
}
