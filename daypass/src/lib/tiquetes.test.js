import { describe, it, expect, beforeEach } from 'vitest'
import { __store, createMockClient } from './mockSupabase'

const mockSupabase = createMockClient()

/**
 * El consumo de tiquetes.
 *
 * Lo que se prueba aquí es una sola cosa, y es la que justifica construir el
 * kardex: **que se cuenten los huéspedes de alojamiento**. La planilla del
 * hotel no los suma —de ahí vienen sus saldos cortos— y el plan pedía
 * "consumo derivado del embarque", que habría copiado el error: alojamiento
 * consume tiquete (regla 11) pero no está en `embarques`, viaja por
 * `zarpe_alojamiento`.
 *
 * Si algún día alguien simplifica el conteo a `embarques` a secas, esta
 * comprobación se cae antes de que el saldo empiece a mentir.
 */

const FECHA = '2026-08-20'

function sembrarDia({ pasajeros = 0, alojados = 0, walkIns = 0, tipoIngreso } = {}) {
  __store.zarpes.length = 0
  __store.embarques.length = 0
  __store.zarpe_alojamiento.length = 0
  __store.registros.length = 0

  __store.zarpes.push({ id: 'z-ida', fecha: FECHA, sentido: 'ida', estado: 'zarpado' })

  if (pasajeros) {
    __store.registros.push({
      id: 'r-1', fecha: FECHA, estado: 'confirmada',
      adultos: pasajeros, ninos: 0, infantes: 0, cortesias: 0,
      tipo_ingreso_id: tipoIngreso || null,
    })
    for (let i = 0; i < pasajeros; i++) {
      __store.embarques.push({
        id: `e-${i}`, client_id: `c-${i}`, zarpe_id: 'z-ida', registro_id: 'r-1',
        pasajero_id: `p-${i}`, evento: 'check_in', ocurrido_at: `${FECHA}T08:2${i}:00Z`,
      })
    }
  }

  for (let i = 0; i < walkIns; i++) {
    __store.embarques.push({
      id: `w-${i}`, client_id: `cw-${i}`, zarpe_id: 'z-ida', registro_id: null,
      pasajero_id: null, nombre: `Walk ${i}`, evento: 'walk_in',
      ocurrido_at: `${FECHA}T08:3${i}:00Z`,
    })
  }

  for (let i = 0; i < alojados; i++) {
    __store.zarpe_alojamiento.push({
      id: `a-${i}`, zarpe_id: 'z-ida', nombre: `Huésped ${i}`,
    })
  }
}

const contar = () => mockSupabase.rpc('consumo_tiquetes_del_dia', { p_fecha: FECHA })

describe('el consumo cuenta las tres poblaciones', () => {
  it('los huéspedes de alojamiento SUMAN aunque no estén en embarques', async () => {
    sembrarDia({ pasajeros: 20, alojados: 4 })
    const { data } = await contar()

    expect(data.con_reserva).toBe(20)
    expect(data.alojamiento).toBe(4)
    // 24, no 20. Este número es la corrección entera.
    expect(data.total).toBe(24)
  })

  it('un día de solo alojados no da cero', async () => {
    sembrarDia({ alojados: 3 })
    const { data } = await contar()
    expect(data.total).toBe(3)
  })

  it('el walk-in sin reserva también consume', async () => {
    sembrarDia({ pasajeros: 5, walkIns: 2 })
    const { data } = await contar()
    expect(data.walk_in_sin_reserva).toBe(2)
    expect(data.total).toBe(7)
  })

  it('quien no consume tiquete no se cuenta', async () => {
    const empleado = __store.tipos_ingreso.find(t => t.codigo === 'empleado')
    sembrarDia({ pasajeros: 6, tipoIngreso: empleado.id })
    const { data } = await contar()
    expect(data.con_reserva).toBe(0)
    expect(data.total).toBe(0)
  })

  it('ante un tipo sin definir se cuenta: un tiquete de menos deja a alguien en tierra', async () => {
    const guia = __store.tipos_ingreso.find(t => t.codigo === 'guia')   // banderas en null
    sembrarDia({ pasajeros: 3, tipoIngreso: guia.id })
    const { data } = await contar()
    expect(data.total).toBe(3)
  })

  it('el desglose viaja con el total, para poder auditarlo', async () => {
    sembrarDia({ pasajeros: 10, alojados: 2, walkIns: 1 })
    const { data } = await contar()
    expect(data).toMatchObject({
      fecha: FECHA, con_reserva: 10, walk_in_sin_reserva: 1, alojamiento: 2, total: 13,
    })
  })
})

describe('la alerta del cierre', () => {
  beforeEach(() => {
    __store.movimientos_tiquete.length = 0
    __store.registros.length = 0
  })

  const manana = '2026-08-21'
  const sembrarManana = pax => __store.registros.push({
    id: 'r-m', fecha: manana, estado: 'confirmada',
    adultos: pax, ninos: 0, infantes: 0, cortesias: 0, tipo_ingreso_id: null,
  })

  it('avisa cuántos faltan cuando no alcanzan', async () => {
    __store.movimientos_tiquete.push(
      { tipo: 'zarpe', clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 30 },
      { tipo: 'parque', clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 30 },
    )
    sembrarManana(87)

    const { data } = await mockSupabase.rpc('alerta_tiquetes', { p_fecha: FECHA })
    expect(data.fecha).toBe(manana)
    expect(data.necesita).toBe(87)
    expect(data.alcanza).toBe(false)
    expect(data.faltan).toBe(57)
  })

  it('manda el tipo que menos tiene: alcanza para el día, no para el promedio', async () => {
    __store.movimientos_tiquete.push(
      { tipo: 'zarpe', clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 200 },
      { tipo: 'parque', clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 10 },
    )
    sembrarManana(40)

    const { data } = await mockSupabase.rpc('alerta_tiquetes', { p_fecha: FECHA })
    expect(data.alcanza).toBe(false)
    expect(data.faltan).toBe(30)
  })

  it('cuando alcanza, alcanza', async () => {
    __store.movimientos_tiquete.push(
      { tipo: 'zarpe', clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 100 },
      { tipo: 'parque', clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 100 },
    )
    sembrarManana(35)

    const { data } = await mockSupabase.rpc('alerta_tiquetes', { p_fecha: FECHA })
    expect(data.alcanza).toBe(true)
    expect(data.faltan).toBe(0)
  })

  it('el consumo descuenta del saldo', async () => {
    __store.movimientos_tiquete.push(
      { tipo: 'zarpe', clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 100 },
      { tipo: 'zarpe', clase: 'consumo', fecha: FECHA, cantidad: -24 },
    )
    const { data } = await mockSupabase.rpc('saldo_tiquetes')
    expect(data.find(s => s.tipo === 'zarpe').saldo).toBe(76)
  })
})
