import { describe, it, expect } from 'vitest'
import { veredictoDePase } from './veredictoPase'

/**
 * Los cuatro veredictos del pase.
 *
 * Lo que se fija aquí no es el texto —eso se puede afinar— sino **cuál de los
 * cuatro corresponde en cada caso**, porque de eso depende qué sonido suena y
 * de qué color se pinta la franja. Confundir «ya subió» con «no es de hoy»
 * significa que alguien oye una alarma cuando todo estaba bien, y en el muelle
 * eso detiene la fila.
 */

const grupo = (nombre, total, embarcados) => ({
  registro: { nombre_grupo: nombre },
  filas: Array.from({ length: total }, (_, i) => ({ id: i })),
  embarcados,
})

describe('cuando el pase no resuelve', () => {
  it('sin registro es «no es de hoy», no un error genérico', () => {
    const v = veredictoDePase({ registroId: null })
    expect(v.tipo).toBe('no_encontrado')
    // Y siempre dice qué hacer: el QR nunca es requisito para embarcar.
    expect(v.detalle).toMatch(/nombre/i)
  })
})

describe('cuando es de hoy pero no de esta lancha', () => {
  it('lo dice así, que es el caso que de verdad ocurre en La Bodeguita', () => {
    const v = veredictoDePase({ registroId: 'r-1', grupo: null })
    expect(v.tipo).toBe('otra_lancha')
    expect(v.titulo).toMatch(/otra lancha/i)
  })
})

describe('cuando sí es de esta lancha', () => {
  it('el título es el NOMBRE, no un mensaje al del iPad', () => {
    // Quien está en la fila ve el suyo en grande y sabe que ya pasó. Eso calma
    // una fila más que cualquier mensaje dirigido a quien sostiene el aparato.
    const v = veredictoDePase({ registroId: 'r-1', grupo: grupo('Familia Herrera', 4, 0) })
    expect(v.tipo).toBe('ok')
    expect(v.titulo).toBe('Familia Herrera')
  })

  it('con nadie a bordo dice cuántos son', () => {
    const v = veredictoDePase({ registroId: 'r-1', grupo: grupo('Grupo Aviatur', 24, 0) })
    expect(v.detalle).toBe('24 personas')
  })

  it('una sola persona no se dice en plural', () => {
    const v = veredictoDePase({ registroId: 'r-1', grupo: grupo('Ana Ríos', 1, 0) })
    expect(v.detalle).toBe('1 persona')
  })

  it('a medio embarcar dice cuántos van', () => {
    const v = veredictoDePase({ registroId: 'r-1', grupo: grupo('Grupo Aviatur', 24, 9) })
    expect(v.tipo).toBe('ok')
    expect(v.detalle).toBe('9 de 24 ya a bordo')
  })

  it('con todos arriba es «repetido», no «ok»', () => {
    // Es la distinción que más importa: informa, no regaña, y suena distinto
    // de un error.
    const v = veredictoDePase({ registroId: 'r-1', grupo: grupo('Familia Herrera', 4, 4) })
    expect(v.tipo).toBe('repetido')
    expect(v.titulo).toBe('Familia Herrera')
  })
})

describe('en el regreso el idioma cambia', () => {
  it('se baja, no se sube', () => {
    const medio = veredictoDePase({
      registroId: 'r-1', grupo: grupo('Grupo Aviatur', 24, 9), esRegreso: true,
    })
    expect(medio.detalle).toBe('9 de 24 ya bajaron')

    const todos = veredictoDePase({
      registroId: 'r-1', grupo: grupo('Grupo Aviatur', 24, 24), esRegreso: true,
    })
    expect(todos.tipo).toBe('repetido')
    expect(todos.detalle).toMatch(/bajaron/)
  })
})

describe('los bordes que no pueden reventar en el muelle', () => {
  it('un grupo sin nombre no deja el título vacío', () => {
    const v = veredictoDePase({ registroId: 'r-1', grupo: { registro: {}, filas: [], embarcados: 0 } })
    expect(v.titulo).toBe('Sin nombre')
  })

  it('un grupo sin filas no se marca como ya embarcado', () => {
    // 0 >= 0 sería «ya están todos» y diría «ya está a bordo — los 0».
    const v = veredictoDePase({ registroId: 'r-1', grupo: { registro: { nombre_grupo: 'X' }, filas: [], embarcados: 0 } })
    expect(v.tipo).toBe('ok')
  })
})
