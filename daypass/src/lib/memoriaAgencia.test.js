import { describe, it, expect } from 'vitest'
import { loQueSuelePedir, porqueSePropone } from './memoriaAgencia'

/**
 * Lo que se prueba aquí no es que adivine bien: es **cuándo se calla**.
 *
 * Una propuesta equivocada se guarda igual si nadie la mira, y una reserva con
 * el plan que no era sale mal en la tarifa, en el conteo de cocina y en el
 * folio. Así que el caso importante de estas pruebas es el negativo.
 */

const r = (campos = {}) => ({
  canal_id: null, plan_id: null, forma_pago: null, tipo: 'individual',
  impuestos_puerto: null, ...campos,
})

describe('lo que suele pedir una agencia', () => {
  it('con una sola reserva no propone nada', () => {
    // Una vez no es costumbre. Y la primera reserva de una agencia nueva es
    // justo donde una propuesta equivocada pasaría sin que nadie la revise.
    const { campos } = loQueSuelePedir([r({ plan_id: 'gold', canal_id: 'agv' })])
    expect(campos).toEqual({})
  })

  it('con mayoría clara propone', () => {
    const { campos } = loQueSuelePedir([
      r({ plan_id: 'silver', canal_id: 'agv', forma_pago: 'cxc' }),
      r({ plan_id: 'silver', canal_id: 'agv', forma_pago: 'cxc' }),
      r({ plan_id: 'gold', canal_id: 'agv', forma_pago: 'cxc' }),
    ])
    expect(campos.plan_id).toBe('silver')
    expect(campos.canal_id).toBe('agv')
    expect(campos.forma_pago).toBe('cxc')
  })

  it('sin mayoría se calla, aunque haya un más votado', () => {
    // 2 de 5 es el más repetido y NO es mayoría: la agencia alterna, así que
    // no tiene plan usual. Proponer aquí sería adivinar.
    const { campos } = loQueSuelePedir([
      r({ plan_id: 'a' }), r({ plan_id: 'a' }),
      r({ plan_id: 'b' }), r({ plan_id: 'c' }), r({ plan_id: 'd' }),
    ])
    expect(campos.plan_id).toBeUndefined()
  })

  it('un empate no es costumbre', () => {
    const { campos } = loQueSuelePedir([r({ plan_id: 'a' }), r({ plan_id: 'b' })])
    expect(campos.plan_id).toBeUndefined()
  })

  it('los nulos no cuentan como valor', () => {
    // Ocho reservas sin forma de pago y dos con «cxc»: las dos que lo traen
    // sí son mayoría entre las que lo traen. No se propone «vacío».
    const { campos } = loQueSuelePedir([
      ...Array(8).fill(r()),
      r({ forma_pago: 'cxc' }), r({ forma_pago: 'cxc' }),
    ])
    expect(campos.forma_pago).toBe('cxc')
  })

  it('solo mira las diez más recientes', () => {
    // Doce viejas con «gold» y diez nuevas con «silver»: manda lo reciente,
    // porque una agencia que cambió de plan cambió de verdad.
    const reservas = [...Array(10).fill(r({ plan_id: 'silver' })), ...Array(12).fill(r({ plan_id: 'gold' }))]
    expect(loQueSuelePedir(reservas).campos.plan_id).toBe('silver')
  })

  it('recuerda que la agencia manda grupos', () => {
    const { campos } = loQueSuelePedir([
      r({ tipo: 'grupo' }), r({ tipo: 'grupo' }), r({ tipo: 'individual' }),
    ])
    expect(campos.tipo).toBe('grupo')
  })
})

describe('decir de dónde salió', () => {
  it('nombra lo que propuso', () => {
    const frase = porqueSePropone('Aviatur', { plan_id: 'x', canal_id: 'y' },
      { plan: 'Rack Silver', canal: 'Agencias' })
    expect(frase).toBe('Es lo que Aviatur suele pedir: Rack Silver y Agencias.')
  })

  it('sin propuesta no dice nada', () => {
    // Un aviso que no propone nada es ruido en una pantalla que ya tiene 5
    // secciones.
    expect(porqueSePropone('Aviatur', {})).toBeNull()
  })
})
