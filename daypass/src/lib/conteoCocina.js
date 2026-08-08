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
 * ── Quién come ──────────────────────────────────────────────────────────────
 *
 * Todos. Adultos, niños, cortesías **e infantes**. Hasta la migración 014 esta
 * función asumía que los infantes no almuerzan, y ese supuesto nunca vino de la
 * operación: se dedujo de que el infante no paga. Quién paga y quién come son
 * dos ejes distintos, igual que el plan y el plato. Cada infante que vino fue
 * una porción que cocina no preparó.
 *
 * El infante **no elige plato** —un niño de 0 a 3 no elige y sus padres no le
 * van a decidir un plan— pero sí cuenta, en su propia línea: cocina necesita
 * saber que son tres porciones más aunque no sean un plato del menú.
 *
 * La excepción vive en `pasajeros.almuerza`, por persona. Es un campo y no una
 * regla porque el caso de 3 a 6 años depende de lo que los padres compraron, y
 * eso se marca en la persona, no se calcula.
 *
 * ── Las dos rutas ───────────────────────────────────────────────────────────
 *
 * Hay dos caminos y los dos tienen que estar bien, porque el segundo es el que
 * más pesa:
 *
 *  · Plan CON opciones  → se cuenta por los pasajeros con nombre.
 *  · Plan SIN opciones  → se cuenta por los contadores de la reserva.
 *
 * Y un grupo de 24 sin listado cargado no tiene ni una fila en `pasajeros`:
 * su número sale de los contadores. Como los listados de agencia llegan tarde,
 * ese es el caso normal, no el borde.
 */

/** Solo esta categoría no elige plato; el resto sí. */
const NO_ELIGE_PLATO = 'infante'

/** Sin la 014 corrida, `almuerza` llega vacío y lo correcto es que coma. */
const come = p => p.almuerza !== false

export function calcularConteoCocina(registros, pasajeros = [], opcionesPlato = []) {
  const activos = (registros || []).filter(r => !['cancelada', 'noshow'].includes(r.estado))
  const idsActivos = new Set(activos.map(r => r.id))

  // Qué planes tienen opciones y cómo se llama cada una.
  const opcionPorId = new Map(opcionesPlato.map(o => [o.id, o]))
  const planesConOpciones = new Set(opcionesPlato.map(o => o.plan_id))

  const porPlato = new Map()   // opcionId → { nombre, plan, cantidad }
  const menuFijo = new Map()   // nombre del plan → cantidad
  let sinElegir = 0            // de planes CON opciones, todavía sin plato
  let infantes = 0             // comen, pero no eligen: línea propia

  activos.forEach(r => {
    const suyos = (pasajeros || []).filter(p => p.registro_id === r.id)

    // Los dos grupos se cuentan aparte de punta a punta: unos eligen plato y
    // otros no, y mezclarlos es justamente el error que la 014 corrige.
    const nomInfantes = suyos.filter(p => p.categoria === NO_ELIGE_PLATO)
    const nomComensales = suyos.filter(p => p.categoria !== NO_ELIGE_PLATO)

    // Los contadores de la reserva mandan sobre las plazas que nadie nombró.
    const plazasComensales = (r.adultos || 0) + (r.ninos || 0) + (r.cortesias || 0)
    const plazasInfantes = r.infantes || 0

    // ── Infantes: da igual el plan, siempre van a su propia línea ──
    infantes += nomInfantes.filter(come).length
    infantes += Math.max(0, plazasInfantes - nomInfantes.length)

    // ── El resto ──
    if (!planesConOpciones.has(r.plan_id)) {
      // Menú fijo: no hay nada que elegir, así que las plazas sin nombre
      // cuentan igual que las nombradas. Solo se descuenta a quien esté
      // marcado explícitamente como que no almuerza.
      const nombradosQueNoComen = nomComensales.filter(p => !come(p)).length
      const nombre = r.planes?.nombre || 'Sin plan'
      const cuantos = Math.max(0, plazasComensales - nombradosQueNoComen)
      if (cuantos > 0) menuFijo.set(nombre, (menuFijo.get(nombre) || 0) + cuantos)
      return
    }

    nomComensales.filter(come).forEach(p => {
      const op = opcionPorId.get(p.opcion_plato_id)
      if (!op) { sinElegir += 1; return }
      const actual = porPlato.get(op.id) || {
        nombre: op.nombre_es, plan: r.planes?.nombre || '', cantidad: 0,
      }
      actual.cantidad += 1
      porPlato.set(op.id, actual)
    })

    // Plazas de la reserva que todavía no tienen nombre: tampoco tienen plato,
    // pero comen. Van a "sin elegir", no se pierden.
    sinElegir += Math.max(0, plazasComensales - nomComensales.length)
  })

  const filasPlato = [...porPlato.values()].sort((a, b) => b.cantidad - a.cantidad)
  const filasMenuFijo = [...menuFijo.entries()]
    .map(([plan, cantidad]) => ({ plan, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const totalAdultos   = activos.reduce((s, r) => s + (r.adultos || 0), 0)
  const totalNinos     = activos.reduce((s, r) => s + (r.ninos || 0), 0)
  const totalCortesias = activos.reduce((s, r) => s + (r.cortesias || 0), 0)
  const totalInfantes  = activos.reduce((s, r) => s + (r.infantes || 0), 0)

  // El total se suma de las líneas, no de los contadores de las reservas. Así
  // el número grande de la pantalla siempre cuadra con lo que hay debajo: si
  // alguien queda marcado como que no almuerza, se ve en los dos sitios.
  const totalAlmuerzos =
    filasPlato.reduce((s, f) => s + f.cantidad, 0) +
    filasMenuFijo.reduce((s, f) => s + f.cantidad, 0) +
    sinElegir + infantes

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
    infantes,          // porciones de infante: cuentan, no eligen
    restricciones,
    totalAdultos, totalNinos, totalCortesias, totalInfantes, totalAlmuerzos,
  }
}
