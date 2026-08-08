import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from './db'
import { resolverToken } from './precarga'

/**
 * De un QR a una reserva, sin red.
 *
 * El pase codifica `daypass:{token}`, pero al muelle puede llegar otra cosa:
 * un enlace completo que alguien pegó, o el token pelado. Si el lector solo
 * entendiera un formato, el que trajera otro se quedaría esperando mientras
 * 250 personas hacen fila.
 */

const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4'

describe('resolverToken', () => {
  beforeEach(async () => {
    await db.tokens.clear()
    await db.tokens.put({ token: TOKEN, registro_id: 'reserva-1' })
  })

  it('lee el formato del pase', async () => {
    expect(await resolverToken(`daypass:${TOKEN}`)).toBe('reserva-1')
  })

  it('lee el token pelado', async () => {
    expect(await resolverToken(TOKEN)).toBe('reserva-1')
  })

  it('lee el enlace completo', async () => {
    expect(await resolverToken(`https://daypass-seven.vercel.app/r/${TOKEN}`)).toBe('reserva-1')
  })

  it('lee el enlace con basura detrás', async () => {
    expect(await resolverToken(`https://majagua.co/r/${TOKEN}?utm=wa`)).toBe('reserva-1')
    expect(await resolverToken(`https://majagua.co/r/${TOKEN}#pase`)).toBe('reserva-1')
  })

  it('aguanta espacios alrededor', async () => {
    expect(await resolverToken(`  daypass:${TOKEN}  `)).toBe('reserva-1')
  })

  it('un token que no es de hoy no resuelve', async () => {
    expect(await resolverToken('daypass:token-de-otro-dia')).toBe(null)
  })

  it('un QR de otra cosa no resuelve', async () => {
    expect(await resolverToken('https://www.instagram.com/majagua')).toBe(null)
  })

  it('vacío no revienta', async () => {
    expect(await resolverToken('')).toBe(null)
    expect(await resolverToken(null)).toBe(null)
    expect(await resolverToken(undefined)).toBe(null)
  })
})
