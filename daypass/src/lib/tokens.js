/**
 * Los tokens del sistema, leídos del CSS y no escritos a mano.
 *
 * ── Por qué se leen ─────────────────────────────────────────────────────────
 *
 * Una guía de estilo con la lista de colores copiada a mano es documentación
 * que envejece: alguien agrega `--color-mar-300`, nadie la agrega aquí, y a
 * los tres meses la guía miente sobre el sistema que dice describir. Peor: la
 * gente deja de creerle y vuelve a inventar colores.
 *
 * Leyéndolos del CSS, **la guía no puede quedar desactualizada**. Si un token
 * existe, aparece; si alguien lo borra, desaparece.
 *
 * ── Cómo ────────────────────────────────────────────────────────────────────
 *
 * Tailwind 4 compila el bloque `@theme` a propiedades personalizadas sobre
 * `:root`, **dentro de un `@layer theme`**. Eso importa: la primera versión de
 * esto solo miraba las reglas de primer nivel y devolvía cero tokens, porque
 * lo que hay arriba es el `@layer` y las reglas de verdad están adentro. Por
 * eso el recorrido baja por los grupos —`@layer`, `@media`, `@supports`— en
 * vez de quedarse en la superficie.
 *
 * Una hoja de otro origen lanza al tocar `cssRules` —el navegador no deja
 * leerla— y por eso va dentro de un `try`: aquí todo es del mismo origen, pero
 * una extensión del navegador puede meter la suya.
 */

/** Las familias, en el orden en que se explican. Lo que no encaje va a «otros». */
const FAMILIAS = [
  { prefijo: 'fondo', nombre: 'Fondo y tinta', porque: 'El papel y la letra. Casi todo es esto.' },
  { prefijo: 'linea', nombre: null },
  { prefijo: 'tinta', nombre: null },
  { prefijo: 'brand', nombre: 'Marca', porque: 'El navy del logo: barra, franja del día, entrada.' },
  { prefijo: 'blue', nombre: 'Acción', porque: 'Lo que se toca. Sobreescribe la escala de Tailwind para que el código viejo herede el sistema.' },
  { prefijo: 'coral', nombre: 'Pendiente y tardío', porque: 'El único acento. Si se usa para otra cosa, deja de significar «esto falta».' },
  { prefijo: 'verde', nombre: 'Cerrado y guardado', porque: 'Solo lo que ya pasó y quedó bien.' },
  { prefijo: 'peligro', nombre: 'Error real', porque: 'Se rompió algo o hay sobrecupo. No «ojo con esto».' },
  { prefijo: 'alarma', nombre: 'Alarma del muelle', porque: 'Falta alguien en el regreso.' },
  { prefijo: 'aviso', nombre: 'Aviso', porque: 'Algo que revisar, sin que nada esté roto.' },
  { prefijo: 'mar', nombre: 'Mar', porque: 'Información neutra que se mueve: el destello de lo que acaba de llegar.' },
  { prefijo: 'arena', nombre: 'Series de datos', porque: 'Gráficas e impresos. Nunca un estado.' },
  { prefijo: 'sol', nombre: 'Afuera', porque: 'Muelle e isla: alto contraste, sin grises medios. El sol los lava.' },
]

/** Recorre un grupo de reglas y las de adentro, apuntando lo que encuentre. */
function recorrer(reglas, encontrados) {
  if (!reglas) return

  for (const regla of Array.from(reglas)) {
    // Un grupo: `@layer`, `@media`, `@supports`. Las reglas están adentro.
    if (regla.cssRules) recorrer(regla.cssRules, encontrados)

    if (!regla.style || !regla.selectorText?.includes(':root')) continue
    for (const prop of Array.from(regla.style)) {
      if (!prop.startsWith('--color-')) continue
      encontrados.set(prop, regla.style.getPropertyValue(prop).trim())
    }
  }
}

/** Todos los `--color-*` que el documento tenga puestos, con su valor. */
export function leerColores() {
  const encontrados = new Map()

  for (const hoja of Array.from(document.styleSheets)) {
    let reglas
    try { reglas = hoja.cssRules } catch { continue }   // hoja de otro origen
    recorrer(reglas, encontrados)
  }

  return encontrados
}

/**
 * Las escalas que Tailwind trae puestas y que este sistema **no usa**.
 *
 * Salen en `:root` junto con las nuestras, así que sin filtrarlas la guía
 * mostraba doscientos colores de fábrica —morados, fucsias, limas— y el
 * sistema del hotel quedaba enterrado entre ellos. Eso no es solo ruido: una
 * guía que enseña `purple-400` está invitando a usarlo.
 *
 * `blue` no está en la lista porque **es nuestro**: el sistema sobreescribe
 * esa escala con el color de acción para que el código viejo la herede.
 */
const DE_FABRICA = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber',
  'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  // El negro y el blanco puros también son de Tailwind. Este sistema no los
  // usa: su tinta es `#16182c` y su papel `#f8f8f6`, porque un negro puro
  // sobre blanco puro vibra y cansa a las tres horas de pantalla.
  'black', 'white',
]

function esDeFabrica(nombre) {
  const suelto = nombre.replace('--color-', '')
  return DE_FABRICA.some(p => suelto === p || suelto.startsWith(p + '-'))
}

/** A qué familia pertenece un token, por su prefijo. */
function familiaDe(nombre) {
  const suelto = nombre.replace('--color-', '')
  const familia = FAMILIAS.find(f => suelto === f.prefijo || suelto.startsWith(f.prefijo + '-'))
  return familia?.prefijo || 'otros'
}

/**
 * Los colores agrupados por familia y ordenados por tono.
 *
 * El orden dentro de la familia es numérico —50, 100, 500…— y no alfabético,
 * porque alfabéticamente el 100 va antes que el 50 y la rampa se ve rota.
 */
export function coloresPorFamilia() {
  const colores = leerColores()
  const grupos = new Map()

  for (const [nombre, valor] of colores) {
    if (esDeFabrica(nombre)) continue
    const clave = familiaDe(nombre)
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push({ nombre, valor, tono: Number(nombre.match(/-(\d+)$/)?.[1] ?? 0) })
  }

  for (const lista of grupos.values()) {
    lista.sort((a, b) => a.tono - b.tono || a.nombre.localeCompare(b.nombre))
  }

  // «Fondo y tinta» son cuatro tokens sueltos que se leen juntos: se muestran
  // como una sola familia aunque tengan cuatro prefijos distintos.
  const base = ['fondo', 'linea', 'tinta']
  const juntos = base.flatMap(p => grupos.get(p) || [])
  base.forEach(p => grupos.delete(p))
  if (juntos.length) grupos.set('fondo', juntos)

  return FAMILIAS
    .filter(f => f.nombre)
    .map(f => ({ ...f, colores: grupos.get(f.prefijo) || [] }))
    .filter(f => f.colores.length)
    .concat(grupos.has('otros')
      ? [{ prefijo: 'otros', nombre: 'Sin familia', porque: 'Tokens sueltos. Si alguno se usa mucho, merece familia propia.', colores: grupos.get('otros') }]
      : [])
}
