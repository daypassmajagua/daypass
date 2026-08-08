import { describe, it, expect } from 'vitest'
import { armarManifiesto, documentoLegible } from './manifiesto'

/**
 * El manifiesto es el documento que se le entrega a la Capitanía de Puerto.
 * Si dice menos gente de la que va a bordo, la lancha zarpa con una
 * declaración falsa. Por eso lo que más se prueba aquí es que nadie se caiga
 * de la lista.
 */

const PAISES = [
  { id: 'p-co', nombre: 'Colombia' },
  { id: 'p-de', nombre: 'Alemania' },
]

const base = () => ({
  registros: [
    { id: 'r1', nombre_pasajero: 'Ana Ruiz', nombre_grupo: null,
      adultos: 2, ninos: 0, infantes: 0, cortesias: 0 },
    { id: 'r2', nombre_pasajero: 'Contacto Hotelbeds', nombre_grupo: 'Boda Herrera',
      adultos: 4, ninos: 0, infantes: 0, cortesias: 0 },
  ],
  pasajeros: [
    { id: 'x1', registro_id: 'r1', nombre: 'Ana Ruiz',
      tipo_documento: 'cc', documento: '1020', pais_id: 'p-co', categoria: 'adulto' },
    { id: 'x2', registro_id: 'r1', nombre: 'Bruno Weber',
      tipo_documento: 'pasaporte', documento: 'X99', pais_id: 'p-de', categoria: 'adulto' },
  ],
  estados: [],
  empleados: [
    { id: 'e1', nombre: 'Luis Pérez', tipo_documento: 'cc', documento: '77', pais_id: 'p-co' },
    { id: 'e2', nombre: 'Sin marcar', tipo_documento: 'cc', documento: '88', pais_id: 'p-co' },
  ],
  zarpeEmpleados: [],
  alojamiento: [],
  pilotos: [{ id: 'pi1', nombre: 'Capi Rojas', tipo_documento: 'cc', documento: '55', pais_id: 'p-co' }],
  paises: PAISES,
})

const zarpe = { id: 'z1', piloto_id: 'pi1' }

describe('quién entra en el manifiesto', () => {
  it('lleva a los que subieron', () => {
    const d = base()
    d.estados = [
      { zarpe_id: 'z1', pasajero_id: 'x1', registro_id: 'r1', estado: 'check_in' },
      { zarpe_id: 'z1', pasajero_id: 'x2', registro_id: 'r1', estado: 'check_in' },
    ]
    const m = armarManifiesto(zarpe, d)
    expect(m.filas.filter(f => f.grupo === 'pasajero').map(f => f.nombre))
      .toEqual(['Ana Ruiz', 'Bruno Weber'])
  })

  it('deja fuera al que no llegó — no está a bordo', () => {
    const d = base()
    d.estados = [
      { zarpe_id: 'z1', pasajero_id: 'x1', registro_id: 'r1', estado: 'check_in' },
      { zarpe_id: 'z1', pasajero_id: 'x2', registro_id: 'r1', estado: 'no_show' },
    ]
    const m = armarManifiesto(zarpe, d)
    expect(m.pasajeros).toBe(1)
    expect(m.filas.some(f => f.nombre === 'Bruno Weber')).toBe(false)
  })

  it('lleva al walk-in, que subió sin reserva', () => {
    const d = base()
    d.estados = [{
      zarpe_id: 'z1', client_id: 'c1', estado: 'walk_in',
      nombre: 'Zoe Llegó', tipo_documento: 'ce', documento: '404', pais_id: 'p-de',
    }]
    const m = armarManifiesto(zarpe, d)
    const zoe = m.filas.find(f => f.nombre === 'Zoe Llegó')
    expect(zoe.walkIn).toBe(true)
    expect(zoe.pais).toBe('Alemania')
    expect(zoe.documento).toBe('404')
  })

  it('cuenta las plazas que subieron sin nombre en vez de esconderlas', () => {
    const d = base()
    d.estados = [
      { zarpe_id: 'z1', registro_id: 'r2', client_id: 'a1', estado: 'check_in' },
      { zarpe_id: 'z1', registro_id: 'r2', client_id: 'a2', estado: 'check_in' },
      { zarpe_id: 'z1', registro_id: 'r2', client_id: 'a3', estado: 'check_in' },
    ]
    const m = armarManifiesto(zarpe, d)
    expect(m.sinNombre).toBe(3)
    expect(m.pasajeros).toBe(3)
    const anon = m.filas.filter(f => f.sinNombre)
    expect(anon.every(f => f.reserva === 'Boda Herrera')).toBe(true)
    expect(anon.map(f => f.posicion)).toEqual([1, 2, 3])
  })

  it('numera las plazas sin nombre después de las que sí lo tienen', () => {
    const d = base()
    d.pasajeros.push({
      id: 'y1', registro_id: 'r2', nombre: 'Uno Conocido',
      tipo_documento: 'cc', documento: '1', pais_id: 'p-co', categoria: 'adulto',
    })
    d.estados = [
      { zarpe_id: 'z1', pasajero_id: 'y1', registro_id: 'r2', estado: 'check_in' },
      { zarpe_id: 'z1', registro_id: 'r2', client_id: 'a1', estado: 'check_in' },
    ]
    const m = armarManifiesto(zarpe, d)
    expect(m.filas.find(f => f.sinNombre).posicion).toBe(2)
  })
})

describe('la tripulación', () => {
  it('mete al piloto del zarpe', () => {
    const m = armarManifiesto(zarpe, base())
    const p = m.filas.find(f => f.grupo === 'tripulacion')
    expect(p.nombre).toBe('Capi Rojas')
    expect(p.cargo).toBe('Piloto')
    expect(m.piloto.id).toBe('pi1')
  })

  it('solo mete a los empleados marcados en ese zarpe', () => {
    const d = base()
    d.zarpeEmpleados = [{ zarpe_id: 'z1', empleado_id: 'e1' }]
    const m = armarManifiesto(zarpe, d)
    const nombres = m.filas.filter(f => f.grupo === 'tripulacion').map(f => f.nombre)
    expect(nombres).toContain('Luis Pérez')
    expect(nombres).not.toContain('Sin marcar')
    expect(m.tripulacion).toBe(2)   // el piloto y Luis
  })

  it('aguanta un zarpe sin piloto asignado', () => {
    const m = armarManifiesto({ id: 'z1', piloto_id: null }, base())
    expect(m.piloto).toBe(null)
    expect(m.tripulacion).toBe(0)
  })
})

describe('los huéspedes de alojamiento', () => {
  it('van en la lista aunque no sean pasadía', () => {
    const d = base()
    d.alojamiento = [{
      id: 'al1', zarpe_id: 'z1', nombre: 'Huésped Suite',
      tipo_documento: 'pasaporte', documento: 'P1', pais_id: 'p-de',
    }]
    const m = armarManifiesto(zarpe, d)
    expect(m.alojados).toBe(1)
    expect(m.filas.find(f => f.grupo === 'alojamiento').pais).toBe('Alemania')
  })
})

describe('el orden y los totales', () => {
  it('pasajeros, después alojamiento, después tripulación', () => {
    const d = base()
    d.estados = [{ zarpe_id: 'z1', pasajero_id: 'x1', registro_id: 'r1', estado: 'check_in' }]
    d.alojamiento = [{ id: 'al1', zarpe_id: 'z1', nombre: 'Huésped', documento: 'P1' }]
    d.zarpeEmpleados = [{ zarpe_id: 'z1', empleado_id: 'e1' }]
    const m = armarManifiesto(zarpe, d)
    expect(m.filas.map(f => f.grupo))
      .toEqual(['pasajero', 'alojamiento', 'tripulacion', 'tripulacion'])
  })

  it('el total es la suma de las tres poblaciones', () => {
    const d = base()
    d.estados = [
      { zarpe_id: 'z1', pasajero_id: 'x1', registro_id: 'r1', estado: 'check_in' },
      { zarpe_id: 'z1', registro_id: 'r2', client_id: 'a1', estado: 'check_in' },
    ]
    d.alojamiento = [{ id: 'al1', zarpe_id: 'z1', nombre: 'Huésped', documento: 'P1' }]
    d.zarpeEmpleados = [{ zarpe_id: 'z1', empleado_id: 'e1' }]
    const m = armarManifiesto(zarpe, d)
    expect(m.pasajeros).toBe(2)
    expect(m.alojados).toBe(1)
    expect(m.tripulacion).toBe(2)
    expect(m.total).toBe(5)
    expect(m.total).toBe(m.filas.length)
  })

  it('avisa cuántos van sin documento, que es lo que la Capitanía reclama', () => {
    const d = base()
    d.pasajeros[1].documento = null
    d.estados = [
      { zarpe_id: 'z1', pasajero_id: 'x1', registro_id: 'r1', estado: 'check_in' },
      { zarpe_id: 'z1', pasajero_id: 'x2', registro_id: 'r1', estado: 'check_in' },
    ]
    const m = armarManifiesto(zarpe, d)
    expect(m.sinDocumento).toBe(1)
  })

  it('un zarpe vacío no revienta', () => {
    const m = armarManifiesto({ id: 'z1', piloto_id: null }, {})
    expect(m.filas).toEqual([])
    expect(m.total).toBe(0)
  })
})

describe('cómo se lee el documento', () => {
  it('antepone el tipo', () => {
    expect(documentoLegible({ tipo_documento: 'cc', documento: '1020' })).toBe('C.C. 1020')
    expect(documentoLegible({ tipo_documento: 'pasaporte', documento: 'X99' })).toBe('Pasaporte X99')
  })
  it('sin documento no inventa nada', () => {
    expect(documentoLegible({ tipo_documento: 'cc', documento: null })).toBe(null)
  })
  it('con tipo desconocido devuelve el número solo', () => {
    expect(documentoLegible({ tipo_documento: 'raro', documento: '7' })).toBe('7')
  })
})
