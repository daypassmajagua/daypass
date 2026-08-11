import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Que una reserva guardada se pueda volver a guardar.
 *
 * ── El fallo ────────────────────────────────────────────────────────────────
 *
 * `z.string().optional()` acepta `undefined`, **no `null`**. Al abrir una
 * reserva, el formulario se llena con lo que hay en la base, donde casi todos
 * los campos opcionales están en null: sin grupo, sin documento, sin país, sin
 * agencia, sin forma de pago, sin folio, sin observaciones.
 *
 * Con eso la validación fallaba **antes de intentar guardar**, con un mensaje
 * de Zod en inglés sobre un campo que quizá ni estaba a la vista. El efecto
 * para quien lo sufre: el botón «Guardar cambios» no hace nada.
 *
 * ── Por qué se prueba leyendo el archivo ────────────────────────────────────
 *
 * El esquema no está exportado y montar el formulario entero pediría un DOM y
 * la mitad de la app. Lo que hay que impedir es concreto y se ve en el texto:
 * **ningún campo opcional puede quedarse en `.optional()` sin aceptar null**.
 * Es una prueba de forma, y por eso dice exactamente qué buscar y por qué.
 */

const RESERVA = new URL('../pages/Reserva.jsx', import.meta.url)

describe('el formulario de la reserva acepta lo que hay en la base', () => {
  const codigo = readFileSync(RESERVA, 'utf8')
  // Solo el bloque del esquema: más abajo hay `.optional()` legítimos en otras
  // cosas que no se llenan desde la base.
  const esquema = codigo.slice(codigo.indexOf('const schema = z.object('), codigo.indexOf('/** Casi todo se carga'))

  it('ningún campo de texto usa .optional(), que rechaza null', () => {
    const culpables = [...esquema.matchAll(/^\s*(\w+):\s*z\.string\(\)[^\n]*\.optional\(\)/gm)]
      .map(m => m[1])
    expect(culpables, 'usa `textoOpcional` en vez de `z.string().optional()`').toEqual([])
  })

  it('el contacto se pide pero no se exige', () => {
    // Una reserva de agencia no tiene el teléfono del pasajero: el contacto es
    // la agencia. Exigirlo impedía corregir la lancha de un grupo.
    expect(esquema).toMatch(/telefono:\s*z\.string\(\)\.nullish\(\)/)
    expect(esquema).toMatch(/email:\s*z\.string\(\)\.nullish\(\)/)
  })

  it('el tipo de ingreso no bloquea editar una reserva anterior a la 007', () => {
    expect(esquema).toMatch(/tipo_ingreso_id:\s*textoOpcional/)
  })

  it('un fallo de validación se dice en voz alta', () => {
    // Sin esto el formulario no sale y el botón parece muerto.
    expect(codigo).toMatch(/handleSubmit\(onSubmit,\s*noSePudoValidar\)/)
  })
})
