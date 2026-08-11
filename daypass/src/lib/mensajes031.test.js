import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLANTILLA_RESPALDO } from './enlaceReserva'

/**
 * La migración 031 y el respaldo del código tienen que decir lo mismo.
 *
 * Es la promesa de esa migración: mover los mensajes a la base **no cambia lo
 * que recibe el cliente**. Si alguien retoca uno de los dos lados y se olvida
 * del otro, media operación queda mandando un texto y media otro, y eso no se
 * ve hasta que un cliente lo nota.
 *
 * Se lee el `.sql` como archivo: no hay base contra la cual probar aquí —y no
 * la va a haber, porque las migraciones las corre el dueño— pero el texto sí
 * se puede comparar.
 */

const SQL = new URL('../../supabase/migrations/031_los_mensajes_salen_del_codigo.sql', import.meta.url)

function mensajesDelSql() {
  const s = readFileSync(SQL, 'utf8')
  const bloques = [...s.matchAll(/\$msg\$([\s\S]*?)\$msg\$/g)].map(m => m[1])
  return { invitacion: bloques[0], pase: bloques[1], crudo: s }
}

describe('la 031 y el respaldo dicen lo mismo', () => {
  const { invitacion, pase, crudo } = mensajesDelSql()

  it('siembra exactamente dos mensajes', () => {
    expect((crudo.match(/\$msg\$/g) || []).length).toBe(4)
  })

  it('el de invitación es idéntico al del código', () => {
    expect(invitacion).toBe(PLANTILLA_RESPALDO.mensaje_invitacion)
  })

  it('el del pase es idéntico al del código', () => {
    expect(pase).toBe(PLANTILLA_RESPALDO.mensaje_pase)
  })

  /**
   * El error que costó una corrida: PostgreSQL concatena dos literales
   * separados por un salto de línea, pero solo el primero puede llevar el
   * prefijo `E`. El segundo se lee como un identificador y revienta.
   */
  it('no encadena literales con prefijo E', () => {
    expect(/E'[^']*'\s*\n\s*E'/.test(crudo)).toBe(false)
  })
})
