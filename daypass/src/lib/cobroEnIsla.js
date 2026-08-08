/**
 * Cómo se le cobra el almuerzo a alguien que está en la isla.
 *
 * El mesero toma la comanda en papel y la digita en Zeus contra una cuenta.
 * Cuál cuenta depende del tipo de ingreso, y equivocarse tiene consecuencias
 * distintas en cada caso: cargarle a una cortesía es cobrarle a un invitado,
 * y no cargarle a un pasadía es comida regalada.
 *
 * El folio lo crea Daniela en Zeus y lo escribe en la reserva. Que no esté
 * todavía es un estado normal a media mañana, no un error — pero el mesero
 * tiene que poder distinguirlo de "esta persona no lleva folio".
 */

/** Los caminos posibles, en el idioma del mesero. */
export const COBROS = {
  folio:        'folio',        // pasadía con su folio Zeus: se carga ahí
  falta_folio:  'falta_folio',  // pasadía sin folio todavía: Daniela no lo ha creado
  cortesia:     'cortesia',     // invitado: no se le carga nada
  habitacion:   'habitacion',   // huésped de alojamiento: va a su habitación
  empleado:     'empleado',     // empleado: no genera consumo
  revisar:      'revisar',      // los datos se contradicen: no decidir solo
}

export function comoSeCobra(registro, tiposIngreso = []) {
  const tipo = tiposIngreso.find(t => t.id === registro?.tipo_ingreso_id)
  const pagoCortesia = registro?.forma_pago === 'cortesia'

  // `tipo_ingreso_id` llegó en la migración 007: las reservas anteriores lo
  // tienen vacío y solo dicen cortesía en `forma_pago`. Se mira también ahí.
  const codigo = tipo?.codigo || (pagoCortesia ? 'cortesia' : null)

  // Y si los dos hablan y no dicen lo mismo, no se elige bando. Con dinero de
  // por medio, un mesero de pie junto a la mesa no tiene por qué adivinar cuál
  // de los dos campos está mal: se le dice que pregunte.
  if (tipo && tipo.codigo !== 'cortesia' && pagoCortesia) {
    return {
      modo: COBROS.revisar,
      titulo: 'Revisar antes de cobrar',
      nota: `La reserva dice ${tipo.nombre || tipo.codigo} pero está marcada como cortesía. Pregúntale a Daniela.`,
      folio: null,
    }
  }

  if (codigo === 'cortesia') {
    return {
      modo: COBROS.cortesia,
      titulo: 'Cortesía',
      // Regla del hotel: la cortesía no lleva folio y el tiquete lo cobra
      // recepción directamente.
      nota: 'No se le carga nada. Recepción cobra el tiquete aparte.',
      folio: null,
    }
  }

  if (codigo === 'alojamiento') {
    return {
      modo: COBROS.habitacion,
      titulo: 'Huésped del hotel',
      nota: 'Va a la cuenta de su habitación, no a un folio de pasadía.',
      folio: null,
    }
  }

  if (codigo === 'empleado') {
    return {
      modo: COBROS.empleado,
      titulo: 'Empleado',
      nota: 'No genera consumo.',
      folio: null,
    }
  }

  const folio = (registro?.folio_zeus || '').trim()
  if (folio) {
    return { modo: COBROS.folio, titulo: 'Folio Zeus', nota: null, folio }
  }

  return {
    modo: COBROS.falta_folio,
    titulo: 'Sin folio todavía',
    nota: 'Daniela aún no lo ha creado en Zeus. Pregúntale antes de cerrar la cuenta.',
    folio: null,
  }
}

/** Solo los pasadías con folio se pueden cobrar sin preguntarle a nadie. */
export function sePuedeCobrar(cobro) {
  return cobro?.modo === COBROS.folio
}

/**
 * Busca por las primeras letras de cualquier palabra, en el nombre de la
 * persona, el del grupo y el de la agencia.
 *
 * El mesero oye un apellido en la mesa —"Martínez"— o el nombre del grupo
 * —"Bavaria"—, casi nunca el nombre completo de quien reservó.
 */
export function coincideEnIsla(registro, consulta) {
  const q = (consulta || '').trim().toLowerCase()
  if (!q) return true
  const campos = [
    registro.nombre_pasajero,
    registro.nombre_grupo,
    registro.agencia_nombre,
    registro.folio_zeus,
  ].filter(Boolean).join(' ').toLowerCase()

  return q.split(/\s+/).every(t =>
    campos.split(/\s+/).some(palabra => palabra.startsWith(t)) || campos.includes(t))
}
