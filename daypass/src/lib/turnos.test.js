import { describe, it, expect } from 'vitest'
import {
  estadoDelDia, puedeAsignar, diasDelMes, huecosAntes,
  mesAnterior, mesSiguiente, iniciales, CODIGOS,
} from './turnos'

describe('el estado de un día', () => {
  it('un día sin gente está quieto, aunque no tenga turnos', () => {
    // Lo importante de esta: marcar en rojo los martes que no operan es la
    // forma más rápida de que la gente aprenda a ignorar el rojo.
    expect(estadoDelDia({ pax: 0, turnos: {} })).toBe('quieto')
  })

  it('lo que ya pasó nunca se marca, tuviera turnos o no', () => {
    // El 4 de agosto no se puede repartir. Un mes entero en coral por días
    // que ya ocurrieron esconde el único día en el que sí hay que hacer algo.
    const ayer = { fecha: '2026-08-04', hoy: '2026-08-11' }
    expect(estadoDelDia({ ...ayer, pax: 30, turnos: {} })).toBe('pasado')
    expect(estadoDelDia({ ...ayer, pax: 0, turnos: {} })).toBe('pasado')
  })

  it('hoy sí se marca: todavía se puede repartir', () => {
    expect(estadoDelDia({ fecha: '2026-08-11', hoy: '2026-08-11', pax: 30, turnos: {} }))
      .toBe('pendiente')
  })

  it('con gente y sin quien embarque, está pendiente', () => {
    expect(estadoDelDia({ pax: 12, turnos: {} })).toBe('pendiente')
    expect(estadoDelDia({ pax: 12, turnos: { isla: 'a', recibimiento: 'b' } })).toBe('pendiente')
  })

  it('con embarque puesto y algo suelto, está incompleto', () => {
    expect(estadoDelDia({ pax: 12, turnos: { embarque: 'a' } })).toBe('incompleto')
    expect(estadoDelDia({ pax: 12, turnos: { embarque: 'a', isla: 'b' } })).toBe('incompleto')
  })

  it('con los tres puestos, está listo', () => {
    expect(estadoDelDia({ pax: 12, turnos: { embarque: 'a', isla: 'b', recibimiento: 'c' } }))
      .toBe('listo')
  })
})

describe('quién asigna qué', () => {
  it('la isla la asigna la dirección y nadie más', () => {
    expect(puedeAsignar('directora', 'isla')).toBe(true)
    expect(puedeAsignar('gerencia', 'isla')).toBe(true)
    expect(puedeAsignar('asesora', 'isla')).toBe(false)
    expect(puedeAsignar('asesora_comercial', 'isla')).toBe(false)
  })

  it('embarque y recibimiento se los reparten las asesoras', () => {
    expect(puedeAsignar('asesora', 'embarque')).toBe(true)
    expect(puedeAsignar('asesora_comercial', 'recibimiento')).toBe(true)
  })

  it('la isla no asigna turnos', () => {
    for (const tipo of CODIGOS) {
      expect(puedeAsignar('admin_isla', tipo)).toBe(false)
    }
  })
})

describe('el calendario', () => {
  it('agosto de 2026 tiene 31 días y arranca en sábado', () => {
    expect(diasDelMes('2026-08')).toHaveLength(31)
    expect(diasDelMes('2026-08')[0]).toBe('2026-08-01')
    // Semana de lunes a domingo: el 1 de agosto de 2026 es sábado, o sea
    // cinco casillas vacías antes.
    expect(huecosAntes('2026-08')).toBe(5)
  })

  it('febrero de 2028 tiene 29', () => {
    expect(diasDelMes('2028-02')).toHaveLength(29)
  })

  it('un lunes primero no deja huecos', () => {
    // 1 de junio de 2026 es lunes.
    expect(huecosAntes('2026-06')).toBe(0)
  })

  it('cambia de año en los bordes', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12')
    expect(mesSiguiente('2026-12')).toBe('2027-01')
    expect(mesSiguiente('2026-08')).toBe('2026-09')
  })
})

describe('las iniciales', () => {
  it('toma las dos primeras palabras', () => {
    expect(iniciales('Daniela Restrepo Gómez')).toBe('DR')
    expect(iniciales('Camila')).toBe('C')
    expect(iniciales('')).toBe('')
    expect(iniciales(null)).toBe('')
  })
})
