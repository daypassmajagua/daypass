import { describe, it, expect } from 'vitest'
import { PAISES_ISO, opcionesDePais, paisesComoFilas } from './paisesISO'
import { parsePasajeros } from './parsePasajeros'

describe('la lista de países', () => {
  it('trae los 249 de la ISO 3166-1', () => {
    expect(PAISES_ISO).toHaveLength(249)
  })

  it('no repite código ni nombre', () => {
    const codigos = PAISES_ISO.map(p => p[0])
    const nombres = PAISES_ISO.map(p => p[1])
    expect(new Set(codigos).size).toBe(codigos.length)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('usa alpha-2 y no los códigos de tres letras que traía la demo', () => {
    expect(PAISES_ISO.every(p => /^[A-Z]{2}$/.test(p[0]))).toBe(true)
    expect(PAISES_ISO.find(p => p[1] === 'Colombia')[0]).toBe('CO')
  })

  it('marca como frecuentes los veintidós del pasadía', () => {
    const frecuentes = PAISES_ISO.filter(p => p[2]).map(p => p[0])
    expect(frecuentes).toHaveLength(22)
    expect(frecuentes).toContain('CO')
    expect(frecuentes).toContain('US')
    expect(frecuentes).not.toContain('KI')   // Kiribati existe, pero no llega
  })
})

describe('el orden del desplegable', () => {
  const paises = [
    { id: 'a', nombre: 'Afganistán', frecuente: false },
    { id: 'z', nombre: 'Zimbabue', frecuente: false },
    { id: 'c', nombre: 'Colombia', frecuente: true },
    { id: 'u', nombre: 'Estados Unidos', frecuente: true },
  ]

  it('pone los de siempre primero y el resto alfabético', () => {
    const etiquetas = opcionesDePais(paises).map(o => o.label)
    expect(etiquetas).toEqual([
      '— País —', 'Colombia', 'Estados Unidos', 'Afganistán', 'Zimbabue',
    ])
  })

  it('no altera la lista que recibe', () => {
    const copia = [...paises]
    opcionesDePais(paises)
    expect(paises).toEqual(copia)
  })

  it('aguanta una lista sin la columna frecuente', () => {
    const viejos = [{ id: 'b', nombre: 'Brasil' }, { id: 'a', nombre: 'Argentina' }]
    expect(opcionesDePais(viejos).map(o => o.label))
      .toEqual(['— País —', 'Argentina', 'Brasil'])
  })
})

describe('los ids de la demo', () => {
  it('conserva los que ya tenían reservas de muestra apuntándoles', () => {
    const filas = paisesComoFilas({ CO: 'pa-col' })
    expect(filas.find(p => p.codigo === 'CO').id).toBe('pa-col')
    expect(filas.find(p => p.codigo === 'BR').id).toBe('pa-br')
  })
})

/**
 * La razón de esta prueba: con veinte países 'CC' no existía. Con los 249, 'CC'
 * es Islas Cocos — y 'CC' es también como toda agencia colombiana escribe una
 * cédula. La lista completa podía nacer mandando gente al Índico.
 */
describe('un código de país no puede robarle el puesto a un documento', () => {
  const paises = [
    { id: 'pa-co', codigo: 'CO', nombre: 'Colombia' },
    { id: 'pa-cc', codigo: 'CC', nombre: 'Islas Cocos' },
  ]

  it('lee «CC» como cédula, no como Islas Cocos', () => {
    const [fila] = parsePasajeros('Juan Pérez, CC, 45789123', paises)
    expect(fila.tipo_documento).toBe('cc')
    expect(fila.documento).toBe('45789123')
    expect(fila.pais_id).toBeNull()
  })

  it('pero el nombre completo sí resuelve el país', () => {
    const [fila] = parsePasajeros('Ana Ruiz, Islas Cocos, AB123456', paises)
    expect(fila.pais_id).toBe('pa-cc')
  })

  it('y los códigos que no son documento siguen sirviendo', () => {
    const [fila] = parsePasajeros('Luis Gómez, CO, 1020304050', paises)
    expect(fila.pais_id).toBe('pa-co')
  })
})
