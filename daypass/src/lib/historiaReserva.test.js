import { describe, it, expect } from 'vitest'
import { createMockClient } from './mockSupabase'

/**
 * La historia de una reserva: que la consulta traiga algo y que se lea.
 *
 * Se prueba aquí y no en la pantalla porque lo que puede estar mal son dos
 * cosas concretas —la forma de la consulta y el cruce del nombre— y las dos se
 * ven mejor sin navegador. El componente `HistoriaDeLaReserva` hace exactamente
 * estos dos pasos.
 *
 * El nombre de quién no viene en el `select`: `cambios_estado.registrado_por`
 * guarda el `user_id` y la llave apunta a `auth.users`, no a `perfiles`, así
 * que PostgREST no lo puede traer de un salto. Se piden los perfiles aparte y
 * se cruzan en el aparato. Si algún día eso se olvida, esta prueba lo dice.
 */
describe('qué le ha pasado a una reserva', () => {
  it('guarda el cambio de estado con su antes, su después y quién', async () => {
    const s = createMockClient()

    await s.from('registros').update({ estado: 'completada' }).eq('id', 'r-04')

    const [cambios, perfiles] = await Promise.all([
      s.from('cambios_estado').select('*').eq('registro_id', 'r-04')
        .order('ocurrido_at', { ascending: false }),
      s.from('perfiles').select('user_id, nombre'),
    ])

    expect(cambios.data).toHaveLength(1)
    const c = cambios.data[0]
    expect(c.estado_anterior).toBe('confirmada')
    expect(c.estado_nuevo).toBe('completada')
    // Manual: es la excepción auditada de la regla 3, y es lo único que la
    // línea de tiempo destaca.
    expect(c.origen).toBe('manual')

    const nombreDe = new Map((perfiles.data || []).map(p => [p.user_id, p.nombre]))
    expect(nombreDe.get(c.registrado_por)).toBeTruthy()
  })

  it('una reserva a la que nadie ha tocado no tiene historia', async () => {
    const s = createMockClient()
    const { data } = await s.from('cambios_estado').select('*').eq('registro_id', 'r-05')
    expect(data).toEqual([])
  })
})
