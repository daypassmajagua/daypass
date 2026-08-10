import { describe, it, expect } from 'vitest'
import { rangoDeMeta, etiquetaDePeriodo, avance, porcentaje, opcionesDeNumero } from './metas'

/**
 * Los rangos de una meta.
 *
 * Un rango mal calculado no rompe nada: solo hace que el avance mienta
 * durante tres meses y nadie se entere hasta que cierra el trimestre. Por eso
 * se prueban los bordes —febrero, los bisiestos, el último trimestre— que es
 * donde fallan.
 */

describe('rangoDeMeta', () => {
  it('un mes va del 1 al último día', () => {
    expect(rangoDeMeta(2026, 'mes', 8)).toEqual({ desde: '2026-08-01', hasta: '2026-08-31' })
    expect(rangoDeMeta(2026, 'mes', 4)).toEqual({ desde: '2026-04-01', hasta: '2026-04-30' })
  })

  it('febrero tiene 28, y 29 en bisiesto', () => {
    expect(rangoDeMeta(2026, 'mes', 2).hasta).toBe('2026-02-28')
    expect(rangoDeMeta(2028, 'mes', 2).hasta).toBe('2028-02-29')
  })

  it('los trimestres cubren sus tres meses', () => {
    expect(rangoDeMeta(2026, 'trimestre', 1)).toEqual({ desde: '2026-01-01', hasta: '2026-03-31' })
    expect(rangoDeMeta(2026, 'trimestre', 2)).toEqual({ desde: '2026-04-01', hasta: '2026-06-30' })
    expect(rangoDeMeta(2026, 'trimestre', 3)).toEqual({ desde: '2026-07-01', hasta: '2026-09-30' })
    // El último es el que más se equivoca: tiene que llegar al 31 de diciembre.
    expect(rangoDeMeta(2026, 'trimestre', 4)).toEqual({ desde: '2026-10-01', hasta: '2026-12-31' })
  })

  it('el año es el año', () => {
    expect(rangoDeMeta(2026, 'anual')).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' })
  })
})

describe('cómo se lee', () => {
  it('dice el periodo en palabras de la operación', () => {
    expect(etiquetaDePeriodo('mes', 8, 2026)).toBe('agosto 2026')
    expect(etiquetaDePeriodo('trimestre', 2, 2026)).toBe('Trimestre 2 de 2026')
    expect(etiquetaDePeriodo('anual', null, 2026)).toBe('2026')
  })

  it('ofrece los números que tiene cada periodo', () => {
    expect(opcionesDeNumero('mes')).toHaveLength(12)
    expect(opcionesDeNumero('trimestre')).toHaveLength(4)
    expect(opcionesDeNumero('anual')).toEqual([])
  })
})

describe('el avance', () => {
  it('la barra se corta en el 100%, el número no', () => {
    // Pasarse no alarga la barra, pero superar la meta en 130% es una noticia
    // y esconderla sería raro.
    expect(avance(130, 100)).toBe(1)
    expect(porcentaje(130, 100)).toBe(130)
  })

  it('sin meta no hay avance, y no revienta', () => {
    expect(avance(500, 0)).toBe(0)
    expect(porcentaje(500, null)).toBe(0)
    expect(avance(null, 100)).toBe(0)
  })

  it('a mitad de camino', () => {
    expect(avance(50, 200)).toBe(0.25)
    expect(porcentaje(50, 200)).toBe(25)
  })
})
