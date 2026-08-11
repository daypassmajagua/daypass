import { describe, it, expect } from 'vitest'
import { valorACobrar } from './cartera'

/**
 * Lo que se cobra no es lo que dice `total_calculado`.
 *
 * Esta prueba existe porque la diferencia entre los dos números es plata que
 * el hotel no va a recibir, y durante meses Informes le sumó las dos cosas a
 * gerencia. `total_calculado` multiplica personas por tarifa **para todo el
 * mundo**, incluidas las tres clases que viajan sin generar ingreso (regla
 * 11), y al proveedor le cobra la tarifa en vez del cupo.
 *
 * Vive aparte de `cartera.test.js` porque lo que cuida no es la cartera: es
 * que ninguna pantalla vuelva a sumar la columna equivocada.
 */

const TIPOS = {
  pasadia:     { codigo: 'pasadia',     genera_ingreso: true },
  cortesia:    { codigo: 'cortesia',    genera_ingreso: false },
  alojamiento: { codigo: 'alojamiento', genera_ingreso: false },
  empleado:    { codigo: 'empleado',    genera_ingreso: false },
  proveedor:   { codigo: 'proveedor',   genera_ingreso: true },
}

const reserva = (extra = {}) => ({
  estado: 'confirmada', total_calculado: 800_000, ...extra,
})

describe('quién genera ingreso y quién no', () => {
  it('un pasadía se cobra completo', () => {
    expect(valorACobrar(reserva(), TIPOS.pasadia)).toBe(800_000)
  })

  it('una cortesía no se cobra: el hotel invita', () => {
    expect(valorACobrar(reserva(), TIPOS.cortesia)).toBe(0)
  })

  it('un huésped de alojamiento ya pagó su plan, no el pasadía', () => {
    expect(valorACobrar(reserva(), TIPOS.alojamiento)).toBe(0)
  })

  it('un empleado va a trabajar', () => {
    expect(valorACobrar(reserva(), TIPOS.empleado)).toBe(0)
  })

  it('al proveedor se le cobra el cupo, no la tarifa', () => {
    const con = reserva({ cobra_cupo: true, valor_cupo: 120_000 })
    expect(valorACobrar(con, TIPOS.proveedor)).toBe(120_000)

    const sin = reserva({ cobra_cupo: false, valor_cupo: 120_000 })
    expect(valorACobrar(sin, TIPOS.proveedor)).toBe(0)
  })

  it('lo cancelado y lo que no llegó no se cobra', () => {
    expect(valorACobrar(reserva({ estado: 'cancelada' }), TIPOS.pasadia)).toBe(0)
    expect(valorACobrar(reserva({ estado: 'noshow' }), TIPOS.pasadia)).toBe(0)
  })

  /**
   * Ante un tipo sin definir se asume que cobra. Es deliberado: dejar de
   * cobrarle a alguien por una bandera en null se descubre tarde y mal.
   */
  it('sin tipo de ingreso, se cobra', () => {
    expect(valorACobrar(reserva(), undefined)).toBe(800_000)
    expect(valorACobrar(reserva(), { codigo: 'lo_que_sea' })).toBe(800_000)
  })
})

describe('la diferencia con total_calculado', () => {
  it('un día con tres cortesías infla el informe en tres tarifas', () => {
    const dia = [
      { r: reserva(), t: TIPOS.pasadia },
      { r: reserva(), t: TIPOS.pasadia },
      { r: reserva(), t: TIPOS.cortesia },
      { r: reserva(), t: TIPOS.cortesia },
      { r: reserva(), t: TIPOS.cortesia },
    ]

    const comoSumabaInformes = dia.reduce((s, x) => s + x.r.total_calculado, 0)
    const loQueDeVerdadSeCobra = dia.reduce((s, x) => s + valorACobrar(x.r, x.t), 0)

    expect(comoSumabaInformes).toBe(4_000_000)
    expect(loQueDeVerdadSeCobra).toBe(1_600_000)
  })
})
