/**
 * Cuántas plazas sin nombre le quedan a una reserva en un zarpe.
 *
 * Vive aparte porque es la regla que sostiene el conteo del muelle, y de ella
 * depende que un grupo no aparezca con más o menos gente de la que tiene.
 *
 * Una reserva de grupo dice cuántos vienen mucho antes de saber cómo se
 * llaman: el listado de la agencia llega tarde, o no llega. Así que la lista
 * del muelle mezcla dos cosas —los que ya tienen nombre y las plazas que
 * todavía no— y la suma de ambas tiene que dar siempre el plan.
 *
 * Lo delicado: los embarques son inmutables. Nombrar a alguien crea un
 * pasajero nuevo, y si esa persona ya había subido como plaza anónima su
 * embarque viejo sigue ahí. Por eso nombrar solo se ofrece antes de subir; si
 * no, el grupo contaría a la misma persona dos veces.
 */

/**
 * @param plan        personas que dice la reserva (adultos + niños + infantes + cortesías)
 * @param conNombre   pasajeros nominales que ya tiene
 * @param anonimos    embarques de esa reserva sin pasajero_id
 * @param esRegreso   de vuelta la lista es la de quienes subieron, no la del plan
 * @param subieron    en el regreso, cuántas plazas anónimas subieron en la ida
 */
export function plazasSinNombre({ plan, conNombre, anonimos, esRegreso = false, subieron = 0 }) {
  // De vuelta caben exactamente los que subieron. Más desembarques que
  // embarques es un dato malo, no una fila de más.
  if (esRegreso) return subieron

  // En la ida la lista puede crecer: ningún hecho registrado puede quedar
  // invisible, aunque signifique mostrar más filas que plazas previstas.
  return Math.max(Math.max(0, plan - conNombre), anonimos)
}

/**
 * ¿Se le puede poner nombre a esta plaza?
 *
 * Solo antes de que suba. Después no, y no es una restricción de pantalla sino
 * de aritmética: el embarque anónimo ya no se puede borrar.
 */
export function sePuedeNombrar(fila, { embarcado, cerrado }) {
  return fila?.tipo === 'sin_nombre' && !embarcado && !cerrado && fila.estado !== 'no_show'
}
