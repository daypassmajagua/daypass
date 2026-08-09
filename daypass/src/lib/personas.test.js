import { describe, it, expect, beforeEach } from 'vitest'
import { normalizarDocumento, __store, createMockClient } from './mockSupabase'

const mockSupabase = createMockClient()

/**
 * Personas: que dos filas sean la misma señora.
 *
 * Lo que se prueba aquí es la regla que decide identidad, y por eso importa
 * más de lo que parece: si `1.023.456` y `1023456` se toman por personas
 * distintas, la precarga no sirve para nada y la base se llena de duplicados
 * que después hay que unir a mano.
 *
 * La normalización vive en dos sitios —la columna generada `documento_norm`
 * de la migración 020 y el mock— y tienen que decir lo mismo. Estas
 * comprobaciones son sobre el mock, que es el que se puede correr aquí; la
 * migración lleva su propia comprobación al final, que crea una persona de
 * mentira con las dos escrituras y falla si no coinciden.
 */

describe('normalizarDocumento', () => {
  it('ignora puntos, espacios y guiones', () => {
    const esperado = '1023456'
    expect(normalizarDocumento('1.023.456')).toBe(esperado)
    expect(normalizarDocumento('1 023 456')).toBe(esperado)
    expect(normalizarDocumento('1-023-456')).toBe(esperado)
    expect(normalizarDocumento('  1023456  ')).toBe(esperado)
  })

  it('sube a mayúsculas: los pasaportes se escriben de las dos formas', () => {
    expect(normalizarDocumento('ab123456')).toBe('AB123456')
    expect(normalizarDocumento('AB-123456')).toBe('AB123456')
  })

  it('devuelve null cuando no hay documento', () => {
    // Es lo que permite que convivan mil pasajeros sin documento: el índice
    // único de la 020 solo mira las filas que no son nulas.
    expect(normalizarDocumento('')).toBe(null)
    expect(normalizarDocumento(null)).toBe(null)
    expect(normalizarDocumento(undefined)).toBe(null)
    expect(normalizarDocumento('   ')).toBe(null)
    expect(normalizarDocumento('-.-')).toBe(null)
  })
})

describe('el pasajero se enlaza con su persona', () => {
  beforeEach(() => {
    __store.personas.length = 0
    __store.pasajeros.length = 0
  })

  const guardar = fila =>
    mockSupabase.from('pasajeros').insert(fila).select().single()

  it('crea la persona la primera vez y la reconoce la segunda', async () => {
    const { data: primero } = await guardar({
      registro_id: 'r-1', nombre: 'Marcela Ruiz',
      tipo_documento: 'cc', documento: '1.023.456',
    })
    expect(primero.persona_id).toBeTruthy()
    expect(__store.personas).toHaveLength(1)

    // Vuelve tres meses después y la escriben sin puntos.
    const { data: segundo } = await guardar({
      registro_id: 'r-2', nombre: 'Marcela Ruiz Gómez',
      tipo_documento: 'cc', documento: '1023456',
    })
    expect(segundo.persona_id).toBe(primero.persona_id)
    expect(__store.personas).toHaveLength(1)
  })

  it('no pisa el nombre corregido a mano, pero sí completa lo que faltaba', async () => {
    await guardar({
      registro_id: 'r-1', nombre: 'marcela ruiz',
      tipo_documento: 'cc', documento: '1023456',
    })
    __store.personas[0].nombre_completo = 'Marcela Ruiz Gómez'   // alguien lo corrigió

    await guardar({
      registro_id: 'r-2', nombre: 'M. Ruiz',
      tipo_documento: 'cc', documento: '1023456', pais_id: 'co',
    })

    const p = __store.personas[0]
    expect(p.nombre_completo).toBe('Marcela Ruiz Gómez')   // el de hoy no manda
    expect(p.pais_id).toBe('co')                            // lo que faltaba, sí
  })

  it('una plaza sin documento viaja sin persona y no estorba', async () => {
    const { data: a } = await guardar({ registro_id: 'r-1', nombre: 'Persona 4 de 24' })
    const { data: b } = await guardar({ registro_id: 'r-1', nombre: 'Persona 5 de 24' })

    expect(a.persona_id).toBe(null)
    expect(b.persona_id).toBe(null)
    expect(__store.personas).toHaveLength(0)
  })

  it('sin nombre no se crea persona aunque venga el documento', async () => {
    await guardar({ registro_id: 'r-1', nombre: '   ', documento: '999' })
    expect(__store.personas).toHaveLength(0)
  })
})

describe('buscar_personas', () => {
  beforeEach(async () => {
    __store.personas.length = 0
    __store.pasajeros.length = 0
    await mockSupabase.from('pasajeros').insert([
      { registro_id: 'r-1', nombre: 'Marcela Ruiz',  documento: '1.023.456' },
      { registro_id: 'r-2', nombre: 'Marcela Ruiz',  documento: '1.023.456' },
      { registro_id: 'r-3', nombre: 'Andrés Beltrán', documento: 'AB-77821' },
    ]).select()
  })

  it('encuentra por documento aunque se escriba distinto', async () => {
    const { data } = await mockSupabase.rpc('buscar_personas', { p_texto: '1023' })
    expect(data.map(p => p.nombre_completo)).toEqual(['Marcela Ruiz'])
  })

  it('encuentra por nombre, sin importar mayúsculas', async () => {
    const { data } = await mockSupabase.rpc('buscar_personas', { p_texto: 'beltrán' })
    expect(data).toHaveLength(1)
    expect(data[0].nombre_completo).toBe('Andrés Beltrán')
  })

  it('quien más ha venido aparece de primero', async () => {
    const { data } = await mockSupabase.rpc('buscar_personas', { p_texto: 'a' , p_limite: 5 })
    // 'a' tiene una sola letra: no busca nada. Es a propósito — la lista va a
    // tener miles de filas y esto corre mientras alguien escribe.
    expect(data).toEqual([])

    const { data: dos } = await mockSupabase.rpc('buscar_personas', { p_texto: 'ruiz' })
    expect(dos[0].veces).toBe(2)
  })

  it('no devuelve nada con menos de tres caracteres', async () => {
    expect((await mockSupabase.rpc('buscar_personas', { p_texto: '10' })).data).toEqual([])
    expect((await mockSupabase.rpc('buscar_personas', { p_texto: '' })).data).toEqual([])
  })
})
