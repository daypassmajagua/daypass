import { describe, it, expect } from 'vitest'
import { buscarTodo, aplanar, MINIMO } from './busqueda'
import { puedeVer } from './navegacion'
import { isMock } from './supabase'

/**
 * **Lo primero que se comprueba es contra qué se está probando.**
 *
 * `busqueda.js` se trae el cliente de `./supabase`, que elige entre el mock y
 * el real mirando `VITE_SUPABASE_URL` — y Vite carga el `.env` también en modo
 * test, así que esa variable llegaba puesta y esta prueba alcanzó a hacerle
 * consultas a la base del hotel. Se cerró vaciándola en `vite.config.js`.
 *
 * Esta comprobación es el detector de humo de ese candado: si alguien lo quita,
 * falla aquí en vez de irse a producción sin que nadie se entere. Es la primera
 * prueba que toca un módulo que se trae el cliente por su cuenta; las otras
 * importan `createMockClient` directamente y por eso nunca lo vieron.
 */
describe('contra qué se prueba', () => {
  it('nunca contra la base real', () => {
    expect(isMock).toBe(true)
  })
})

/**
 * La búsqueda corre contra el mock, que es el mismo que usa la demo. No se
 * prueba «encuentra a Fulanita» —los datos de muestra pueden cambiar— sino lo
 * que tiene que ser cierto siempre: desde cuántas letras busca, que cada
 * resultado sepa a dónde lleva, y que ese destino exista de verdad.
 */

describe('desde cuándo busca', () => {
  it('no busca con menos de tres letras', async () => {
    expect(await buscarTodo('')).toEqual([])
    expect(await buscarTodo('an')).toEqual([])
  })

  it('ignora los espacios de los lados', async () => {
    expect(await buscarTodo('  a  ')).toEqual([])
  })
})

describe('lo que devuelve', () => {
  it('agrupa y solo trae los grupos con algo', async () => {
    const grupos = await buscarTodo('maj')
    expect(Array.isArray(grupos)).toBe(true)
    expect(grupos.every(g => g.items.length > 0)).toBe(true)
    expect(grupos.every(g => g.etiqueta && g.clave)).toBe(true)
  })

  it('encuentra la lancha Majagua por su nombre', async () => {
    const grupos = await buscarTodo('majagua')
    const lanchas = aplanar(grupos).filter(r => r.tipo === 'lancha')
    expect(lanchas.length).toBeGreaterThan(0)
    expect(lanchas[0].titulo).toMatch(/Majagua/i)
  })

  it('cada resultado trae título y destino', async () => {
    const todos = aplanar(await buscarTodo('maj'))
    expect(todos.length).toBeGreaterThan(0)
    for (const r of todos) {
      expect(r.titulo).toBeTruthy()
      expect(r.a).toMatch(/^\//)
      expect(r.tipo).toBeTruthy()
    }
  })

  /**
   * La razón de esta prueba: un buscador que lleva a una ruta que no existe es
   * peor que no tener buscador. Se comprueba contra los permisos reales, que
   * es lo que decide si la pantalla abre o rebota.
   */
  it('lleva a sitios que la directora puede abrir', async () => {
    const todos = aplanar(await buscarTodo('maj'))
    for (const r of todos) {
      expect(puedeVer('directora', r.a), `${r.tipo} → ${r.a}`).toBe(true)
    }
  })

  /**
   * El defecto que apareció al probar la búsqueda global, y que la 029 arregla
   * en la base: los documentos se digitan «CC 1023456789», así que buscar el
   * número no encontraba a nadie. Nadie escribe el «CC» para buscar.
   */
  it('encuentra a alguien por el número, sin escribir el «CC»', async () => {
    const conCC = aplanar(await buscarTodo('CC 1023456789')).filter(r => r.tipo === 'persona')
    const soloNumero = aplanar(await buscarTodo('1023456789')).filter(r => r.tipo === 'persona')
    expect(conCC.length).toBeGreaterThan(0)
    expect(soloNumero.map(r => r.id)).toEqual(conCC.map(r => r.id))
  })

  it('no repite el mismo resultado dos veces', async () => {
    const todos = aplanar(await buscarTodo('a'.repeat(MINIMO)))
    const llaves = todos.map(r => `${r.tipo}-${r.id}`)
    expect(new Set(llaves).size).toBe(llaves.length)
  })
})

describe('los permisos de una ficha', () => {
  it('quien ve la sección ve sus fichas', () => {
    expect(puedeVer('directora', '/clientes/abc-123')).toBe(true)
    expect(puedeVer('directora', '/config/planes/abc-123')).toBe(true)
  })

  it('pero una sección de Configuración no se hereda de otra', () => {
    // `asesora_comercial` no administra planes: tener acceso a `/config` por
    // otra sección no le puede abrir esta.
    const puedePlanes = puedeVer('asesora_comercial', '/config/planes')
    expect(puedeVer('asesora_comercial', '/config/planes/abc-123')).toBe(puedePlanes)
  })

  it('la isla no llega a la ficha de un cliente', () => {
    expect(puedeVer('admin_isla', '/clientes/abc-123')).toBe(false)
  })

  it('un rol retirado no abre nada', () => {
    // `mesero` y `recepcion` salieron de `POR_ROL` (033 y 017) pero siguen en
    // el enum de la base. Si un perfil viejo llegara con uno de esos valores,
    // la app no puede abrirle media puerta.
    for (const rol of ['mesero', 'recepcion']) {
      expect(puedeVer(rol, '/')).toBe(false)
      expect(puedeVer(rol, '/isla')).toBe(false)
    }
  })
})
