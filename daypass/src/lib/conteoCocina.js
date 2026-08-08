/**
 * El conteo de cocina, en un solo lugar.
 *
 * Cocina no cocina planes: cocina platos. El plan vive en la reserva y da la
 * tarifa; el plato vive en el pasajero. Los planes sin opciones (Diamond)
 * llevan menú fijo y no se preguntan.
 *
 * La pantalla del cierre y el documento impreso llaman a esta función: si el
 * cálculo viviera en dos sitios, tarde o temprano dirían cosas distintas y
 * alguien cocinaría de más o de menos.
 *
 * Reglas de quién come:
 *  · adultos, niños y cortesías comen
 *  · los infantes menores de 3 no cuentan como almuerzo
 *  ⚠ Deducido de la regla de precios (facturación), pendiente de confirmar
 *    con la coordinadora.
 */

export function calcularConteoCocina(registros, pasajeros = [], opcionesPlato = []) {
  const activos = (registros || []).filter(r => !['cancelada', 'noshow'].includes(r.estado))
  const idsActivos = new Set(activos.map(r => r.id))

  // Qué planes tienen opciones y cómo se llama cada una.
  const opcionPorId = new Map(opcionesPlato.map(o => [o.id, o]))
  const planesConOpciones = new Set(opcionesPlato.map(o => o.plan_id))

  const porPlato = new Map()   // opcionId → { nombre, plan, cantidad }
  const menuFijo = new Map()   // nombre del plan → cantidad
  let sinElegir = 0            // de planes CON opciones, todavía sin plato

  const comePorCategoria = c => c !== 'infante'

  activos.forEach(r => {
    // Cuántos comen en esta reserva, según el plan de la reserva.
    const comensales = (r.adultos || 0) + (r.ninos || 0) + (r.cortesias || 0)
    const suyos = (pasajeros || []).filter(p => p.registro_id === r.id)
    const nominalesQueComen = suyos.filter(p => comePorCategoria(p.categoria))

    const planTieneOpciones = planesConOpciones.has(r.plan_id)

    if (!planTieneOpciones) {
      // Menú fijo: todos los comensales de la reserva van a la misma línea.
      const nombre = r.planes?.nombre || 'Sin plan'
      menuFijo.set(nombre, (menuFijo.get(nombre) || 0) + comensales)
      return
    }

    nominalesQueComen.forEach(p => {
      const op = opcionPorId.get(p.opcion_plato_id)
      if (!op) { sinElegir += 1; return }
      const actual = porPlato.get(op.id) || {
        nombre: op.nombre_es, plan: r.planes?.nombre || '', cantidad: 0,
      }
      actual.cantidad += 1
      porPlato.set(op.id, actual)
    })

    // Plazas de la reserva que todavía no tienen nombre: tampoco tienen plato.
    const sinNombre = Math.max(0, comensales - nominalesQueComen.length)
    sinElegir += sinNombre
  })

  const filasPlato = [...porPlato.values()].sort((a, b) => b.cantidad - a.cantidad)
  const filasMenuFijo = [...menuFijo.entries()]
    .map(([plan, cantidad]) => ({ plan, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const totalAdultos   = activos.reduce((s, r) => s + (r.adultos || 0), 0)
  const totalNinos     = activos.reduce((s, r) => s + (r.ninos || 0), 0)
  const totalCortesias = activos.reduce((s, r) => s + (r.cortesias || 0), 0)
  const totalInfantes  = activos.reduce((s, r) => s + (r.infantes || 0), 0)
  const totalAlmuerzos = totalAdultos + totalNinos + totalCortesias

  const porRegistro = new Map(activos.map(r => [r.id, r]))
  const restricciones = (pasajeros || [])
    .filter(p => idsActivos.has(p.registro_id) && (p.restriccion_alimentaria || '').trim())
    .map(p => {
      const r = porRegistro.get(p.registro_id)
      return {
        id: p.id,
        nombre: p.nombre,
        grupo: r?.nombre_grupo || r?.agencia_nombre || '',
        lancha: r?.lanchas?.nombre || '',
        plato: opcionPorId.get(p.opcion_plato_id)?.nombre_es || '',
        nota: p.restriccion_alimentaria.trim(),
      }
    })
    .sort((a, b) => a.nota.localeCompare(b.nota))

  return {
    filasPlato,
    filasMenuFijo,
    sinElegir,
    restricciones,
    totalAdultos, totalNinos, totalCortesias, totalInfantes, totalAlmuerzos,
  }
}
