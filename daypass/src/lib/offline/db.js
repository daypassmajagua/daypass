import Dexie from 'dexie'

/**
 * La copia local del día operativo.
 *
 * En el muelle y en la isla, esta base es la fuente de verdad mientras no
 * haya señal. Se llena al cerrar el tentativo —en la oficina, con wifi,
 * antes de salir— y se mantiene al día cuando hay red.
 *
 * Regla: los datos NUNCA se cachean en el service worker. Un caché de red
 * devolvería respuestas viejas sin que nadie se entere; aquí, en cambio,
 * siempre se sabe de cuándo es la copia.
 */
export const db = new Dexie('daypass')

db.version(1).stores({
  // Copia del día. La clave es la fecha: se opera un día a la vez.
  dias: 'fecha',

  // Filas del día, para trabajar sin red.
  registros: 'id, fecha',
  pasajeros: 'id, registro_id',
  zarpes: 'id, fecha',
  embarques: 'client_id, zarpe_id',

  // Catálogos que la pantalla necesita para pintar.
  catalogos: 'nombre',

  // La cola de hechos por enviar. `client_id` es la clave: reenviar el
  // mismo dos veces es inofensivo, y aquí tampoco se duplica.
  cola: 'client_id, tabla, creado_en, intentos',

  // Marcas de tiempo y estado de la sincronización.
  meta: 'clave',
})

/**
 * v2 · Quiénes van a bordo sin ser pasadía.
 *
 * El manifiesto de Capitanía incluye a los empleados y a los huéspedes de
 * alojamiento que viajan en ese zarpe, y se imprime en el muelle minutos antes
 * de zarpar —donde puede no haber señal—. Sin estas dos tablas en la copia
 * local, el documento saldría incompleto justo cuando se necesita completo.
 *
 * Dexie migra solo: los stores viejos se conservan y lo ya guardado no se
 * pierde. Solo se agregan.
 */
db.version(2).stores({
  zarpe_empleados: '[zarpe_id+empleado_id], zarpe_id',
  zarpe_alojamiento: 'id, zarpe_id',
})

/**
 * v3 · Los tokens, para poder leer un QR sin señal.
 *
 * El pase del cliente codifica `daypass:{token}`. Sin esta tabla local, un QR
 * escaneado en el muelle no se puede resolver a su reserva cuando no hay red
 * —que es justo cuando el lector serviría de algo—.
 *
 * Solo el token y a qué reserva apunta. Nada más: es la única pieza de la
 * copia local que un tercero podría usar para abrir la página de un cliente,
 * así que no lleva ni un dato de más.
 */
db.version(3).stores({
  tokens: 'token, registro_id',
})

/** Cuándo se llenó por última vez la copia de este día. */
export async function marcarPrecarga(fecha, resumen) {
  await db.meta.put({
    clave: `precarga:${fecha}`,
    en: new Date().toISOString(),
    resumen,
  })
}

export async function leerPrecarga(fecha) {
  return db.meta.get(`precarga:${fecha}`)
}

/** Borra la copia de un día. Se usa al precargar de nuevo. */
export async function limpiarDia(fecha) {
  const regs = await db.registros.where('fecha').equals(fecha).toArray()
  const ids = regs.map(r => r.id)
  const zarpes = await db.zarpes.where('fecha').equals(fecha).toArray()
  const idsZarpe = zarpes.map(z => z.id)
  await db.transaction('rw',
    db.registros, db.pasajeros, db.zarpes, db.embarques,
    db.zarpe_empleados, db.zarpe_alojamiento,
    async () => {
      await db.registros.where('fecha').equals(fecha).delete()
      await db.zarpes.where('fecha').equals(fecha).delete()
      if (ids.length) await db.pasajeros.where('registro_id').anyOf(ids).delete()
      if (idsZarpe.length) {
        await db.zarpe_empleados.where('zarpe_id').anyOf(idsZarpe).delete()
        await db.zarpe_alojamiento.where('zarpe_id').anyOf(idsZarpe).delete()
      }
    })
}
