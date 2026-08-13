/**
 * Interpreta el WhatsApp de la agencia.
 *
 * El grueso de las reservas entra por WhatsApp y en lenguaje humano:
 *
 *     Buenas! Para mañana 4 pax Gold, a nombre de Rafael Gómez. Aviatur
 *     Reserva: Rafael (x4) 15 de agosto silver
 *     hola, tengo 2 adultos y 1 niño para el sábado, plan gold
 *
 * Todo eso se digita a mano hoy. Aquí se lee lo que se pueda —fecha, cuántos,
 * plan, agencia, nombre— y **se propone**, nunca se guarda solo: cada campo
 * queda visible y editable con su origen (regla 23).
 *
 * ── La regla que gobierna el parser ─────────────────────────────────────────
 *
 * **Ante la duda, no propone.** Un campo que se queda vacío cuesta un clic; un
 * campo mal deducido cuesta una reserva vendida al precio equivocado o una
 * lancha con cupo mal contado. Por eso todo lo que sale de aquí es lo que se
 * pudo leer con certeza razonable, y lo demás se deja para la asesora.
 *
 * No se inventan nombres de persona: distinguir «Rafael Gómez» de «Playa
 * Blanca» sin contexto es adivinar, así que el nombre solo se toma cuando la
 * frase lo anuncia («a nombre de X», «para X», «Reserva: X»).
 */

const MESES = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12,
}

const DIAS_SEMANA = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}

function sinTildes(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function aFecha(y, m, d) {
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

/**
 * Cuándo. Entiende «mañana», «el sábado», «15 de agosto» y «15/08».
 *
 * `hoy` entra por parámetro y no se lee del reloj aquí: esta función tiene que
 * poder probarse, y una que consulta la hora del sistema no se puede.
 */
export function leerFecha(texto, hoy) {
  const t = sinTildes(texto)
  const [y, m, d] = hoy.split('-').map(Number)
  const base = new Date(y, m - 1, d)

  if (/\bpasado\s*manana\b/.test(t)) {
    const f = new Date(y, m - 1, d + 2)
    return { fecha: aFecha(f.getFullYear(), f.getMonth() + 1, f.getDate()), como: 'pasado mañana' }
  }
  if (/\bmanana\b/.test(t)) {
    const f = new Date(y, m - 1, d + 1)
    return { fecha: aFecha(f.getFullYear(), f.getMonth() + 1, f.getDate()), como: 'mañana' }
  }
  if (/\bhoy\b/.test(t)) return { fecha: hoy, como: 'hoy' }

  // «15 de agosto» · «15 de agosto de 2026»
  const conMes = t.match(/\b(\d{1,2})\s*(?:de\s+)?([a-z]{3,10})\b(?:\s*(?:de\s+)?(\d{4}))?/)
  if (conMes && MESES[conMes[2]]) {
    const dia = Number(conMes[1])
    const mes = MESES[conMes[2]]
    let anio = conMes[3] ? Number(conMes[3]) : y
    // Sin año: si la fecha ya pasó, se entiende que hablan del año que viene.
    if (!conMes[3] && new Date(anio, mes - 1, dia) < base) anio += 1
    if (dia >= 1 && dia <= 31) return { fecha: aFecha(anio, mes, dia), como: `${dia} de ${conMes[2]}` }
  }

  // «15/08» · «15-08-2026». Día primero: es como se escribe en Colombia.
  const numerica = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (numerica) {
    const dia = Number(numerica[1])
    const mes = Number(numerica[2])
    let anio = numerica[3] ? Number(numerica[3]) : y
    if (anio < 100) anio += 2000
    if (dia <= 31 && mes >= 1 && mes <= 12) {
      if (!numerica[3] && new Date(anio, mes - 1, dia) < base) anio += 1
      return { fecha: aFecha(anio, mes, dia), como: `${dia}/${mes}` }
    }
  }

  // «el sábado»: el próximo, nunca el que ya pasó.
  for (const [nombre, indice] of Object.entries(DIAS_SEMANA)) {
    if (new RegExp(`\\b${nombre}\\b`).test(t)) {
      let delta = (indice - base.getDay() + 7) % 7
      if (delta === 0) delta = 7
      const f = new Date(y, m - 1, d + delta)
      return { fecha: aFecha(f.getFullYear(), f.getMonth() + 1, f.getDate()), como: `el ${nombre}` }
    }
  }

  return { fecha: null, como: null }
}

/**
 * Cuántos. Cubre «4 pax», «x4», «(x4)», «2 adultos y 1 niño», «4 personas».
 *
 * Los niños y los infantes solo se leen si el mensaje los nombra: asumir que
 * de «4 pax» dos son niños sería inventar, y de ahí sale mal el conteo de
 * cocina y la tarifa.
 */
export function leerCuantos(texto) {
  const t = sinTildes(texto)

  const buscar = re => { const m = t.match(re); return m ? Number(m[1]) : null }

  const ninos = buscar(/\b(\d{1,3})\s*(?:ninos?|menores?|kids?)\b/)
  const infantes = buscar(/\b(\d{1,3})\s*(?:infantes?|bebes?)\b/)
  let adultos = buscar(/\b(\d{1,3})\s*(?:adultos?|mayores?)\b/)

  // El total, cuando no se desglosó: «4 pax», «x4», «4 personas».
  const total =
    buscar(/\b(\d{1,3})\s*(?:pax|personas?|pasajeros?|cupos?|puestos?)\b/) ??
    buscar(/\(?\s*x\s*(\d{1,3})\s*\)?/) ??
    buscar(/\bpara\s+(\d{1,3})\b/)

  if (adultos === null && total !== null) {
    // Si el total viene junto con niños desglosados, los niños salen del total:
    // «4 pax, 1 niño» son 3 adultos y 1 niño, no 5 personas.
    adultos = Math.max(0, total - (ninos || 0) - (infantes || 0))
  }

  if (adultos === null && ninos === null && infantes === null) return null
  return {
    adultos: adultos ?? 0,
    ninos: ninos ?? 0,
    infantes: infantes ?? 0,
  }
}

/** Un plan del catálogo nombrado en el texto. El más largo gana: «Rack Gold» sobre «Gold». */
export function leerPlan(texto, planes = []) {
  const t = sinTildes(texto)
  let mejor = null
  for (const p of planes) {
    const nombre = sinTildes(p.nombre)
    if (!nombre) continue
    if (t.includes(nombre) && (!mejor || nombre.length > sinTildes(mejor.nombre).length)) mejor = p
  }
  if (mejor) return mejor

  // El nivel suelto: «gold», «silver», «diamond». Solo si un único plan lo lleva
  // — con dos candidatos no se adivina cuál.
  for (const nivel of ['diamond', 'gold', 'silver', 'bronce']) {
    if (!new RegExp(`\\b${nivel}\\b`).test(t)) continue
    const candidatos = planes.filter(p => sinTildes(p.nombre).includes(nivel))
    if (candidatos.length === 1) return candidatos[0]
  }
  return null
}

/** Una agencia del catálogo nombrada en el texto. */
export function leerAgencia(texto, agencias = []) {
  const t = sinTildes(texto)
  let mejor = null
  for (const a of agencias) {
    const nombre = sinTildes(a.nombre)
    if (nombre.length < 3) continue          // siglas de dos letras dan falsos positivos
    if (t.includes(nombre) && (!mejor || nombre.length > sinTildes(mejor.nombre).length)) mejor = a
  }
  return mejor
}

/**
 * El nombre del titular, **solo cuando la frase lo anuncia**.
 *
 * Sin anuncio no se toma nada: en «Aviatur, 4 pax para Playa Blanca» no hay
 * ninguna persona, y un parser optimista pondría «Playa Blanca» de titular.
 */
export function leerNombre(texto) {
  const patrones = [
    /a\s+nombre\s+de\s*:?\s*([^\n,.;(]{3,60})/i,
    /reserva(?:\s+de)?\s*:\s*([^\n,.;(0-9]{3,60})/i,
    /\btitular\s*:?\s*([^\n,.;(]{3,60})/i,
    /\bsr[ao]?\.?\s+([^\n,.;(0-9]{3,60})/i,
  ]
  for (const re of patrones) {
    const m = texto.match(re)
    if (!m) continue
    const limpio = m[1]
      .replace(/\s*\(?\s*x\s*\d+\s*\)?\s*$/i, '')   // «Rafael (x4)»
      .replace(/\s+(pax|personas?)\b.*$/i, '')
      .trim()
    if (limpio.length >= 3 && /[a-záéíóúñ]{3,}/i.test(limpio)) return limpio
  }
  return null
}

/**
 * Lee el mensaje entero y devuelve lo que se pudo entender.
 *
 * @returns {{ campos, origen }} `campos` son valores listos para el formulario;
 *   `origen` dice de dónde salió cada uno, para poder mostrarlo.
 */
export function parseReserva(texto, { hoy, planes = [], agencias = [] } = {}) {
  const campos = {}
  const origen = {}
  if (!texto || !texto.trim()) return { campos, origen }

  const { fecha, como } = leerFecha(texto, hoy)
  if (fecha) { campos.fecha = fecha; origen.fecha = como }

  const cuantos = leerCuantos(texto)
  if (cuantos && (cuantos.adultos || cuantos.ninos || cuantos.infantes)) {
    campos.adultos = cuantos.adultos
    campos.ninos = cuantos.ninos
    campos.infantes = cuantos.infantes
    const partes = [`${cuantos.adultos} adultos`]
    if (cuantos.ninos) partes.push(`${cuantos.ninos} niños`)
    if (cuantos.infantes) partes.push(`${cuantos.infantes} infantes`)
    origen.pax = partes.join(', ')
  }

  const plan = leerPlan(texto, planes)
  if (plan) { campos.plan_id = plan.id; origen.plan = plan.nombre }

  const agencia = leerAgencia(texto, agencias)
  if (agencia) {
    campos.agencia_nombre = agencia.nombre
    campos.agencia_id = agencia.id
    origen.agencia = agencia.nombre
  }

  const nombre = leerNombre(texto)
  if (nombre) { campos.nombre_pasajero = nombre; origen.nombre = nombre }

  // Una agencia con varias personas es un grupo: es lo que se vende en el 90%
  // de estos mensajes. Sigue siendo editable.
  const pax = (campos.adultos || 0) + (campos.ninos || 0) + (campos.infantes || 0)
  if (agencia && pax > 1) { campos.tipo = 'grupo'; origen.tipo = 'grupo' }

  return { campos, origen }
}
