import { db } from './db'
import { supabase } from '../supabase'

/**
 * La cola de hechos por enviar.
 *
 * Todo lo que se registra en el muelle o en la isla se escribe PRIMERO aquí,
 * con su client_id, y después se envía. Así la asesora nunca espera a la red
 * para seguir embarcando.
 *
 * Reenviar la cola completa es inofensivo: `client_id` es único en la base,
 * así que un hecho que ya llegó simplemente no se duplica. Esa propiedad es
 * la que hace segura toda esta capa.
 */

const oyentes = new Set()

/** Avisa a la interfaz que cambió el número de pendientes. */
function avisar() {
  oyentes.forEach(fn => { try { fn() } catch { /* un oyente roto no tumba la cola */ } })
}

export function alCambiarLaCola(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export async function contarPendientes() {
  return db.cola.count()
}

export async function listarPendientes() {
  return db.cola.orderBy('creado_en').toArray()
}

/**
 * Encola un hecho. Devuelve de inmediato: la interfaz no espera a la red.
 *
 * @param tabla      Tabla destino en Supabase.
 * @param fila       La fila a insertar, con su client_id ya generado.
 * @param claveCola  Clave con la que se guarda en la cola. Por defecto el
 *                   client_id de la fila, que es lo que usan los embarques.
 *                   Las tablas que no tienen esa columna —pasajeros, por
 *                   ejemplo— pasan su propio id: también es único en la base,
 *                   así que un reenvío da 23505 y se trata como enviado. Esa
 *                   es la única propiedad que la cola necesita.
 */
export async function encolar(tabla, fila, descripcion, claveCola) {
  await db.cola.put({
    client_id: claveCola || fila.client_id,
    tabla,
    fila,
    descripcion: descripcion || tabla,
    creado_en: new Date().toISOString(),
    intentos: 0,
    ultimo_error: null,
  })
  avisar()
  // Intento inmediato: si hay red, el hecho sale ya y la cola queda vacía.
  drenar()
  return { client_id: fila.client_id }
}

let drenando = false

/**
 * Envía lo pendiente. Se llama sola al encolar, al volver la red y cada
 * tanto; también se puede forzar desde el indicador.
 */
export async function drenar() {
  if (drenando || !navigator.onLine) return { enviados: 0, pendientes: await contarPendientes() }
  drenando = true

  let enviados = 0
  try {
    const pendientes = await db.cola.orderBy('creado_en').toArray()

    for (const item of pendientes) {
      const { error } = await supabase.from(item.tabla).insert(item.fila)

      if (!error) {
        await db.cola.delete(item.client_id)
        enviados++
        continue
      }

      // 23505 = clave duplicada. Significa que este hecho YA llegó al
      // servidor: reenviar la cola no debe atascarse por eso.
      if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
        await db.cola.delete(item.client_id)
        enviados++
        continue
      }

      // Sin red: se deja para el próximo intento, sin contarlo como fallo.
      if (!navigator.onLine || /fetch|network/i.test(error.message || '')) break

      // Un rechazo real del servidor: se anota y se sigue con los demás,
      // para que un hecho malo no bloquee a los buenos.
      await db.cola.update(item.client_id, {
        intentos: (item.intentos || 0) + 1,
        ultimo_error: error.message || 'Error desconocido',
      })
    }
  } finally {
    drenando = false
    avisar()
  }

  return { enviados, pendientes: await contarPendientes() }
}

/** Descarta un hecho que el servidor rechaza siempre. Requiere decisión humana. */
export async function descartar(clientId) {
  await db.cola.delete(clientId)
  avisar()
}

// ─── Disparadores automáticos ─────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { drenar() })
  // Cada 30 segundos: cubre el caso de red intermitente, donde el evento
  // 'online' no siempre se dispara aunque la conexión vuelva.
  setInterval(() => { if (navigator.onLine) drenar() }, 30_000)
}
