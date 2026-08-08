import { describe, it, expect } from 'vitest'
import { calcularConteoCocina } from './conteoCocina'

/**
 * De aquí sale cuánta comida se prepara. Un número de menos es alguien que se
 * queda sin almorzar en una isla, y un número de más es comida botada.
 *
 * Las dos rutas se prueban por separado a propósito: hasta la 014 el error de
 * los infantes vivía en las dos, y la de menú fijo —la que cuenta por los
 * contadores de la reserva— es la que más pesa, porque los grupos grandes
 * llegan sin listado.
 */

const GOLD = 'plan-gold'
const DIAMOND = 'plan-diamond'

const OPCIONES = [
  { id: 'op-pescado', plan_id: GOLD, nombre_es: 'Pescado frito', nombre_en: 'Fried fish', activo: true },
  { id: 'op-pollo', plan_id: GOLD, nombre_es: 'Pollo', nombre_en: 'Chicken', activo: true },
]

const reserva = (extra = {}) => ({
  id: 'r-1', estado: 'confirmada', plan_id: GOLD,
  adultos: 0, ninos: 0, infantes: 0, cortesias: 0,
  planes: { nombre: 'Gold' },
  ...extra,
})

const pax = (extra = {}) => ({
  id: 'p-' + Math.random().toString(36).slice(2),
  registro_id: 'r-1', nombre: 'Alguien', categoria: 'adulto',
  opcion_plato_id: null, almuerza: true,
  ...extra,
})

describe('los infantes almuerzan', () => {
  it('un infante con nombre cuenta como porción, en su línea', () => {
    const c = calcularConteoCocina(
      [reserva({ adultos: 2, infantes: 1 })],
      [pax({ opcion_plato_id: 'op-pescado' }), pax({ opcion_plato_id: 'op-pollo' }),
       pax({ categoria: 'infante' })],
      OPCIONES
    )
    expect(c.infantes).toBe(1)
    expect(c.totalAlmuerzos).toBe(3)
  })

  it('un infante NO se cuenta como "sin plato elegido"', () => {
    // El error fácil: como no tiene opcion_plato_id, caería en sinElegir y
    // cocina prepararía un plato del menú para un bebé de dos años.
    const c = calcularConteoCocina(
      [reserva({ adultos: 1, infantes: 1 })],
      [pax({ opcion_plato_id: 'op-pollo' }), pax({ categoria: 'infante' })],
      OPCIONES
    )
    expect(c.sinElegir).toBe(0)
    expect(c.infantes).toBe(1)
  })

  it('un infante SIN nombre también cuenta: sale de los contadores', () => {
    const c = calcularConteoCocina([reserva({ adultos: 2, infantes: 2 })], [], OPCIONES)
    expect(c.infantes).toBe(2)
    expect(c.sinElegir).toBe(2)      // los dos adultos, que sí eligen
    expect(c.totalAlmuerzos).toBe(4)
  })

  it('en menú fijo también cuentan, y aparte del plan', () => {
    // La ruta que más pesa: grupo grande, plan sin opciones, sin listado.
    const c = calcularConteoCocina(
      [reserva({ plan_id: DIAMOND, planes: { nombre: 'Diamond' }, adultos: 20, infantes: 3 })],
      [], OPCIONES
    )
    expect(c.filasMenuFijo).toEqual([{ plan: 'Diamond', cantidad: 20 }])
    expect(c.infantes).toBe(3)
    expect(c.totalAlmuerzos).toBe(23)
  })
})

describe('la excepción: alguien que no almuerza', () => {
  it('marcado como que no almuerza, no cuenta', () => {
    const c = calcularConteoCocina(
      [reserva({ adultos: 2 })],
      [pax({ opcion_plato_id: 'op-pollo' }), pax({ opcion_plato_id: 'op-pollo', almuerza: false })],
      OPCIONES
    )
    expect(c.filasPlato).toEqual([{ nombre: 'Pollo', plan: 'Gold', cantidad: 1 }])
    expect(c.totalAlmuerzos).toBe(1)
  })

  it('un infante marcado como que no almuerza tampoco cuenta', () => {
    const c = calcularConteoCocina(
      [reserva({ adultos: 1, infantes: 1 })],
      [pax({ opcion_plato_id: 'op-pollo' }), pax({ categoria: 'infante', almuerza: false })],
      OPCIONES
    )
    expect(c.infantes).toBe(0)
    expect(c.totalAlmuerzos).toBe(1)
  })

  it('en menú fijo, el que no almuerza se descuenta del plan', () => {
    const c = calcularConteoCocina(
      [reserva({ plan_id: DIAMOND, planes: { nombre: 'Diamond' }, adultos: 4 })],
      [pax({ almuerza: false })],
      OPCIONES
    )
    expect(c.filasMenuFijo).toEqual([{ plan: 'Diamond', cantidad: 3 }])
  })

  it('sin la 014 corrida, almuerza llega vacío y todos comen', () => {
    // Tolerancia al orden de despliegue: si el front sale antes que la
    // migración, el campo no existe y lo correcto es contar a todos.
    const sinCampo = { id: 'p-1', registro_id: 'r-1', categoria: 'adulto', opcion_plato_id: 'op-pollo' }
    const c = calcularConteoCocina([reserva({ adultos: 1 })], [sinCampo], OPCIONES)
    expect(c.totalAlmuerzos).toBe(1)
  })
})

describe('el total siempre cuadra con las líneas', () => {
  it('platos + menú fijo + sin elegir + infantes', () => {
    const c = calcularConteoCocina(
      [
        reserva({ id: 'r-1', adultos: 3, infantes: 1 }),
        reserva({ id: 'r-2', plan_id: DIAMOND, planes: { nombre: 'Diamond' }, adultos: 10, infantes: 2 }),
      ],
      [
        pax({ registro_id: 'r-1', opcion_plato_id: 'op-pescado' }),
        pax({ registro_id: 'r-1', opcion_plato_id: 'op-pescado' }),
      ],
      OPCIONES
    )
    const suma =
      c.filasPlato.reduce((s, f) => s + f.cantidad, 0) +
      c.filasMenuFijo.reduce((s, f) => s + f.cantidad, 0) +
      c.sinElegir + c.infantes
    expect(c.totalAlmuerzos).toBe(suma)
    expect(c.totalAlmuerzos).toBe(16)   // 3+1 de la primera, 10+2 de la segunda
  })

  it('lo cancelado y lo que no llegó no se cocina', () => {
    const c = calcularConteoCocina(
      [
        reserva({ id: 'r-1', adultos: 2, infantes: 1 }),
        reserva({ id: 'r-2', estado: 'cancelada', adultos: 10, infantes: 5 }),
        reserva({ id: 'r-3', estado: 'noshow', adultos: 4, infantes: 2 }),
      ],
      [], OPCIONES
    )
    expect(c.totalAlmuerzos).toBe(3)
    expect(c.infantes).toBe(1)
  })

  it('un día sin nadie da todo en cero', () => {
    const c = calcularConteoCocina([], [], OPCIONES)
    expect(c.totalAlmuerzos).toBe(0)
    expect(c.infantes).toBe(0)
    expect(c.filasPlato).toEqual([])
  })
})

describe('lo que ya funcionaba y no se puede romper', () => {
  it('cocina cuenta por plato, no por plan', () => {
    const c = calcularConteoCocina(
      [reserva({ adultos: 3 })],
      [
        pax({ opcion_plato_id: 'op-pescado' }),
        pax({ opcion_plato_id: 'op-pescado' }),
        pax({ opcion_plato_id: 'op-pollo' }),
      ],
      OPCIONES
    )
    expect(c.filasPlato).toEqual([
      { nombre: 'Pescado frito', plan: 'Gold', cantidad: 2 },
      { nombre: 'Pollo', plan: 'Gold', cantidad: 1 },
    ])
  })

  it('las cortesías comen', () => {
    const c = calcularConteoCocina([reserva({ adultos: 1, cortesias: 2 })], [], OPCIONES)
    expect(c.totalAlmuerzos).toBe(3)
  })

  it('las restricciones salen con su persona y su plato', () => {
    const c = calcularConteoCocina(
      [reserva({ adultos: 1, nombre_grupo: 'Boda Herrera' })],
      [pax({ nombre: 'Luis Cano', opcion_plato_id: 'op-pollo', restriccion_alimentaria: ' Sin gluten ' })],
      OPCIONES
    )
    expect(c.restricciones).toHaveLength(1)
    expect(c.restricciones[0]).toMatchObject({
      nombre: 'Luis Cano', nota: 'Sin gluten', plato: 'Pollo', grupo: 'Boda Herrera',
    })
  })
})
