import { formatCurrency } from './utils'

/**
 * La bitácora, contada en español.
 *
 * ── Por qué esto vive en un archivo aparte ──────────────────────────────────
 *
 * La misma acción se muestra en dos sitios —la ficha de un plan y la pantalla
 * de actividad— y ya se había escrito dos veces. Dos traducciones del mismo
 * código son dos que se van a separar el día que alguien retoque una.
 *
 * ── Las acciones que existen ────────────────────────────────────────────────
 *
 * Salen de las migraciones, no de aquí: son las seis que `anotar()` escribe
 * hoy. Si aparece una séptima y nadie la traduce, se muestra el código crudo
 * con los guiones bajos a la vista — se ve feo a propósito, para que se note
 * que falta traducirla en vez de esconderse detrás de una frase genérica.
 */

export const ACCIONES = {
  cambiar_tarifa: { etiqueta: 'Tarifas', sensible: true },
  cambiar_ajuste: { etiqueta: 'Ajustes', sensible: true },
  cerrar_zarpe: { etiqueta: 'Cierres', sensible: false },
  mover_tiquetes: { etiqueta: 'Tiquetes', sensible: false },
  anular_pago: { etiqueta: 'Pagos anulados', sensible: true },
  atender_ticket: { etiqueta: 'Reportes', sensible: false },
  unir_personas: { etiqueta: 'Personas unidas', sensible: false },
}

/** Los filtros de la pantalla de actividad, en orden de lo que más se mira. */
export const FILTROS_ACCION = [
  'cambiar_tarifa', 'cambiar_ajuste', 'anular_pago',
  'cerrar_zarpe', 'mover_tiquetes', 'atender_ticket',
].map(codigo => ({ valor: codigo, etiqueta: ACCIONES[codigo].etiqueta }))

/** Los precios de un plan, como los guarda el trigger de la 024. */
const PRECIOS = {
  adulto_baja: 'adulto · baja',
  adulto_alta: 'adulto · alta',
  nino_baja: 'niño · baja',
  nino_alta: 'niño · alta',
}

/**
 * Una fila de bitácora, como frase.
 *
 * El detalle es `jsonb` y cada acción guarda lo suyo, así que esto es un
 * `switch` y no una plantilla: forzar una sola forma haría que las tres que
 * importan —las que mueven plata— se leyeran peor.
 */
export function fraseDe(b) {
  const d = b?.detalle || {}

  switch (b?.accion) {
    case 'cambiar_tarifa': {
      const antes = d.antes || {}
      const ahora = d.ahora || {}
      const cambios = Object.keys(ahora)
        .filter(k => String(antes[k]) !== String(ahora[k]))
        .map(k => `${PRECIOS[k] || k.replace(/_/g, ' ')}: ${formatCurrency(Number(antes[k] || 0))} → ${formatCurrency(Number(ahora[k] || 0))}`)
      const plan = d.plan ? ` de ${d.plan}` : ''
      return cambios.length
        ? `Cambió la tarifa${plan} — ${cambios.join(' · ')}`
        : `Cambió la tarifa${plan}`
    }

    case 'cambiar_ajuste':
      return `Cambió «${d.clave || 'un ajuste'}» de ${d.antes ?? '—'} a ${d.ahora ?? '—'}`

    case 'cerrar_zarpe':
      return 'Cerró el zarpe'

    case 'mover_tiquetes':
      return d.cantidad != null
        ? `Movió ${d.cantidad} tiquetes${d.motivo ? ` · ${d.motivo}` : ''}`
        : 'Movió el inventario de tiquetes'

    case 'anular_pago':
      return d.valor != null
        ? `Anuló un pago de ${formatCurrency(Number(d.valor))}`
        : 'Anuló un pago'

    case 'atender_ticket':
      return 'Atendió un reporte'

    case 'unir_personas':
      return 'Unió dos fichas de la misma persona'

    default:
      // Sin traducir, y a la vista.
      return String(b?.accion || 'algo')
  }
}

/**
 * ¿Esta acción hay que mirarla?
 *
 * Solo se destaca lo que mueve plata o cambia las reglas — tarifas, ajustes,
 * pagos anulados. Un cierre de zarpe es la operación funcionando; destacarlo
 * junto a un cambio de precio haría que ninguno de los dos se viera.
 */
export function esSensible(accion) {
  return ACCIONES[accion]?.sensible === true
}
