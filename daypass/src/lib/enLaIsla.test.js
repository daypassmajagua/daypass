import { describe, it, expect } from 'vitest'
import { enLaIsla, edadDe } from './enLaIsla'

const ZARPES = [
  { id: 'z-ida', sentido: 'ida' },
  { id: 'z-vuelta', sentido: 'regreso' },
]

const subio = (i, evento = 'check_in') => ({ zarpe_id: 'z-ida', evento, client_id: `s${i}` })
const bajo = i => ({ zarpe_id: 'z-vuelta', evento: 'desembarque', client_id: `b${i}` })

describe('cuántos hay en la isla', () => {
  it('sin nada, cero', () => {
    expect(enLaIsla()).toEqual({
      subieron: 0, bajaron: 0, pasadia: 0, alojamiento: 0, equipo: 0,
    })
  })

  it('resta a quien ya bajó', () => {
    const r = enLaIsla({
      zarpes: ZARPES,
      embarques: [subio(1), subio(2), subio(3), bajo(1)],
    })
    expect(r).toMatchObject({ subieron: 3, bajaron: 1, pasadia: 2 })
  })

  it('el walk-in también subió', () => {
    const r = enLaIsla({ zarpes: ZARPES, embarques: [subio(1), subio(2, 'walk_in')] })
    expect(r.pasadia).toBe(2)
  })

  it('el que no llegó no subió', () => {
    const r = enLaIsla({ zarpes: ZARPES, embarques: [subio(1), subio(2, 'no_show')] })
    expect(r.pasadia).toBe(1)
  })

  /**
   * La razón de esta: el desembarque solo cuenta si es de un zarpe de regreso.
   * Si se contara por evento y no por sentido, un dato raro en el zarpe de ida
   * restaría gente que sí está en la isla.
   */
  it('el sentido del zarpe manda, no solo el evento', () => {
    const r = enLaIsla({
      zarpes: ZARPES,
      embarques: [
        subio(1),
        { zarpe_id: 'z-ida', evento: 'desembarque', client_id: 'raro' },
      ],
    })
    expect(r).toMatchObject({ subieron: 1, bajaron: 0, pasadia: 1 })
  })

  it('ignora los hechos de zarpes que no son de hoy', () => {
    const r = enLaIsla({
      zarpes: ZARPES,
      embarques: [subio(1), { zarpe_id: 'z-de-ayer', evento: 'check_in', client_id: 'x' }],
    })
    expect(r.pasadia).toBe(1)
  })

  it('nunca da negativo', () => {
    const r = enLaIsla({ zarpes: ZARPES, embarques: [bajo(1), bajo(2)] })
    expect(r.pasadia).toBe(0)
    expect(r.bajaron).toBe(2)
  })

  /**
   * Alojamiento y equipo van en el manifiesto y **no generan un hecho por
   * persona**, así que se cuentan aparte y no se suman al número que sí se
   * puede afirmar. Mezclar lo contado con lo supuesto da un total que nadie
   * puede defender cuando la Capitanía pregunte.
   */
  it('cuenta alojamiento y equipo aparte, sin sumarlos al de pasadía', () => {
    const r = enLaIsla({
      zarpes: ZARPES,
      embarques: [subio(1), subio(2)],
      alojamiento: [{}, {}, {}],
      equipo: [{}, {}],
    })
    expect(r).toMatchObject({ pasadia: 2, alojamiento: 3, equipo: 2 })
  })
})

describe('la edad del número', () => {
  const ahora = new Date('2026-08-11T15:00:00Z').getTime()

  it('por debajo de un minuto no dice nada', () => {
    expect(edadDe(new Date(ahora - 40_000), ahora)).toBeNull()
    expect(edadDe(null, ahora)).toBeNull()
  })

  it('en minutos', () => {
    expect(edadDe(new Date(ahora - 12 * 60_000), ahora)).toBe('hace 12 min')
  })

  it('en horas, con su singular', () => {
    expect(edadDe(new Date(ahora - 60 * 60_000), ahora)).toBe('hace 1 hora')
    expect(edadDe(new Date(ahora - 3 * 60 * 60_000), ahora)).toBe('hace 3 horas')
  })
})
