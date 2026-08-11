import { describe, it, expect, afterEach } from 'vitest'
import { isMock } from './supabase'
import { __store } from './mockSupabase'
import { loQueFalta } from './listoParaOperar'

/**
 * Que la app sepa decir qué le falta para operar.
 *
 * Esto reemplaza a un pendiente que vivía en un documento: «cargar los
 * catálogos reales». Un documento funciona una vez; esto funciona también el
 * día que se monte otro entorno o que alguien desactive la última lancha.
 *
 * Se prueba vaciando el almacén del mock, que es lo mismo que le pasa a una
 * base recién montada.
 */

describe('contra qué se prueba', () => {
  it('nunca contra la base real', () => {
    expect(isMock).toBe(true)
  })
})

describe('lo que falta para operar', () => {
  const guardado = {}

  function vaciar(tabla) {
    guardado[tabla] = __store[tabla]
    __store[tabla] = []
  }

  afterEach(() => {
    for (const [tabla, filas] of Object.entries(guardado)) __store[tabla] = filas
  })

  it('con todo cargado no falta nada', async () => {
    expect(await loQueFalta()).toEqual([])
  })

  it('sin lanchas no se puede crear una reserva', async () => {
    vaciar('lanchas')
    const falta = await loQueFalta()
    expect(falta.map(f => f.id)).toEqual(['lanchas'])
    expect(falta[0].detiene).toBe('la reserva')
  })

  /**
   * La más importante de todas: **no detiene nada**, y por eso es la que
   * pasaría desapercibida. Sin temporadas el sistema asume «baja» y congela
   * ese precio (regla 4) en una fecha de temporada alta.
   */
  it('sin temporadas avisa, aunque la reserva sí se pueda crear', async () => {
    vaciar('temporadas')
    const falta = await loQueFalta()
    expect(falta.map(f => f.id)).toEqual(['temporadas'])
    expect(falta[0].detiene).toBe('el precio')
    expect(falta[0].detalle).toMatch(/congela/)
  })

  it('lo que detiene la reserva va primero', async () => {
    vaciar('pilotos')      // detiene el zarpe
    vaciar('temporadas')   // detiene el precio
    vaciar('planes')       // detiene la reserva
    const falta = await loQueFalta()
    expect(falta.map(f => f.detiene)).toEqual(['la reserva', 'el precio', 'el zarpe'])
  })

  it('una lancha desactivada no cuenta como lancha', async () => {
    // Se desactivan, nunca se borran; pero una flota entera desactivada deja
    // el sistema tan inservible como una vacía.
    const antes = __store.lanchas
    __store.lanchas = antes.map(l => ({ ...l, activa: false }))
    const falta = await loQueFalta()
    __store.lanchas = antes
    expect(falta.map(f => f.id)).toContain('lanchas')
  })
})
