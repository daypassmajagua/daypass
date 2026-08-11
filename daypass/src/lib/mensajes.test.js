import { describe, it, expect } from 'vitest'
import { isMock } from './supabase'
import {
  llenarPlantilla, plantillaDe, PLANTILLA_RESPALDO, MARCAS,
} from './enlaceReserva'

/**
 * Los mensajes que recibe el cliente.
 *
 * Estaban escritos en el código. La 031 los mueve a `ajustes` para que los
 * edite quien los manda (regla 22), y lo que hay que garantizar es que ese
 * movimiento no le cambie una coma a lo que llega al teléfono de nadie.
 */

describe('contra qué se prueba', () => {
  it('nunca contra la base real', () => {
    expect(isMock).toBe(true)
  })
})

describe('las marcas', () => {
  it('reemplaza las tres', () => {
    const texto = llenarPlantilla('Hola {nombre}, el {fecha}: {enlace}', {
      nombre: 'Ana', fecha: '3 de agosto', enlace: 'https://x.co/r/abc',
    })
    expect(texto).toBe('Hola Ana, el 3 de agosto: https://x.co/r/abc')
  })

  it('reemplaza todas las apariciones, no solo la primera', () => {
    expect(llenarPlantilla('{nombre} y {nombre}', { nombre: 'Ana' })).toBe('Ana y Ana')
  })

  it('lo que no reconoce lo deja a la vista', () => {
    // A propósito: una marca inventada que desapareciera dejaría un mensaje
    // con un hueco y nadie sabría por qué.
    expect(llenarPlantilla('Hola {apodo}', { nombre: 'Ana' })).toBe('Hola {apodo}')
  })

  it('un dato que falta no escribe «undefined»', () => {
    expect(llenarPlantilla('Hola {nombre}', {})).toBe('Hola ')
  })

  it('las marcas que se documentan son las que se reemplazan', () => {
    const documentadas = MARCAS.map(m => m.marca).sort()
    expect(documentadas).toEqual(['{enlace}', '{fecha}', '{nombre}'])
  })
})

describe('de dónde sale la plantilla', () => {
  it('los dos mensajes tienen respaldo en el código', () => {
    for (const clave of ['mensaje_invitacion', 'mensaje_pase']) {
      expect(PLANTILLA_RESPALDO[clave]).toBeTruthy()
      // Sin {enlace} el mensaje llega y no lleva a ninguna parte.
      expect(PLANTILLA_RESPALDO[clave]).toContain('{enlace}')
      expect(PLANTILLA_RESPALDO[clave]).toContain('{nombre}')
    }
  })

  it('trae el de la base cuando existe', async () => {
    const texto = await plantillaDe('mensaje_invitacion')
    expect(texto).toContain('{enlace}')
    expect(texto).toContain('Capitanía')
  })

  it('cae en el respaldo si el ajuste no existe', async () => {
    const texto = await plantillaDe('mensaje_que_no_existe')
    expect(texto).toBe('')
  })
})
