import { describe, it, expect, beforeEach } from 'vitest'
import { __store, createMockClient } from './mockSupabase'

const mockSupabase = createMockClient()

/**
 * Todo lleva firma.
 *
 * La regla 24 no es "que haya una columna con el autor": es que **el autor lo
 * ponga el servidor**. Un campo que el navegador puede mandar no es una firma,
 * es un campo más que cualquiera escribe con lo que quiera desde la API — y
 * así estaba `ajustes` hasta la migración 024.
 *
 * Por eso lo que se prueba aquí no es que la columna se llene, sino que se
 * llene **con quien de verdad está en la sesión, pisando lo que venga**.
 */

const YO = 'mock-user-demo'

describe('el servidor firma, el cliente no', () => {
  beforeEach(() => {
    __store.pagos.length = 0
    __store.personas.length = 0
    __store.tiquetes_lotes.length = 0
  })

  it('pone quién creó la fila sin que nadie lo mande', async () => {
    const { data } = await mockSupabase.from('pagos').insert({
      registro_id: 'r-1', fecha: '2026-08-10', valor: 100000, medio: 'efectivo',
    }).select().single()

    expect(data.creado_por).toBe(YO)
    expect(data.actualizado_por).toBe(YO)
  })

  it('ignora el autor que mande el cliente', async () => {
    const { data } = await mockSupabase.from('pagos').insert({
      registro_id: 'r-2', fecha: '2026-08-10', valor: 50000, medio: 'efectivo',
      creado_por: 'la-directora',
      actualizado_por: 'la-directora',
    }).select().single()

    // Si esto pasara, la firma no valdría nada: cualquiera podría atribuirle
    // a otro un pago que él registró.
    expect(data.creado_por).not.toBe('la-directora')
    expect(data.creado_por).toBe(YO)
  })

  it('al modificar, quién creó no se reescribe', async () => {
    await mockSupabase.from('pagos').insert({
      id: 'pg-1', registro_id: 'r-3', fecha: '2026-08-10', valor: 10000, medio: 'efectivo',
    }).select().single()
    // Se simula que la creó otra persona, antes.
    __store.pagos.find(p => p.id === 'pg-1').creado_por = 'alguien-mas'

    await mockSupabase.from('pagos').update({ soporte: 'REF-9' }).eq('id', 'pg-1')

    const fila = __store.pagos.find(p => p.id === 'pg-1')
    expect(fila.creado_por).toBe('alguien-mas')   // el pasado no se reescribe
    expect(fila.actualizado_por).toBe(YO)          // quién la tocó de último, sí
  })

  it('la reserva firma con `generada_por` y no inventa una segunda columna', async () => {
    const { data } = await mockSupabase.from('registros').insert({
      fecha: '2026-08-11', tipo: 'individual', estado: 'confirmada',
      nombre_pasajero: 'Prueba', adultos: 1, ninos: 0, infantes: 0, cortesias: 0,
      lancha_id: 'l-1', plan_id: 'p-1', canal_id: 'c-1', temporada: 'baja',
    }).select().single()

    expect(data.generada_por).toBe(YO)
    expect(data.creado_por).toBeUndefined()
    expect(data.actualizado_por).toBe(YO)
  })

  it('la bitácora no se firma dos veces: ya lleva quién', async () => {
    __store.bitacora.length = 0
    await mockSupabase.from('bitacora').insert({
      id: 1, accion: 'prueba', nombre: 'Alguien', creado_por: 'no-deberia',
    }).select()

    // No se le pone `actualizado_por`: su autor es `user_id`/`nombre`, y
    // duplicarlo sería tener dos columnas para el mismo dato.
    expect(__store.bitacora[0].actualizado_por).toBeUndefined()
  })
})
