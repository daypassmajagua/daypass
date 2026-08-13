import { describe, it, expect } from 'vitest'
import { parseReserva, leerFecha, leerCuantos, leerNombre, leerPlan } from './parseReserva'

/**
 * Los mensajes son reales en su forma: así escriben las agencias por WhatsApp,
 * con saludo, sin puntuación y con el dato importante en medio de la frase.
 *
 * Y la mitad de estas pruebas comprueba **lo que NO debe deducir**. Un campo
 * vacío cuesta un clic; uno mal deducido cuesta una reserva vendida al precio
 * equivocado o un cupo mal contado.
 */

const HOY = '2026-08-12'          // miércoles
const PLANES = [
  { id: 'p-gold', nombre: 'Rack Gold' },
  { id: 'p-silver', nombre: 'Rack Silver' },
  { id: 'p-diamond', nombre: 'Diamond' },
]
const AGENCIAS = [
  { id: 'a-avi', nombre: 'Aviatur' },
  { id: 'a-hb', nombre: 'Hotelbeds' },
]
const opciones = { hoy: HOY, planes: PLANES, agencias: AGENCIAS }

describe('cuándo', () => {
  it('mañana y pasado mañana', () => {
    expect(leerFecha('para mañana', HOY).fecha).toBe('2026-08-13')
    expect(leerFecha('pasado mañana', HOY).fecha).toBe('2026-08-14')
  })

  it('«pasado mañana» no se lee como «mañana»', () => {
    // La palabra «mañana» está dentro de «pasado mañana»: el orden de las
    // reglas es lo único que evita reservar un día antes.
    expect(leerFecha('pasado mañana', HOY).fecha).not.toBe('2026-08-13')
  })

  it('el 15 de agosto, con y sin tilde', () => {
    expect(leerFecha('el 15 de agosto', HOY).fecha).toBe('2026-08-15')
    expect(leerFecha('15 agosto', HOY).fecha).toBe('2026-08-15')
  })

  it('una fecha que ya pasó se entiende del año que viene', () => {
    expect(leerFecha('3 de marzo', HOY).fecha).toBe('2027-03-03')
  })

  it('día/mes, como se escribe en Colombia', () => {
    expect(leerFecha('el 15/08', HOY).fecha).toBe('2026-08-15')
    expect(leerFecha('20-12-2026', HOY).fecha).toBe('2026-12-20')
  })

  it('«el sábado» es el próximo, nunca el que pasó', () => {
    expect(leerFecha('para el sabado', HOY).fecha).toBe('2026-08-15')
  })

  it('sin fecha no inventa una', () => {
    expect(leerFecha('4 pax gold', HOY).fecha).toBeNull()
  })
})

describe('cuántos', () => {
  it('4 pax son 4 adultos', () => {
    expect(leerCuantos('somos 4 pax')).toEqual({ adultos: 4, ninos: 0, infantes: 0 })
  })

  it('la forma (x4) de las agencias', () => {
    expect(leerCuantos('Reserva: Rafael (x4)')).toEqual({ adultos: 4, ninos: 0, infantes: 0 })
  })

  it('desglosado', () => {
    expect(leerCuantos('2 adultos y 1 niño')).toEqual({ adultos: 2, ninos: 1, infantes: 0 })
  })

  it('el total incluye a los niños, no los suma aparte', () => {
    // «4 pax, 1 niño» son cuatro personas: 3 adultos y 1 niño. Sumarlos daría
    // 5 y la lancha contaría un cupo que nadie ocupa.
    expect(leerCuantos('4 pax, 1 niño')).toEqual({ adultos: 3, ninos: 1, infantes: 0 })
  })

  it('sin cantidad no inventa ninguna', () => {
    expect(leerCuantos('hola, quiero reservar')).toBeNull()
  })
})

describe('el nombre solo cuando la frase lo anuncia', () => {
  it('lo toma cuando está anunciado', () => {
    expect(leerNombre('a nombre de Rafael Gómez')).toBe('Rafael Gómez')
    expect(leerNombre('Reserva: Carolina Martínez')).toBe('Carolina Martínez')
  })

  it('le quita la cantidad pegada', () => {
    expect(leerNombre('Reserva: Rafael (x4)')).toBe('Rafael')
  })

  it('NO inventa un nombre de un texto cualquiera', () => {
    // Aquí no hay ninguna persona. Un parser optimista pondría «Playa Blanca»
    // de titular y esa reserva saldría a nombre de una playa.
    expect(leerNombre('Aviatur, 4 pax para Playa Blanca')).toBeNull()
    expect(leerNombre('buenas, tengo 4 personas para el sábado')).toBeNull()
  })
})

describe('el plan', () => {
  it('reconoce el nombre completo y el nivel suelto', () => {
    expect(leerPlan('plan Rack Gold', PLANES).id).toBe('p-gold')
    expect(leerPlan('quieren diamond', PLANES).id).toBe('p-diamond')
  })

  it('con dos planes del mismo nivel no adivina', () => {
    const ambiguos = [
      { id: 'a', nombre: 'Rack Gold' },
      { id: 'b', nombre: 'Corporativo Gold' },
    ]
    expect(leerPlan('quieren gold', ambiguos)).toBeNull()
  })
})

describe('el mensaje entero', () => {
  it('el caso que contaron en la reunión', () => {
    const { campos, origen } = parseReserva('Reserva: Rafael (x4)', opciones)
    expect(campos.nombre_pasajero).toBe('Rafael')
    expect(campos.adultos).toBe(4)
    expect(origen.pax).toContain('4 adultos')
  })

  it('un WhatsApp completo de agencia', () => {
    const { campos } = parseReserva(
      'Buenas! Para mañana 4 pax Rack Gold, a nombre de Rafael Gómez. Aviatur',
      opciones
    )
    expect(campos.fecha).toBe('2026-08-13')
    expect(campos.adultos).toBe(4)
    expect(campos.plan_id).toBe('p-gold')
    expect(campos.agencia_id).toBe('a-avi')
    expect(campos.nombre_pasajero).toBe('Rafael Gómez')
    expect(campos.tipo).toBe('grupo')      // agencia + varias personas
  })

  it('una sola persona de agencia no es grupo', () => {
    const { campos } = parseReserva('Aviatur, 1 pax para mañana', opciones)
    expect(campos.tipo).toBeUndefined()
  })

  it('de un mensaje sin datos no sale nada', () => {
    const { campos } = parseReserva('hola buenas tardes', opciones)
    expect(campos).toEqual({})
  })

  it('el vacío no revienta', () => {
    expect(parseReserva('', opciones).campos).toEqual({})
    expect(parseReserva(null, opciones).campos).toEqual({})
  })
})
