import { useEffect, useMemo, useState } from 'react'
import { contarPorRegistro } from './usePasajeros'
import { plural } from '../lib/utils'

/**
 * Lo que le falta al día, en el idioma de la asesora.
 *
 * No son alertas genéricas: cada una tiene nombre propio y un botón que lleva
 * directo a resolverla. Si no se puede actuar, no es un pendiente.
 */
export function usePendientes(registros, { enPlaneacion, tiposIngreso = [] } = {}) {
  const [nombres, setNombres] = useState({})

  // Una cortesía no genera folio ni pago: pedirlos sería ruido.
  const idsCortesia = useMemo(
    () => new Set(tiposIngreso.filter(t => t.codigo === 'cortesia').map(t => t.id)),
    [tiposIngreso]
  )
  const esCortesia = r => idsCortesia.has(r.tipo_ingreso_id)

  useEffect(() => {
    let vigente = true
    contarPorRegistro(registros.map(r => r.id))
      .then(conteo => { if (vigente) setNombres(conteo) })
    return () => { vigente = false }
  }, [registros])

  return useMemo(() => {
    // Lo cancelado y lo que no llegó ya no le falta nada a nadie.
    const vivas = registros.filter(r => !['cancelada', 'noshow'].includes(r.estado))
    const lista = []

    // ── Cambios tardíos: primero, porque la cocina y la isla ya trabajaron
    //    con la versión anterior.
    vivas.filter(r => r.cambio_tardio).forEach(r => {
      lista.push({
        id: `tardio-${r.id}`,
        tono: 'tardio',
        texto: `La reserva de ${r.nombre_grupo || r.nombre_pasajero} cambió después del cierre`,
        detalle: 'Avísale a la isla y a la cocina',
        accion: { etiqueta: 'Ver la reserva', a: `/editar/${r.id}` },
      })
    })

    // ── Nombres faltantes. Los grupos van uno por uno —pasar el listado de
    //    la agencia es la tarea más tediosa del día y merece su propia
    //    línea—, pero los individuales se agrupan: doce filas idénticas
    //    ahogan todo lo demás y enseñan a ignorar la lista.
    const faltos = vivas
      .map(r => {
        const plan = r.adultos + r.ninos + r.infantes + r.cortesias
        return { r, plan, tiene: nombres[r.id] || 0 }
      })
      .filter(x => x.plan > 0 && x.tiene < x.plan)

    const gruposFaltos = faltos
      .filter(x => x.r.tipo === 'grupo')
      .sort((a, b) => (b.plan - b.tiene) - (a.plan - a.tiene))   // el más pesado primero

    const TOPE_GRUPOS = 4
    gruposFaltos.slice(0, TOPE_GRUPOS).forEach(({ r, plan, tiene }) => {
      const quien = r.nombre_grupo || r.agencia_nombre || r.nombre_pasajero
      lista.push({
        id: `nombres-${r.id}`,
        tono: 'pendiente',
        texto: tiene === 0
          ? `${quien} (${plan} pax) no tiene nombres todavía`
          : `A ${quien} le faltan ${plural(plan - tiene, 'nombre', 'nombres')}`,
        accion: { etiqueta: 'Agregar nombres', a: `/editar/${r.id}` },
      })
    })

    if (gruposFaltos.length > TOPE_GRUPOS) {
      const resto = gruposFaltos.slice(TOPE_GRUPOS)
      const paxResto = resto.reduce((s, x) => s + (x.plan - x.tiene), 0)
      lista.push({
        id: 'nombres-grupos-resto',
        tono: 'pendiente',
        texto: `Otros ${resto.length} grupos sin nombres`,
        detalle: `${plural(paxResto, 'persona', 'personas')} por cargar`,
        accion: { etiqueta: 'Ver el listado', a: '/dia' },
      })
    }

    const individualesFaltos = faltos.filter(x => x.r.tipo !== 'grupo')
    if (individualesFaltos.length) {
      const paxInd = individualesFaltos.reduce((s, x) => s + (x.plan - x.tiene), 0)
      lista.push({
        id: 'nombres-individuales',
        tono: 'pendiente',
        texto: `${plural(individualesFaltos.length, 'reserva individual sin nombres', 'reservas individuales sin nombres')}`,
        detalle: `${plural(paxInd, 'persona', 'personas')} por cargar`,
        accion: { etiqueta: 'Ver el listado', a: '/dia' },
      })
    }

    // ── Folios Zeus, agrupado: se cargan todos de una sentada.
    // Las cortesías no llevan folio: recepción les cobra el tiquete directo.
    const sinFolio = vivas.filter(r => !r.folio_zeus && !esCortesia(r))
    if (sinFolio.length) {
      lista.push({
        id: 'folios',
        tono: 'pendiente',
        texto: `${plural(sinFolio.length, 'reserva sin folio Zeus', 'reservas sin folio Zeus')}`,
        accion: { etiqueta: 'Cargar folios', a: '/folios' },
      })
    }

    // ── Pagos sin confirmar. La cortesía no paga.
    const sinPago = vivas.filter(r => !r.forma_pago && !esCortesia(r))
    if (sinPago.length) {
      lista.push({
        id: 'pagos',
        tono: 'pendiente',
        texto: `${plural(sinPago.length, 'reserva sin forma de pago', 'reservas sin forma de pago')}`,
        detalle: sinPago.slice(0, 3).map(r => r.nombre_pasajero).join(', ') +
                 (sinPago.length > 3 ? ` y ${sinPago.length - 3} más` : ''),
        accion: { etiqueta: 'Ver el listado', a: '/dia' },
      })
    }

    // ── Impuestos de puerto que se cobran en el muelle.
    const impuestosPendientes = vivas.filter(r => r.impuestos_puerto === 'no')
    if (impuestosPendientes.length) {
      lista.push({
        id: 'impuestos',
        tono: 'pendiente',
        texto: `${plural(impuestosPendientes.length, 'reserva debe', 'reservas deben')} impuestos de puerto`,
        detalle: 'Se cobran en el muelle al embarcar',
        accion: { etiqueta: 'Ver el listado', a: '/dia' },
      })
    }

    // ── El cierre en sí, cuando ya hay algo que cerrar.
    const tentativas = registros.filter(r => r.estado === 'tentativa')
    if (enPlaneacion && tentativas.length) {
      lista.push({
        id: 'tentativas',
        tono: 'pendiente',
        texto: `${plural(tentativas.length, 'reserva sigue tentativa', 'reservas siguen tentativas')}`,
        detalle: 'Se confirman solas al cerrar el tentativo',
        accion: null,
      })
    }

    // Lo tardío primero: es lo único que ya le costó trabajo a alguien más.
    lista.sort((a, b) => (a.tono === 'tardio' ? 0 : 1) - (b.tono === 'tardio' ? 0 : 1))

    const faltanNombres = vivas.reduce((s, r) => {
      const plan = r.adultos + r.ninos + r.infantes + r.cortesias
      return s + Math.max(0, plan - (nombres[r.id] || 0))
    }, 0)

    return {
      lista,
      nombres,
      resumen: {
        faltanNombres,
        sinFolio: sinFolio.length,
        sinPago: sinPago.length,
        tardios: vivas.filter(r => r.cambio_tardio).length,
      },
    }
  }, [registros, nombres, enPlaneacion, idsCortesia])
}
