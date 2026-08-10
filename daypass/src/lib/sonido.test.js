import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TONOS, tocar, desbloquearSonido, alternarSilencio, estaSilenciado } from './sonido'

/**
 * El sonido del muelle.
 *
 * Lo que se prueba no es que suene —eso no se puede comprobar aquí, y de todos
 * modos se comprueba parándose en La Bodeguita— sino la promesa que sostiene
 * todo lo demás: **que nunca detenga la operación**. Sin audio, con audio
 * roto, silenciado o en un navegador que no lo trae, la persona tiene que
 * poder seguir embarcando.
 *
 * Es la misma promesa que el QR: es comodidad, no requisito.
 */

// Node no trae localStorage. Se pone uno de mentira para poder comprobar que
// el silencio se guarda; sin él, esa promesa quedaría sin probar.
beforeEach(() => {
  const guardado = new Map()
  globalThis.localStorage = {
    getItem: k => (guardado.has(k) ? guardado.get(k) : null),
    setItem: (k, v) => guardado.set(k, String(v)),
    removeItem: k => guardado.delete(k),
    clear: () => guardado.clear(),
  }
  // El módulo guarda el estado en memoria, así que se normaliza antes de cada
  // prueba: si no, el orden en que corren cambiaría el resultado.
  if (estaSilenciado()) alternarSilencio()
})

describe('nunca detiene la operación', () => {
  it('sin WebAudio en el navegador, no revienta', () => {
    // Node no trae AudioContext: este es literalmente el caso.
    expect(() => desbloquearSonido()).not.toThrow()
    expect(() => tocar('ok')).not.toThrow()
  })

  it('tocar sin haber desbloqueado no hace nada y no falla', () => {
    expect(() => tocar('error')).not.toThrow()
  })

  it('un aviso que no existe se ignora en silencio', () => {
    expect(() => tocar('no-existe')).not.toThrow()
  })

  it('sobrevive a un AudioContext que falla al crearse', () => {
    const previo = globalThis.AudioContext
    globalThis.AudioContext = function () { throw new Error('sin salida de audio') }
    try {
      expect(() => desbloquearSonido()).not.toThrow()
      expect(() => tocar('ok')).not.toThrow()
    } finally {
      if (previo) globalThis.AudioContext = previo
      else delete globalThis.AudioContext
    }
  })
})

describe('el silencio se recuerda en el aparato', () => {
  it('arranca sonando y se puede apagar', () => {
    expect(estaSilenciado()).toBe(false)
    expect(alternarSilencio()).toBe(true)
    expect(estaSilenciado()).toBe(true)
  })

  it('vuelve a sonar al alternar de nuevo', () => {
    alternarSilencio()                       // queda silenciado
    expect(alternarSilencio()).toBe(false)   // y vuelve a sonar
    expect(estaSilenciado()).toBe(false)
  })

  it('queda guardado en el aparato, no en la cuenta', () => {
    alternarSilencio()
    // Vive en el aparato, como el modo: el iPad del muelle decide por sí
    // mismo, no por quién inició sesión.
    expect(localStorage.getItem('daypass:silencio')).toBe('si')
  })

  it('silenciado, tocar no intenta nada', () => {
    alternarSilencio()
    const crear = vi.fn()
    globalThis.AudioContext = function () { crear(); return {} }
    try {
      tocar('ok')
      expect(crear).not.toHaveBeenCalled()
    } finally {
      delete globalThis.AudioContext
    }
  })
})

describe('los cuatro avisos suenan distinto', () => {
  it('están los cuatro', () => {
    expect(Object.keys(TONOS).sort()).toEqual(['error', 'ok', 'repetido', 'tic'])
  })

  it('el válido es agudo y corto; el error, grave y largo', () => {
    // No es capricho: en un muelle ruidoso lo agudo se abre paso y lo grave
    // pide que alguien mire. Si estos dos se parecieran, la señal no serviría.
    const ok = TONOS.ok[0]
    const error = TONOS.error[0]
    expect(ok.hz).toBeGreaterThan(error.hz * 3)
    expect(error.ms).toBeGreaterThan(ok.ms * 3)
  })

  it('el repetido son dos toques, no uno', () => {
    // "Ya subió" informa; no puede sonar igual que un error.
    expect(TONOS.repetido).toHaveLength(2)
    expect(TONOS.repetido[1].desde).toBeGreaterThan(TONOS.repetido[0].ms)
  })

  it('el tic de cada toque es el más discreto de todos', () => {
    // Se va a oír cuarenta veces en noventa segundos.
    expect(TONOS.tic[0].ms).toBeLessThanOrEqual(40)
    expect(TONOS.tic[0].volumen).toBeLessThan(0.2)
  })
})
