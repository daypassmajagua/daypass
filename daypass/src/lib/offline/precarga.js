import { db, limpiarDia, marcarPrecarga } from './db'
import { supabase } from '../supabase'

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
      .select('*, lanchas (id, nombre, codigo, capacidad), planes (id, nombre), canales (id, codigo, nombre), paises (id, codigo, nombre)')
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
    ]),
  ])

  if (reg.error) return { error: reg.error }

  const registros = reg.data || []
  const zarpes = zar.data || []

  // Los pasajeros van por lotes: una reserva de grupo puede traer 40.
  let pasajeros = []
  if (registros.length) {
    const { data } = await supabase
      .from('pasajeros')
      .select('*')
      .in('registro_id', registros.map(r => r.id))
    pasajeros = data || []
  }

  // Los embarques ya registrados, para que el muelle no repita a nadie
  // que otro dispositivo ya marcó.
  let embarques = []
  if (zarpes.length) {
    const { data } = await supabase
      .from('embarques')
      .select('*')
      .in('zarpe_id', zarpes.map(z => z.id))
    embarques = data || []
  }

  await limpiarDia(fecha)
  await db.transaction('rw', db.registros, db.pasajeros, db.zarpes, db.embarques, db.catalogos, async () => {
    if (registros.length) await db.registros.bulkPut(registros)
    if (pasajeros.length) await db.pasajeros.bulkPut(pasajeros)
    if (zarpes.length) await db.zarpes.bulkPut(zarpes)
    if (embarques.length) await db.embarques.bulkPut(embarques)

    const [lanchas, planes, paises, opciones, tipos, empleados] = cat
    await db.catalogos.bulkPut([
      { nombre: 'lanchas', filas: lanchas.data || [] },
      { nombre: 'planes', filas: planes.data || [] },
      { nombre: 'paises', filas: paises.data || [] },
      { nombre: 'opciones_plato', filas: opciones.data || [] },
      { nombre: 'tipos_ingreso', filas: tipos.data || [] },
      { nombre: 'empleados', filas: empleados.data || [] },
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
  const embarques = zarpes.length
    ? await db.embarques.where('zarpe_id').anyOf(zarpes.map(z => z.id)).toArray()
    : []
  return { registros, pasajeros, zarpes, embarques }
}

export async function leerCatalogoLocal(nombre) {
  const fila = await db.catalogos.get(nombre)
  return fila?.filas || []
}
