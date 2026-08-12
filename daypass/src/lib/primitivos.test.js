import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Las reglas del sistema visual, comprobadas sobre el código.
 *
 * No prueban comportamiento: prueban que **lo que ya se unificó no se vuelva a
 * inventar**. Es la única forma de que la capa de primitivos sobreviva a la
 * siguiente pantalla con prisa — la auditoría del 11 de agosto encontró 33
 * variantes visuales de botón, 19 alturas táctiles y doce maneras distintas de
 * dibujar la × de cerrar, y ninguna nació de una decisión: nacieron de que
 * nadie sabía que ya existían.
 *
 * Si una de estas falla, la respuesta casi nunca es cambiar la prueba.
 */

// `fileURLToPath` y no `.pathname`: la carpeta del proyecto tiene un espacio y
// el pathname lo entrega como `%20`, que `readdirSync` no encuentra.
const SRC = fileURLToPath(new URL('..', import.meta.url))

function archivos(dir, ext = '.jsx', acc = []) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) archivos(ruta, ext, acc)
    else if (nombre.endsWith(ext)) acc.push(ruta)
  }
  return acc
}

const jsx = archivos(SRC).map(ruta => ({
  ruta: ruta.slice(SRC.length).replace(/\\/g, '/'),
  texto: readFileSync(ruta, 'utf8'),
}))

describe('el sistema de botones', () => {
  /**
   * Verde y coral son colores de **estado** —cerrado, pendiente—, no de acción.
   * Un botón verde promete que la acción ya está hecha antes de hacerla, y ese
   * verde se lo roba a la insignia de al lado, que sí lo necesita.
   */
  it('Button tiene cuatro variantes y ninguna es de estado', () => {
    const button = jsx.find(a => a.ruta.endsWith('components/ui/Button.jsx'))
    const bloque = button.texto.match(/const variants = \{([\s\S]*?)\n\}/)[1]
    const nombres = [...bloque.matchAll(/^\s{2}(\w+):/gm)].map(m => m[1])

    expect(nombres.sort()).toEqual(['danger', 'ghost', 'primary', 'secondary'])
    expect(bloque).not.toMatch(/verde-|coral-/)
  })

  it('nadie inyecta un color de fondo a un Button', () => {
    // `className` en un Button es para separación y ancho, no para repintarlo:
    // así apareció una décima variante de facto (una esmeralda en Folios).
    const culpables = jsx
      .filter(a => /<Button[^>]*className="[^"]*\bbg-(?!transparent)/.test(a.texto))
      .map(a => a.ruta)
    expect(culpables).toEqual([])
  })
})

describe('los objetivos táctiles', () => {
  /**
   * **La defensa real está en el CSS, no en cada pantalla.**
   *
   * Conviene dejar escrito, porque yo mismo me equivoqué auditándolo: al ver
   * `h-9` en el buscador global concluí que en el iPad medía 36 px. No es
   * cierto — `index.css` fuerza `min-height: 44px` a todo `button`,
   * `[role=option]` y `a[href]` bajo `@media (pointer: coarse)`, y `min-height`
   * gana sobre `height`. En la tablet ya medía 44; los 36 eran de escritorio,
   * donde un mouse apunta fino y la densidad es una virtud.
   *
   * Así que lo que hay que proteger no es cada altura suelta —eso sería pelear
   * con la densidad de la oficina— sino **que esa regla siga ahí**. El día que
   * alguien la borre, todas las alturas chicas se vuelven reales de golpe y en
   * el único sitio donde importan.
   */
  it('el CSS sigue forzando 44 px en todo lo que se toca con el dedo', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8')
    const coarse = css.match(/@media \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/)

    expect(coarse, 'desapareció el bloque @media (pointer: coarse)').toBeTruthy()
    expect(coarse[1]).toMatch(/button,[\s\S]*?\[role="option"\],[\s\S]*?a\[href\]\s*\{[\s\S]*?min-height:\s*44px/)
  })

  /**
   * Un tamaño chico en un **primitivo** sí tiene que compensarse a mano,
   * porque un primitivo se usa en sitios que no son `<button>` —el disparador
   * de un `Select` puede acabar en un `div`— y ahí la regla global no llega.
   * `Select` y `DatePicker` ya lo hacen; esta prueba es para que el siguiente
   * no lo olvide.
   */
  it('un primitivo con tamaño chico declara su compensación táctil', () => {
    const sinCompensar = []
    for (const { ruta, texto } of jsx.filter(a => a.ruta.startsWith('components/ui/'))) {
      for (const linea of texto.split('\n')) {
        const chico = linea.match(/min-h-\[(\d+)px\]/)
        if (chico && Number(chico[1]) < 44 && !linea.includes('pointer:coarse')) {
          sinCompensar.push(`${ruta}: ${linea.trim()}`)
        }
      }
    }
    expect(sinCompensar).toEqual([])
  })

  /**
   * 32 px es defecto en cualquier modo: ahí es donde dos íconos caben bajo un
   * dedo. Se busca en el archivo entero y no dentro de `<button …>`, porque la
   * primera versión de esta prueba exigía que el `className` estuviera en la
   * misma línea de la etiqueta — y el único caso que había (el × de
   * `BuscadorAgencia`) lo tenía tres líneas más abajo. Dio verde sin mirar nada.
   */
  it('ningún botón mide 32 px', () => {
    const diminutos = jsx
      .filter(a => /\bw-8 h-8\b/.test(a.texto))
      .map(a => a.ruta)
    expect(diminutos).toEqual([])
  })
})

describe('los primitivos no se reinventan', () => {
  it('BotonIcono exige etiqueta', () => {
    const p = jsx.find(a => a.ruta.endsWith('components/ui/BotonIcono.jsx'))
    // El aviso en desarrollo es lo que impide que vuelvan a aparecer los ocho
    // íconos que el lector de pantalla anunciaba solo como «botón».
    expect(p.texto).toMatch(/import\.meta\.env\.DEV && !etiqueta/)
    expect(p.texto).toMatch(/aria-label=\{etiqueta\}/)
  })

  it('no hay dos componentes con el mismo nombre', () => {
    const definiciones = new Map()
    for (const { ruta, texto } of jsx) {
      for (const m of texto.matchAll(/^(?:export default )?function ([A-Z]\w+)/gm)) {
        const donde = definiciones.get(m[1]) || []
        donde.push(ruta)
        definiciones.set(m[1], donde)
      }
    }
    // `Casilla` vivía dos veces con dos significados: una casilla de marcar en
    // Config y un día del calendario en Turnos. Un `import` equivocado
    // esperando a pasar.
    const repetidos = [...definiciones]
      .filter(([, donde]) => donde.length > 1)
      // Los andamios locales de una sola pantalla (Seccion, Muestra, Fila…)
      // se permiten mientras no colisionen con un primitivo publicado.
      .filter(([nombre]) => jsx.some(a => a.ruta === `components/ui/${nombre}.jsx`))
      .map(([nombre, donde]) => `${nombre}: ${donde.join(' · ')}`)

    expect(repetidos).toEqual([])
  })
})
