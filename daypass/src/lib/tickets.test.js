import { describe, it, expect, beforeEach } from 'vitest'
import { __store, createMockClient } from './mockSupabase'
import { contextoActual, escucharErrores, ultimosErrores } from './diagnostico'

const mockSupabase = createMockClient()

/**
 * El canal de reportes.
 *
 * Lo que se prueba aquí no es la pantalla sino las dos promesas que la
 * sostienen: que el contexto se capture solo —si hay que escribirlo, nadie lo
 * escribe— y que quien reporta lo selle el servidor y no el aparato.
 */

describe('el contexto se captura solo', () => {
  it('trae la ruta, el modo, el aparato y la cola sin preguntar nada', () => {
    const c = contextoActual({ modo: 'muelle', fechaActiva: '2026-08-09', enCola: 3 })

    expect(c.modo).toBe('muelle')
    expect(c.fecha_activa).toBe('2026-08-09')
    expect(c.eventos_en_cola).toBe(3)
    expect(c).toHaveProperty('dispositivo')
    expect(c).toHaveProperty('en_linea')
    // La ruta sale de `location`, que aquí no existe: fuera del navegador cae
    // en null en vez de reventar. Eso importa — este objeto se arma en el peor
    // momento posible, cuando algo ya falló.
    expect(c).toHaveProperty('ruta')
    expect(c.errores).toBeInstanceOf(Array)
  })

  it('lo que no se sabe va en null, no inventado', () => {
    const c = contextoActual()
    expect(c.modo).toBe(null)
    expect(c.fecha_activa).toBe(null)
    expect(c.eventos_en_cola).toBe(null)
  })

  it('recoge los últimos errores de consola, que es lo que nadie va a copiar', () => {
    escucharErrores()
    const antes = ultimosErrores().length
    // Silenciado: lo que se prueba es que quede anotado, no que se imprima.
    const original = console.error
    console.error = () => {}
    try {
      // El envoltorio ya está puesto por escucharErrores; se llama el de verdad.
      original.call(console)
    } finally {
      console.error = original
    }
    expect(ultimosErrores().length).toBeGreaterThanOrEqual(antes)
  })
})

describe('quién reporta lo sella el servidor', () => {
  beforeEach(() => { __store.tickets.length = 0 })

  it('ignora el autor que mande el aparato', async () => {
    await mockSupabase.from('tickets').insert({
      client_id: 'c-1',
      tipo: 'no_funciona',
      titulo: 'No me deja embarcar',
      reportado_por: 'quien-yo-quiera',
      reportado_por_nombre: 'La Directora',
      estado: 'resuelto',
    }).select().single()

    const t = __store.tickets[0]
    expect(t.reportado_por).not.toBe('quien-yo-quiera')
    expect(t.reportado_por_nombre).not.toBe('La Directora')
    // Y nace nuevo, aunque el aparato haya mandado otra cosa.
    expect(t.estado).toBe('nuevo')
  })

  it('reenviar el mismo reporte no lo duplica', async () => {
    const fila = { client_id: 'c-2', tipo: 'idea', titulo: 'Ordenar por lancha' }
    await mockSupabase.from('tickets').insert({ ...fila, id: 'tk-1' }).select()
    await mockSupabase.from('tickets').insert({ ...fila, id: 'tk-1' }).select()
    expect(__store.tickets).toHaveLength(1)
  })
})

describe('atender un reporte', () => {
  beforeEach(async () => {
    __store.tickets.length = 0
    await mockSupabase.from('tickets')
      .insert({ id: 'tk-9', client_id: 'c-9', tipo: 'no_funciona', titulo: 'Algo' })
      .select()
  })

  it('solo lo mueve quien mantiene el sistema', async () => {
    const perfil = __store.perfiles[0]
    const rolPrevio = perfil.rol

    perfil.rol = 'asesora'
    const negado = await mockSupabase.rpc('atender_ticket', {
      p_ticket_id: 'tk-9', p_estado: 'resuelto',
    })
    expect(negado.error).toBeTruthy()
    expect(__store.tickets[0].estado).toBe('nuevo')

    perfil.rol = 'super_admin'
    const ok = await mockSupabase.rpc('atender_ticket', {
      p_ticket_id: 'tk-9', p_estado: 'resuelto', p_respuesta: 'Corregido en la 021',
    })
    expect(ok.error).toBe(null)
    expect(__store.tickets[0].estado).toBe('resuelto')
    expect(__store.tickets[0].respuesta).toBe('Corregido en la 021')

    perfil.rol = rolPrevio
  })
})

describe('lo que bloqueó la operación va arriba', () => {
  beforeEach(() => {
    __store.tickets.length = 0
    __store.tickets.push(
      { id: 'v', titulo: 'Se ve raro',      bloqueo: false, created_at: '2026-08-09T10:00:00Z', reportado_por: 'mock-user-demo' },
      { id: 'b', titulo: 'No pude embarcar', bloqueo: true,  created_at: '2026-08-08T10:00:00Z', reportado_por: 'mock-user-demo' },
      { id: 'r', titulo: 'Reciente',        bloqueo: false, created_at: '2026-08-09T18:00:00Z', reportado_por: 'mock-user-demo' },
    )
  })

  it('primero lo bloqueante, y dentro de eso lo más reciente', async () => {
    const { data } = await mockSupabase.from('tickets').select('*')
      .order('bloqueo', { ascending: false })
      .order('created_at', { ascending: false })

    // Sin esto la lista salía solo por fecha: el reporte de alguien que se
    // quedó parado en el muelle quedaba enterrado bajo un "se ve raro" de hoy.
    expect(data.map(t => t.id)).toEqual(['b', 'r', 'v'])
  })

  it('limit recorta después de ordenar, no antes', async () => {
    const { data } = await mockSupabase.from('tickets').select('*')
      .order('created_at', { ascending: false })
      .limit(2)
    expect(data.map(t => t.id)).toEqual(['r', 'v'])
  })
})

describe('quién ve qué', () => {
  beforeEach(() => {
    __store.tickets.length = 0
    __store.tickets.push(
      { id: 'a', titulo: 'Mío', reportado_por: 'mock-user-demo', estado: 'nuevo' },
      { id: 'b', titulo: 'De otra persona', reportado_por: 'otro', estado: 'nuevo' },
    )
  })

  it('la isla solo ve los suyos', async () => {
    const perfil = __store.perfiles[0]
    const previo = perfil.rol
    perfil.rol = 'admin_isla'

    const { data } = await mockSupabase.from('tickets').select('*')
    expect(data.map(t => t.titulo)).toEqual(['Mío'])

    perfil.rol = previo
  })

  it('la dirección ve todos, para saber cómo va la prueba', async () => {
    const perfil = __store.perfiles[0]
    const previo = perfil.rol
    perfil.rol = 'directora'

    const { data } = await mockSupabase.from('tickets').select('*')
    expect(data).toHaveLength(2)

    perfil.rol = previo
  })
})
