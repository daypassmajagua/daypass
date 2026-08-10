import { describe, it, expect } from 'vitest'
import { valorACobrar, pagadoDe, saldoDe, diasDeDeuda, tramoDe } from './cartera'

/**
 * Lo que se cobra.
 *
 * La comprobación que importa es la primera: **cobrar no es multiplicar la
 * tarifa**. `total_calculado` da un número para toda reserva, incluidas las
 * cortesías —que por definición no se cobran— y las de proveedor, a las que se
 * les cobra el cupo o nada. Sumar esa columna a secas sería inventarle plata a
 * la cartera y salir a cobrarle a alguien que no debe.
 */

const RESERVA = {
  estado: 'completada',
  total_calculado: 1_200_000,
  cobra_cupo: null,
  valor_cupo: null,
}

const PASADIA     = { codigo: 'pasadia',     genera_ingreso: true }
const CORTESIA    = { codigo: 'cortesia',    genera_ingreso: false }
const ALOJAMIENTO = { codigo: 'alojamiento', genera_ingreso: false }
const EMPLEADO    = { codigo: 'empleado',    genera_ingreso: false }
const PROVEEDOR   = { codigo: 'proveedor',   genera_ingreso: null }
const GUIA        = { codigo: 'guia',        genera_ingreso: null }

describe('valorACobrar', () => {
  it('un pasadía se cobra completo', () => {
    expect(valorACobrar(RESERVA, PASADIA)).toBe(1_200_000)
  })

  it('una cortesía no se cobra, aunque la tarifa dé un número', () => {
    expect(valorACobrar(RESERVA, CORTESIA)).toBe(0)
  })

  it('alojamiento y empleado tampoco', () => {
    expect(valorACobrar(RESERVA, ALOJAMIENTO)).toBe(0)
    expect(valorACobrar(RESERVA, EMPLEADO)).toBe(0)
  })

  it('al proveedor se le cobra el cupo, no la tarifa', () => {
    const conCupo = { ...RESERVA, cobra_cupo: true, valor_cupo: 300_000 }
    expect(valorACobrar(conCupo, PROVEEDOR)).toBe(300_000)
  })

  it('y si no se le cobra el cupo, no se le cobra nada', () => {
    const sinCupo = { ...RESERVA, cobra_cupo: false, valor_cupo: 300_000 }
    expect(valorACobrar(sinCupo, PROVEEDOR)).toBe(0)
  })

  it('lo cancelado y lo que no llegó no se cobra', () => {
    expect(valorACobrar({ ...RESERVA, estado: 'cancelada' }, PASADIA)).toBe(0)
    expect(valorACobrar({ ...RESERVA, estado: 'noshow' }, PASADIA)).toBe(0)
  })

  it('ante una bandera sin definir se cobra: dejar de cobrar se descubre tarde', () => {
    expect(valorACobrar(RESERVA, GUIA)).toBe(1_200_000)
    expect(valorACobrar(RESERVA, undefined)).toBe(1_200_000)
  })
})

describe('lo que ya entró', () => {
  it('un pago anulado no cuenta', () => {
    const pagos = [
      { valor: 500_000, estado: 'verificado' },
      { valor: 200_000, estado: 'registrado' },
      { valor: 900_000, estado: 'anulado' },
    ]
    expect(pagadoDe(pagos)).toBe(700_000)
  })

  it('sin pagos, cero', () => {
    expect(pagadoDe()).toBe(0)
    expect(pagadoDe([])).toBe(0)
  })

  it('el saldo es lo que falta', () => {
    expect(saldoDe(RESERVA, PASADIA, [{ valor: 200_000, estado: 'verificado' }]))
      .toBe(1_000_000)
  })

  it('una cortesía con un pago por error queda en negativo, y eso se ve', () => {
    // No se corrige a cero a propósito: un saldo negativo es una señal de que
    // alguien cobró algo que no debía, y esconderlo sería perderla.
    expect(saldoDe(RESERVA, CORTESIA, [{ valor: 50_000, estado: 'verificado' }]))
      .toBe(-50_000)
  })
})

describe('la antigüedad se cuenta desde el pasadía', () => {
  it('una reserva futura no tiene mora', () => {
    // Vendida hoy para diciembre: no lleva meses debiendo.
    expect(diasDeDeuda('2026-12-20', '2026-08-10')).toBe(0)
  })

  it('cuenta los días corridos desde el día del tour', () => {
    expect(diasDeDeuda('2026-07-11', '2026-08-10')).toBe(30)
    expect(diasDeDeuda('2026-08-10', '2026-08-10')).toBe(0)
  })

  it('no se corre de día al cruzar el cambio de mes', () => {
    expect(diasDeDeuda('2026-07-31', '2026-08-01')).toBe(1)
  })
})

describe('los tramos', () => {
  it('reparte por los cortes que usa el hotel', () => {
    expect(tramoDe(0)).toBe('al_dia')
    expect(tramoDe(30)).toBe('al_dia')
    expect(tramoDe(31)).toBe('de_31_a_60')
    expect(tramoDe(60)).toBe('de_31_a_60')
    expect(tramoDe(61)).toBe('de_61_a_90')
    expect(tramoDe(90)).toBe('de_61_a_90')
    expect(tramoDe(91)).toBe('mas_de_90')
    expect(tramoDe(400)).toBe('mas_de_90')
  })
})
