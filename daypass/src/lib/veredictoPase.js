/**
 * Qué decir cuando se lee un pase.
 *
 * Vive aparte de la pantalla porque son **reglas**, no pintura: cuál de los
 * cuatro veredictos corresponde es una decisión de operación y merece quedar
 * fijada en pruebas. Enterrada dentro del componente, cambiarla sin querer no
 * rompería nada visible hasta que alguien se quedara en el muelle.
 *
 * ── Por qué estos cuatro y no los del plan ──────────────────────────────────
 *
 * Solo se distingue lo que se puede saber **sin señal**, que es como trabaja el
 * muelle. El pase se resuelve contra la copia local del día:
 *
 *   · `ok`             — está en esta lancha y falta gente por subir
 *   · `repetido`       — ya están todos arriba (o ya bajaron, en el regreso)
 *   · `otra_lancha`    — es de hoy, pero de la otra lancha
 *   · `no_encontrado`  — no está en la copia del día
 *
 * El plan decía «otra fecha — es del 15 de agosto». Decir la fecha exacta
 * exige preguntarle al servidor, y a las 8:20 en La Bodeguita puede no haber a
 * quién preguntarle. **«No es de hoy» es lo que sí se sabe siempre**, y lleva a
 * la misma acción: buscarlo por nombre.
 *
 * Y «otra lancha» no es un consuelo por no poder decir la fecha: con Majagua 1
 * y Majagua 2 saliendo del mismo muelle, ese es el caso que de verdad ocurre.
 */

export function veredictoDePase({ registroId, grupo, esRegreso }) {
  if (!registroId) {
    return {
      tipo: 'no_encontrado',
      titulo: 'No es de hoy',
      detalle: 'Búscalo por el nombre.',
    }
  }

  if (!grupo) {
    return {
      tipo: 'otra_lancha',
      titulo: 'Es de otra lancha',
      detalle: 'De hoy, pero no de esta. Revisa con quién va.',
    }
  }

  const quien = grupo.registro?.nombre_grupo || grupo.registro?.nombre_pasajero || 'Sin nombre'
  const total = grupo.filas?.length || 0
  const listos = grupo.embarcados || 0

  // **El nombre es el título en los tres casos que sí son de esta lancha.**
  // Quien está en la fila ve el suyo en grande y sabe que ya pasó; eso calma
  // una fila más que cualquier mensaje dirigido a quien sostiene el iPad.
  if (total > 0 && listos >= total) {
    return {
      tipo: 'repetido',
      titulo: quien,
      detalle: esRegreso ? `Ya bajaron los ${total}.` : `Ya está a bordo — los ${total}.`,
    }
  }

  return {
    tipo: 'ok',
    titulo: quien,
    detalle: listos > 0
      ? `${listos} de ${total} ya ${esRegreso ? 'bajaron' : 'a bordo'}`
      : `${total} ${total === 1 ? 'persona' : 'personas'}`,
  }
}
