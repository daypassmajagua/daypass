/**
 * Cuánta gente hay en la isla ahora mismo.
 *
 * ── El dato que no existía ──────────────────────────────────────────────────
 *
 * Nadie sabía cuántas personas hay en la isla en este momento. Se sabe cuántas
 * se vendieron y cuántas embarcaron, pero el número de ahora —el que decide si
 * la cocina alcanza y si la lancha de regreso va llena— no estaba en ninguna
 * pantalla.
 *
 * ── Se calcula en el aparato, y a propósito ─────────────────────────────────
 *
 * Podría ser una vista de SQL, canónica y siempre fresca. Se descarta porque
 * **el número se necesita justo donde no hay señal**: en la isla. Se deriva de
 * los mismos hechos que ya baja la copia local, así que sigue respondiendo con
 * el iPad sin red. A cambio, el número **declara su edad** — uno viejo que se
 * sabe viejo es información; uno viejo que parece fresco es una mentira.
 *
 * ── Tres poblaciones, tres fuentes ──────────────────────────────────────────
 *
 * Esta es la parte que hay que decir en voz alta, porque contar solo una y
 * llamarla «la isla» sería repetir el error del Excel:
 *
 *   · **Pasadía** — sale de `embarques`, que es el único que tiene hechos por
 *     persona: subió (`check_in` o `walk_in` en un zarpe de ida) y bajó
 *     (`desembarque` en uno de regreso). Es el único de los tres que se puede
 *     restar, porque es el único que registra el regreso.
 *   · **Alojamiento** — `zarpe_alojamiento`. Viajan en la lancha y van al
 *     manifiesto, pero **no generan un hecho de embarque por persona**: la
 *     fila es la anotación del manifiesto, no un toque en el muelle. Y no
 *     bajan: son huéspedes del hotel, se quedan.
 *   · **Equipo** — `zarpe_empleados`. Lo mismo: van en el manifiesto y no
 *     tienen evento propio.
 *
 * Por eso el número grande es **el de pasadía**, que es el que se puede
 * afirmar, y los otros dos se dicen al lado sin sumarse a él. Un total que
 * mezclara lo contado con lo supuesto sería un total que nadie puede defender
 * cuando la Capitanía pregunte.
 */

const SUBEN = ['check_in', 'walk_in']

/**
 * @param zarpes       los del día, con `sentido`
 * @param embarques    los hechos de esos zarpes
 * @param alojamiento  filas de `zarpe_alojamiento` del día
 * @param equipo       filas de `zarpe_empleados` del día
 */
export function enLaIsla({ zarpes = [], embarques = [], alojamiento = [], equipo = [] } = {}) {
  const sentidoDe = new Map(zarpes.map(z => [z.id, z.sentido]))

  let subieron = 0
  let bajaron = 0

  for (const e of embarques) {
    const sentido = sentidoDe.get(e.zarpe_id)
    if (!sentido) continue                       // de otro día, o de un zarpe que no bajó
    if (sentido === 'ida' && SUBEN.includes(e.evento)) subieron += 1
    if (sentido === 'regreso' && e.evento === 'desembarque') bajaron += 1
  }

  return {
    subieron,
    bajaron,
    // Nunca negativo: un desembarque sin su embarque es un dato raro, no una
    // persona negativa. Se prefiere quedarse corto antes que absurdo.
    pasadia: Math.max(0, subieron - bajaron),
    alojamiento: alojamiento.length,
    equipo: equipo.length,
  }
}

/**
 * Cuánto hace que se miró, en palabras.
 *
 * Por debajo de un minuto no se dice nada: un «hace 4 s» que se repinta solo
 * llama más la atención que el número, y el número es lo que importa.
 */
export function edadDe(desde, ahora = Date.now()) {
  if (!desde) return null
  const minutos = Math.floor((ahora - new Date(desde).getTime()) / 60000)
  if (minutos < 1) return null
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
}
