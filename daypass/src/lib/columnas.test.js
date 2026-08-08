import { describe, it, expect } from 'vitest'
import {
  RESERVA, RESERVA_CON_PAGO, RESERVA_CON_DINERO, reservaCon,
  CAMPOS_RESERVA, CAMPOS_PAGO, CAMPOS_PRECIO,
  CON_LANCHA, CON_PLAN,
} from './columnas'

/**
 * Estas pruebas existen por una razón concreta: el día que la fase de roles
 * revoque `precio_adulto` para el mesero, cualquier consulta que lo pida va a
 * fallar entera con `permission denied for column`. Y `precarga.js` es la
 * copia local del muelle, así que ese fallo aparecería sin señal, a las ocho
 * de la mañana, con la fila esperando.
 *
 * Lo que se protege aquí no es el formato del texto: es que nadie meta por
 * descuido una columna de plata en la lista que usan el muelle y la isla.
 */

const columnas = lista => lista.split(',').map(c => c.trim())

describe('el muelle y la isla no piden plata', () => {
  it('RESERVA no trae ninguna columna de precio', () => {
    for (const campo of CAMPOS_PRECIO) {
      expect(columnas(RESERVA)).not.toContain(campo)
    }
  })

  it('RESERVA tampoco trae la forma de pago', () => {
    expect(columnas(RESERVA)).not.toContain('forma_pago')
  })

  it('RESERVA_CON_PAGO trae forma_pago pero ningún precio', () => {
    // La isla la necesita: de ahí sale si a esa persona se le carga el
    // almuerzo o es una cortesía del hotel.
    expect(columnas(RESERVA_CON_PAGO)).toContain('forma_pago')
    for (const campo of CAMPOS_PRECIO) {
      expect(columnas(RESERVA_CON_PAGO)).not.toContain(campo)
    }
  })

  it('RESERVA_CON_DINERO sí trae todo', () => {
    for (const campo of [...CAMPOS_PRECIO, ...CAMPOS_PAGO]) {
      expect(columnas(RESERVA_CON_DINERO)).toContain(campo)
    }
  })
})

describe('los tres niveles crecen, no se pisan', () => {
  it('cada nivel contiene al anterior', () => {
    const base = columnas(RESERVA)
    const pago = columnas(RESERVA_CON_PAGO)
    const dinero = columnas(RESERVA_CON_DINERO)
    base.forEach(c => expect(pago).toContain(c))
    pago.forEach(c => expect(dinero).toContain(c))
  })

  it('ninguna columna se repite', () => {
    const cols = columnas(RESERVA_CON_DINERO)
    expect(new Set(cols).size).toBe(cols.length)
  })
})

describe('lo que toda pantalla necesita para funcionar', () => {
  // Si alguna de estas se cae de la lista, una pantalla se rompe en silencio:
  // el dato llega `undefined` y se pinta vacío en vez de fallar.
  const IMPRESCINDIBLES = [
    'id', 'fecha', 'estado',            // sin esto no hay lista
    'nombre_pasajero', 'nombre_grupo',  // sin esto no se busca a nadie
    'lancha_id', 'plan_id',             // el muelle y cocina
    'adultos', 'ninos', 'infantes', 'cortesias',  // el conteo de almuerzos
    'folio_zeus',                       // la isla, para cargar en Zeus
    'tipo_ingreso_id',                  // las tres banderas de la regla 11
    'cambio_tardio',                    // el aviso de lo que cambió tras cerrar
    'check_in_at',                      // quién ya hizo su check-in
  ]

  it.each(IMPRESCINDIBLES)('RESERVA incluye %s', campo => {
    expect(columnas(RESERVA)).toContain(campo)
  })

  it('no queda ningún asterisco: ese es el problema que esto resuelve', () => {
    expect(RESERVA_CON_DINERO).not.toContain('*')
  })
})

describe('reservaCon', () => {
  it('sin nivel devuelve el básico', () => {
    expect(reservaCon()).toBe(RESERVA)
  })

  it('pega las relaciones al final', () => {
    const s = reservaCon({ relaciones: [CON_LANCHA, CON_PLAN] })
    expect(s.startsWith(RESERVA)).toBe(true)
    expect(s).toContain('lanchas (id, nombre)')
    expect(s).toContain('planes (id, nombre)')
  })

  it('el nivel dinero trae los precios', () => {
    expect(reservaCon({ nivel: 'dinero' })).toBe(RESERVA_CON_DINERO)
  })

  it('un nivel que no existe cae en el más seguro, no en el más abierto', () => {
    // Equivocarse escribiendo el nivel no puede terminar mostrando precios.
    expect(reservaCon({ nivel: 'dinerito' })).toBe(RESERVA)
  })
})

describe('la lista está completa', () => {
  it('las tres partes suman lo mismo que el total', () => {
    expect(columnas(RESERVA_CON_DINERO).length)
      .toBe(CAMPOS_RESERVA.length + CAMPOS_PAGO.length + CAMPOS_PRECIO.length)
  })
})
