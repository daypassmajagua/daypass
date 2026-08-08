import { db, limpiarDia, marcarPrecarga } from './db'
import { supabase } from '../supabase'
import { reservaCon, CON_LANCHA_COMPLETA, CON_PLAN, CON_CANAL, CON_PAIS } from '../columnas'

/**
 * Descarga el día completo a la copia local.
 *
 * Ocurre en la oficina, con wifi, al cerrar el tentativo: los dispositivos de
 * muelle e isla se llevan la lista antes de salir. También se puede forzar a
 * mano desde el indicador.
 */
export async function precargarDia(fecha) {
  if (!fecha) return { error: { message: 'Sin fecha' } }

  const [reg, zar, cat] = await Promise.all([
    supabase
      .from('registros')
      .select(reservaCon({ nivel: 'pago', relaciones: [CON_LANCHA_COMPLETA, CON_PLAN, CON_CANAL, CON_PAIS] }))
      .eq('fecha', fecha),
    supabase
      .from('zarpes')
      .select('*, lanchas (id, nombre, codigo, capacidad), pilotos (id, nombre)')
      .eq('fecha', fecha),
    Promise.all([
      supabase.from('lanchas').select('*'),
      supabase.from('planes').select('*'),
      supabase.from('paises').select('*'),
      supabase.from('opciones_plato').select('*'),
      supabase.from('tipos_ingreso').select('*'),
      supabase.from('empleados').select('*'),
      supabase.from('pilotos').select('*'),
    ]),
  ])

  if (reg.error) return { error: reg.error }

  const registros = reg.data || []
  const zarpes = zar.data || []

  // Los pasajeros van por lotes: una reserva de grupo puede traer 40.
  let pasajeros = []
  // Y los tokens, para poder resolver un QR sin señal. Solo el token y su
  // reserva: nada más de esa tabla baja al dispositivo.
  let tokens = []
  if (registros.length) {
    const ids = registros.map(r => r.id)
    const [pax, tok] = await Promise.all([
      supabase.from('pasajeros').select('*').in('registro_id', ids),
      supabase.from('tokens_reserva').select('token, registro_id').in('registro_id', ids),
    ])
    pasajeros = pax.data || []
    tokens = tok.data || []
  }

  // Los embarques ya registrados, para que el muelle no repita a nadie
  // que otro dispositivo ya marcó.
  let embarques = []
  // Y quiénes van a bordo sin ser pasadía: sin esto el manifiesto de
  // Capitanía no se puede imprimir sin señal, que es justo cuando se imprime.
  let zarpeEmpleados = []
  let zarpeAlojamiento = []
  if (zarpes.length) {
    const ids = zarpes.map(z => z.id)
    const [emb, ze, za] = await Promise.all([
      supabase.from('embarques').select('*').in('zarpe_id', ids),
      supabase.from('zarpe_empleados').select('*').in('zarpe_id', ids),
      supabase.from('zarpe_alojamiento').select('*').in('zarpe_id', ids),
    ])
    embarques = emb.data || []
    zarpeEmpleados = ze.data || []
    zarpeAlojamiento = za.data || []
  }

  await limpiarDia(fecha)
  await db.transaction('rw',
    db.registros, db.pasajeros, db.zarpes, db.embarques,
    db.zarpe_empleados, db.zarpe_alojamiento, db.tokens, db.catalogos,
    async () => {
      if (registros.length) await db.registros.bulkPut(registros)
      if (pasajeros.length) await db.pasajeros.bulkPut(pasajeros)
      if (tokens.length) await db.tokens.bulkPut(tokens)
      if (zarpes.length) await db.zarpes.bulkPut(zarpes)
      if (embarques.length) await db.embarques.bulkPut(embarques)
      if (zarpeEmpleados.length) await db.zarpe_empleados.bulkPut(zarpeEmpleados)
      if (zarpeAlojamiento.length) await db.zarpe_alojamiento.bulkPut(zarpeAlojamiento)

      const [lanchas, planes, paises, opciones, tipos, empleados, pilotos] = cat
      await db.catalogos.bulkPut([
        { nombre: 'lanchas', filas: lanchas.data || [] },
        { nombre: 'planes', filas: planes.data || [] },
        { nombre: 'paises', filas: paises.data || [] },
        { nombre: 'opciones_plato', filas: opciones.data || [] },
        { nombre: 'tipos_ingreso', filas: tipos.data || [] },
        { nombre: 'empleados', filas: empleados.data || [] },
        { nombre: 'pilotos', filas: pilotos.data || [] },
      ])
    })

  const resumen = {
    registros: registros.length,
    pasajeros: pasajeros.length,
    zarpes: zarpes.length,
    pax: registros
      .filter(r => !['cancelada', 'noshow'].includes(r.estado))
      .reduce((s, r) => s + (r.adultos || 0) + (r.ninos || 0), 0),
  }
  await marcarPrecarga(fecha, resumen)

  return { resumen, error: null }
}

/** Lee el día de la copia local, para trabajar sin red. */
export async function leerDiaLocal(fecha) {
  const [registros, zarpes] = await Promise.all([
    db.registros.where('fecha').equals(fecha).toArray(),
    db.zarpes.where('fecha').equals(fecha).toArray(),
  ])
  const ids = registros.map(r => r.id)
  const pasajeros = ids.length
    ? await db.pasajeros.where('registro_id').anyOf(ids).toArray()
    : []

  const idsZarpe = zarpes.map(z => z.id)
  const [embarques, zarpeEmpleados, zarpeAlojamiento] = idsZarpe.length
    ? await Promise.all([
        db.embarques.where('zarpe_id').anyOf(idsZarpe).toArray(),
        db.zarpe_empleados.where('zarpe_id').anyOf(idsZarpe).toArray(),
        db.zarpe_alojamiento.where('zarpe_id').anyOf(idsZarpe).toArray(),
      ])
    : [[], [], []]

  return { registros, pasajeros, zarpes, embarques, zarpeEmpleados, zarpeAlojamiento }
}

export async function leerCatalogoLocal(nombre) {
  const fila = await db.catalogos.get(nombre)
  return fila?.filas || []
}

/**
 * De un QR a una reserva, sin pedirle nada al servidor.
 *
 * El pase del cliente codifica `daypass:{token}`. Se acepta también el token
 * pelado y la URL completa, porque un QR de un enlace viejo —o uno que alguien
 * pegue a mano— tiene que servir igual: en el muelle no es momento de explicar
 * formatos.
 */
export async function resolverToken(texto) {
  const crudo = (texto || '').trim()
  if (!crudo) return null

  const token = crudo.startsWith('daypass:')
    ? crudo.slice('daypass:'.length)
    : crudo.includes('/r/')
      ? crudo.split('/r/').pop().split(/[?#]/)[0]
      : crudo

  const fila = await db.tokens.get(token)
  return fila?.registro_id || null
}
