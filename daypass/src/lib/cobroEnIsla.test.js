import { describe, it, expect } from 'vitest'
import { comoSeCobra, sePuedeCobrar, coincideEnIsla, COBROS } from './cobroEnIsla'

/**
 * Equivocarse aquí tiene consecuencias distintas en cada dirección: cargarle a
 * una cortesía es cobrarle a un invitado del hotel, y no cargarle a un pasadía
 * es comida regalada. Por eso cada tipo se prueba por separado.
 */

const TIPOS = [
  { id: 't-pasadia', codigo: 'pasadia' },
  { id: 't-cortesia', codigo: 'cortesia' },
  { id: 't-aloj', codigo: 'alojamiento' },
  { id: 't-empleado', codigo: 'empleado' },
  { id: 't-proveedor', codigo: 'proveedor' },
]

describe('a qué cuenta va el almuerzo', () => {
  it('un pasadía con folio se carga a su folio', () => {
    const c = comoSeCobra({ tipo_ingreso_id: 't-pasadia', folio_zeus: 'F-4471' }, TIPOS)
    expect(c.modo).toBe(COBROS.folio)
    expect(c.folio).toBe('F-4471')
    expect(sePuedeCobrar(c)).toBe(true)
  })

  it('un pasadía sin folio todavía no se cierra: hay que preguntar', () => {
    const c = comoSeCobra({ tipo_ingreso_id: 't-pasadia', folio_zeus: null }, TIPOS)
    expect(c.modo).toBe(COBROS.falta_folio)
    expect(sePuedeCobrar(c)).toBe(false)
  })

  it('un folio en blanco cuenta como que no hay', () => {
    expect(comoSeCobra({ tipo_ingreso_id: 't-pasadia', folio_zeus: '   ' }, TIPOS).modo)
      .toBe(COBROS.falta_folio)
  })

  it('a una cortesía no se le carga nada', () => {
    const c = comoSeCobra({ tipo_ingreso_id: 't-cortesia', folio_zeus: null }, TIPOS)
    expect(c.modo).toBe(COBROS.cortesia)
    expect(c.folio).toBe(null)
    expect(sePuedeCobrar(c)).toBe(false)
  })

  it('una cortesía sigue siendo cortesía aunque alguien le haya puesto folio', () => {
    // El folio no manda sobre el tipo de ingreso: cobrarle a un invitado del
    // hotel es peor que dejar un folio sin usar.
    const c = comoSeCobra({ tipo_ingreso_id: 't-cortesia', folio_zeus: 'F-9999' }, TIPOS)
    expect(c.modo).toBe(COBROS.cortesia)
    expect(c.folio).toBe(null)
  })

  it('un huésped de alojamiento va a su habitación', () => {
    expect(comoSeCobra({ tipo_ingreso_id: 't-aloj' }, TIPOS).modo).toBe(COBROS.habitacion)
  })

  it('un empleado no genera consumo', () => {
    expect(comoSeCobra({ tipo_ingreso_id: 't-empleado' }, TIPOS).modo).toBe(COBROS.empleado)
  })

  it('un proveedor se trata como pasadía: cobra según su reserva', () => {
    expect(comoSeCobra({ tipo_ingreso_id: 't-proveedor', folio_zeus: 'F-1' }, TIPOS).modo)
      .toBe(COBROS.folio)
  })

  it('una reserva vieja sin tipo_ingreso pero con forma_pago cortesía no se cobra', () => {
    // tipo_ingreso_id llegó en la 007; lo de antes solo dice cortesía aquí.
    const c = comoSeCobra({ tipo_ingreso_id: null, forma_pago: 'cortesia' }, TIPOS)
    expect(c.modo).toBe(COBROS.cortesia)
    expect(sePuedeCobrar(c)).toBe(false)
  })

  it('si el tipo y la forma de pago se contradicen, no se elige bando', () => {
    // Un mesero de pie junto a la mesa no tiene por qué adivinar cuál de los
    // dos campos está mal.
    const c = comoSeCobra(
      { tipo_ingreso_id: 't-pasadia', forma_pago: 'cortesia', folio_zeus: 'F-3' }, TIPOS)
    expect(c.modo).toBe(COBROS.revisar)
    expect(sePuedeCobrar(c)).toBe(false)
    expect(c.folio).toBe(null)
  })

  it('cortesía por los dos lados no es contradicción', () => {
    const c = comoSeCobra({ tipo_ingreso_id: 't-cortesia', forma_pago: 'cortesia' }, TIPOS)
    expect(c.modo).toBe(COBROS.cortesia)
  })

  it('un pasadía pagado normal no dispara la revisión', () => {
    const c = comoSeCobra(
      { tipo_ingreso_id: 't-pasadia', forma_pago: 'transferencia', folio_zeus: 'F-3' }, TIPOS)
    expect(c.modo).toBe(COBROS.folio)
  })

  it('sin tipo de ingreso se comporta como pasadía, que es lo más común', () => {
    expect(comoSeCobra({ folio_zeus: 'F-7' }, TIPOS).modo).toBe(COBROS.folio)
    expect(comoSeCobra({ folio_zeus: null }, TIPOS).modo).toBe(COBROS.falta_folio)
  })

  it('sin catálogo de tipos tampoco revienta', () => {
    expect(comoSeCobra({ folio_zeus: 'F-7' }).modo).toBe(COBROS.folio)
  })
})

describe('encontrar a alguien en la mesa', () => {
  const r = {
    nombre_pasajero: 'Carolina Martínez Ruiz',
    nombre_grupo: 'Grupo Corporativo Bavaria',
    agencia_nombre: 'Hotelbeds',
    folio_zeus: 'F-4471',
  }

  it('por el apellido, que es lo que se oye', () => {
    expect(coincideEnIsla(r, 'martínez')).toBe(true)
  })

  it('por el nombre del grupo', () => {
    expect(coincideEnIsla(r, 'bavaria')).toBe(true)
  })

  it('por la agencia', () => {
    expect(coincideEnIsla(r, 'hotelbeds')).toBe(true)
  })

  it('por el folio, si el mesero lo tiene escrito en la comanda', () => {
    expect(coincideEnIsla(r, 'F-4471')).toBe(true)
  })

  it('por el principio de una palabra, no solo la primera', () => {
    expect(coincideEnIsla(r, 'ruiz')).toBe(true)
    expect(coincideEnIsla(r, 'corp')).toBe(true)
  })

  it('con dos palabras tienen que estar las dos', () => {
    expect(coincideEnIsla(r, 'carolina martínez')).toBe(true)
    expect(coincideEnIsla(r, 'carolina pérez')).toBe(false)
  })

  it('sin consulta sale todo el mundo', () => {
    expect(coincideEnIsla(r, '')).toBe(true)
    expect(coincideEnIsla(r, '  ')).toBe(true)
  })

  it('quien no coincide no sale', () => {
    expect(coincideEnIsla(r, 'zutano')).toBe(false)
  })

  it('una reserva sin grupo ni agencia no revienta', () => {
    expect(coincideEnIsla({ nombre_pasajero: 'Ana Ruiz' }, 'ana')).toBe(true)
    expect(coincideEnIsla({ nombre_pasajero: 'Ana Ruiz' }, 'bavaria')).toBe(false)
  })
})
