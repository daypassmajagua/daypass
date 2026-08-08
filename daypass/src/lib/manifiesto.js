/**
 * El manifiesto de un zarpe, en un solo lugar.
 *
 * La Capitanía de Puerto exige la lista nominal de quién va a bordo antes de
 * zarpar: nombre, identificación y país de cada persona, pasajeros y
 * tripulación. Sin ella la lancha no sale.
 *
 * Vive aquí, y no dentro de la pantalla, por lo mismo que conteoCocina.js: la
 * pantalla del zarpe y el documento impreso llaman a esta función, y si el
 * cálculo estuviera en dos sitios tarde o temprano dirían cosas distintas —y
 * la que se entrega a la autoridad marítima es la impresa—.
 *
 * Y trabaja sobre datos ya cargados, sin pedirle nada al servidor, porque se
 * imprime en el muelle minutos antes de zarpar y ahí puede no haber señal.
 *
 * A bordo van cuatro poblaciones y el manifiesto no distingue por quién paga:
 *   · pasajeros de pasadía con nombre cargado
 *   · plazas de una reserva que embarcaron sin nombre (los grupos grandes)
 *   · huéspedes de alojamiento que viajan en ese zarpe
 *   · empleados y el piloto
 */

const EMBARCADOS = ['check_in', 'walk_in']

/** Cómo se escribe el documento en la lista. */
export const ETIQUETA_DOCUMENTO = {
  cc: 'C.C.', ce: 'C.E.', pasaporte: 'Pasaporte',
  ti: 'T.I.', rc: 'R.C.', otro: 'Doc.',
}

/**
 * Arma las filas del manifiesto de un zarpe.
 *
 * @param zarpe          la fila de `zarpes`
 * @param datos.registros        reservas del día
 * @param datos.pasajeros        pasajeros nominales de esas reservas
 * @param datos.estados          filas de `estado_embarques` de este zarpe
 * @param datos.empleados        catálogo de empleados
 * @param datos.zarpeEmpleados   filas de `zarpe_empleados` de este zarpe
 * @param datos.alojamiento      filas de `zarpe_alojamiento` de este zarpe
 * @param datos.pilotos          catálogo de pilotos
 * @param datos.paises           catálogo de países
 */
export function armarManifiesto(zarpe, datos = {}) {
  const {
    registros = [], pasajeros = [], estados = [],
    empleados = [], zarpeEmpleados = [], alojamiento = [],
    pilotos = [], paises = [],
  } = datos

  const nombrePais = new Map(paises.map(p => [p.id, p.nombre]))
  const pais = id => (id ? nombrePais.get(id) || null : null)
  const reservaPorId = new Map(registros.map(r => [r.id, r]))

  // Solo lo que efectivamente subió. Un no_show no va en el manifiesto: no
  // está a bordo, y ponerlo sería declararle a la Capitanía a alguien que se
  // quedó en el muelle.
  const aBordo = estados.filter(e => EMBARCADOS.includes(e.estado))

  const filas = []

  // ── 1. Pasajeros con nombre ──
  const pasajeroPorId = new Map(pasajeros.map(p => [p.id, p]))
  aBordo.filter(e => e.pasajero_id).forEach(e => {
    const p = pasajeroPorId.get(e.pasajero_id)
    if (!p) return
    const r = reservaPorId.get(p.registro_id)
    filas.push({
      grupo: 'pasajero',
      nombre: p.nombre,
      tipo_documento: p.tipo_documento || null,
      documento: p.documento || null,
      pais: pais(p.pais_id),
      categoria: p.categoria || 'adulto',
      reserva: r ? (r.nombre_grupo || r.nombre_pasajero) : null,
      sinIdentificar: !p.documento,
    })
  })

  // ── 2. Walk-ins: llegaron sin reserva y subieron igual ──
  aBordo.filter(e => !e.pasajero_id && !e.registro_id).forEach(e => {
    filas.push({
      grupo: 'pasajero',
      nombre: e.nombre,
      tipo_documento: e.tipo_documento || null,
      documento: e.documento || null,
      pais: pais(e.pais_id),
      categoria: e.categoria || 'adulto',
      reserva: null,
      walkIn: true,
      sinIdentificar: !e.documento,
    })
  })

  // ── 3. Plazas que embarcaron sin nombre ──
  // Son los grupos grandes cuyo listado no llegó a tiempo. Van en el
  // manifiesto contadas y visibles: esconderlas sería declarar menos gente de
  // la que va a bordo, que es peor que declararla sin nombre.
  const anonimosPorReserva = new Map()
  aBordo.filter(e => !e.pasajero_id && e.registro_id).forEach(e => {
    const lista = anonimosPorReserva.get(e.registro_id) || []
    lista.push(e)
    anonimosPorReserva.set(e.registro_id, lista)
  })

  anonimosPorReserva.forEach((lista, registroId) => {
    const r = reservaPorId.get(registroId)
    const conNombre = pasajeros.filter(p => p.registro_id === registroId).length
    lista.forEach((_, i) => {
      filas.push({
        grupo: 'pasajero',
        nombre: null,
        tipo_documento: null,
        documento: null,
        pais: null,
        categoria: 'adulto',
        reserva: r ? (r.nombre_grupo || r.nombre_pasajero) : null,
        sinNombre: true,
        posicion: conNombre + i + 1,
        sinIdentificar: true,
      })
    })
  })

  // ── 4. Huéspedes de alojamiento ──
  alojamiento.forEach(a => {
    filas.push({
      grupo: 'alojamiento',
      nombre: a.nombre,
      tipo_documento: a.tipo_documento || null,
      documento: a.documento || null,
      pais: pais(a.pais_id),
      categoria: 'adulto',
      reserva: null,
      sinIdentificar: !a.documento,
    })
  })

  // ── 5. Tripulación: el piloto primero, después los empleados ──
  const piloto = pilotos.find(p => p.id === zarpe?.piloto_id)
  if (piloto) {
    filas.push({
      grupo: 'tripulacion',
      nombre: piloto.nombre,
      tipo_documento: piloto.tipo_documento || 'cc',
      documento: piloto.documento || null,
      pais: pais(piloto.pais_id),
      cargo: 'Piloto',
      sinIdentificar: !piloto.documento,
    })
  }

  const idsEmpleado = new Set(zarpeEmpleados.map(z => z.empleado_id))
  empleados.filter(e => idsEmpleado.has(e.id)).forEach(e => {
    filas.push({
      grupo: 'tripulacion',
      nombre: e.nombre,
      tipo_documento: e.tipo_documento || null,
      documento: e.documento || null,
      pais: pais(e.pais_id),
      cargo: 'Tripulante',
      sinIdentificar: !e.documento,
    })
  })

  // Los pasajeros con nombre, alfabéticos; las plazas sin nombre al final de
  // los pasajeros, agrupadas por su reserva, para que se lean como un bloque.
  const orden = { pasajero: 0, alojamiento: 1, tripulacion: 2 }
  filas.sort((a, b) => {
    if (orden[a.grupo] !== orden[b.grupo]) return orden[a.grupo] - orden[b.grupo]
    if (Boolean(a.sinNombre) !== Boolean(b.sinNombre)) return a.sinNombre ? 1 : -1
    if (a.sinNombre && b.sinNombre) {
      return (a.reserva || '').localeCompare(b.reserva || '', 'es') ||
             (a.posicion || 0) - (b.posicion || 0)
    }
    return (a.nombre || '').localeCompare(b.nombre || '', 'es')
  })

  const pasajerosABordo = filas.filter(f => f.grupo === 'pasajero').length
  const alojados = filas.filter(f => f.grupo === 'alojamiento').length
  const tripulacion = filas.filter(f => f.grupo === 'tripulacion').length

  return {
    filas,
    piloto: piloto || null,
    total: filas.length,
    pasajeros: pasajerosABordo,
    alojados,
    tripulacion,
    sinNombre: filas.filter(f => f.sinNombre).length,
    sinDocumento: filas.filter(f => f.sinIdentificar && !f.sinNombre).length,
  }
}

/** Cómo se lee una fila en la columna de identificación. */
export function documentoLegible(fila) {
  if (!fila.documento) return null
  const tipo = ETIQUETA_DOCUMENTO[fila.tipo_documento] || ''
  return tipo ? `${tipo} ${fila.documento}` : fila.documento
}
