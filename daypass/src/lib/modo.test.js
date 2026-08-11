import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MODOS, leerModoGuardado } from './modo'

/**
 * El modo del aparato tiene que mover píxeles de verdad.
 *
 * Durante meses `lib/modo.js` declaró 16, 18 y 20 px y **no movía nada**: las
 * dos pantallas de afuera estaban dimensionadas a mano, en píxeles, desde
 * antes de que el modo existiera. Cambiar el iPad a modo isla no cambiaba una
 * letra.
 *
 * Ahora el tamaño sale de la raíz —`html[data-modo]` en `index.css`— y todo lo
 * demás va en `rem`, que escala solo. Esta prueba cuida esa condición: **un
 * tamaño escrito en píxeles en una pantalla de afuera es un tamaño que el modo
 * no puede tocar**, y vuelve a aparecer con la primera línea que alguien
 * agregue de memoria.
 */

const AFUERA = ['pages/Embarque.jsx', 'pages/Isla.jsx', 'pages/Cocina.jsx']

describe('las pantallas de afuera escalan con el modo', () => {
  for (const pantalla of AFUERA) {
    it(`${pantalla} no tiene tamaños en píxeles`, () => {
      const codigo = readFileSync(new URL(`../${pantalla}`, import.meta.url), 'utf8')
      const enPixeles = [...codigo.matchAll(/[\w-]+-\[(\d+)px\]/g)].map(m => m[0])
      expect(enPixeles).toEqual([])
    })
  }
})

describe('los tres modos', () => {
  it('van de menos a más: oficina, muelle, isla', () => {
    expect(MODOS.oficina.base).toBeLessThan(MODOS.muelle.base)
    expect(MODOS.muelle.base).toBeLessThan(MODOS.isla.base)
  })

  it('afuera nunca se muestra dinero', () => {
    // No es control de acceso —eso es la RLS— es discreción física: esa
    // pantalla la ven el pasajero, el guía y toda la fila.
    expect(MODOS.muelle.muestraDinero).toBe(false)
    expect(MODOS.isla.muestraDinero).toBe(false)
    expect(MODOS.oficina.muestraDinero).toBe(true)
  })

  it('afuera no hay barra de navegación', () => {
    expect(MODOS.muelle.conBarra).toBe(false)
    expect(MODOS.isla.conBarra).toBe(false)
  })

  /**
   * La escala del CSS y la declarada en el código tienen que decir lo mismo.
   * Si alguien sube el muelle a 19 px en `modo.js` y no toca `index.css`, la
   * tabla de arriba pasa a ser documentación falsa.
   */
  it('index.css escala lo mismo que declara modo.js', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    for (const id of ['muelle', 'isla']) {
      const regla = new RegExp(`html\\[data-modo='${id}'\\]\\s*\\{\\s*font-size:\\s*([\\d.]+)%`)
      const encontrado = css.match(regla)
      expect(encontrado, `falta la regla de ${id} en index.css`).toBeTruthy()
      expect(Number(encontrado[1])).toBeCloseTo(MODOS[id].base / MODOS.oficina.base * 100, 1)
    }
  })
})

describe('de dónde sale el modo', () => {
  it('sin nada guardado, oficina', () => {
    // Vale para el celular del cliente, que nunca configuró nada.
    expect(leerModoGuardado()).toBe('oficina')
  })
})
