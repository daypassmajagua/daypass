import { describe, it, expect } from 'vitest'
import { plazasSinNombre, sePuedeNombrar } from './plazas'

/**
 * La suma de nombres y plazas sueltas tiene que dar el plan. Si no da, el
 * muelle embarca a más o a menos gente de la que la reserva pagó, y el
 * manifiesto declara mal.
 */

const total = (plan, conNombre, anonimos) =>
  conNombre + plazasSinNombre({ plan, conNombre, anonimos })

describe('la ida: nombres + plazas = plan', () => {
  it('un grupo sin ningún nombre son todas plazas', () => {
    expect(plazasSinNombre({ plan: 25, conNombre: 0, anonimos: 0 })).toBe(25)
    expect(total(25, 0, 0)).toBe(25)
  })

  it('con tres nombres quedan veintidós plazas', () => {
    expect(plazasSinNombre({ plan: 25, conNombre: 3, anonimos: 0 })).toBe(22)
    expect(total(25, 3, 0)).toBe(25)
  })

  it('nombrar una plaza no cambia el total', () => {
    expect(total(25, 3, 0)).toBe(25)
    expect(total(25, 4, 0)).toBe(25)   // se nombró una
    expect(total(25, 25, 0)).toBe(25)  // se nombraron todas
  })

  it('una reserva completa no tiene plazas sueltas', () => {
    expect(plazasSinNombre({ plan: 2, conNombre: 2, anonimos: 0 })).toBe(0)
  })

  it('un hecho registrado nunca queda invisible, aunque sobre', () => {
    // Se embarcaron 5 anónimos en una reserva que solo tenía 2 plazas libres:
    // pasó algo raro, pero esconder tres embarques sería peor.
    expect(plazasSinNombre({ plan: 10, conNombre: 8, anonimos: 5 })).toBe(5)
  })
})

describe('el regreso: caben los que subieron', () => {
  it('vuelven tantas plazas como subieron', () => {
    expect(plazasSinNombre({ plan: 25, conNombre: 3, anonimos: 0, esRegreso: true, subieron: 20 })).toBe(20)
  })

  it('el plan no manda de vuelta: mandan los que subieron', () => {
    // La reserva decía 25 pero solo subieron 12.
    expect(plazasSinNombre({ plan: 25, conNombre: 0, anonimos: 0, esRegreso: true, subieron: 12 })).toBe(12)
  })

  it('mas desembarques que embarques no agranda la lista', () => {
    expect(plazasSinNombre({ plan: 25, conNombre: 0, anonimos: 99, esRegreso: true, subieron: 12 })).toBe(12)
  })

  it('si no subió nadie de esa reserva, no vuelve nadie', () => {
    expect(plazasSinNombre({ plan: 25, conNombre: 3, anonimos: 0, esRegreso: true, subieron: 0 })).toBe(0)
  })
})

describe('cuándo se puede poner nombre', () => {
  const plaza = { tipo: 'sin_nombre', estado: null }

  it('a una plaza suelta que no ha subido, sí', () => {
    expect(sePuedeNombrar(plaza, { embarcado: false, cerrado: false })).toBe(true)
  })

  it('a una que ya subió, no: su embarque anónimo no se puede borrar', () => {
    expect(sePuedeNombrar(plaza, { embarcado: true, cerrado: false })).toBe(false)
  })

  it('con el zarpe cerrado, no', () => {
    expect(sePuedeNombrar(plaza, { embarcado: false, cerrado: true })).toBe(false)
  })

  it('a quien no llegó, no', () => {
    expect(sePuedeNombrar({ tipo: 'sin_nombre', estado: 'no_show' }, { embarcado: false, cerrado: false }))
      .toBe(false)
  })

  it('a quien ya tiene nombre, no hay nada que ponerle', () => {
    expect(sePuedeNombrar({ tipo: 'nominal', estado: null }, { embarcado: false, cerrado: false }))
      .toBe(false)
  })
})
