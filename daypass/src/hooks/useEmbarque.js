import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/offline/db'
import { encolar, alCambiarLaCola } from '../lib/offline/cola'
import { leerDiaLocal, leerCatalogoLocal } from '../lib/offline/precarga'
import { plazasSinNombre } from '../lib/plazas'
import { reservaCon, CON_LANCHA, CON_PLAN } from '../lib/columnas'

/**
 * El embarque de un zarpe.
 *
 * El muelle no edita: registra hechos. Aquí se arma la lista de quién se
 * espera y se deriva su estado del último evento registrado.
 */

/** En la ida cuenta haber subido; en el regreso, haber bajado. */
const EVENTOS_IDA = ['check_in', 'walk_in']
const EVENTOS_REGRESO = ['desembarque']

/** Identificador estable de una persona dentro del zarpe. */
export function claveDe(fila) {
  return fila.pasajero_id || fila.client_id || `${fila.registro_id}#${fila.indice}`
}

/**
 * Misma regla que la vista estado_embarques de Postgres: el último evento de
 * cada persona manda. Se usa cuando se trabaja sin red o para sumar lo que
 * todavía está en la cola.
 */
function derivarDeEmbarques(eventos) {
  const ultimo = new Map()
  ;[...eventos]
    .sort((a, b) => new Date(a.ocurrido_at) - new Date(b.ocurrido_at))
    .forEach(e => ultimo.set(`${e.pasajero_id || e.client_id}`, e))
  return [...ultimo.values()].map(e => ({
    zarpe_id: e.zarpe_id,
    pasajero_id: e.pasajero_id || null,
    registro_id: e.registro_id || null,
    client_id: e.client_id,
    estado: e.evento || e.estado,
    nombre: e.nombre || null,
    documento: e.documento || null,
    // El manifiesto los pide, y sin red esta es la única fuente que hay.
    tipo_documento: e.tipo_documento || null,
    pais_id: e.pais_id || null,
    categoria: e.categoria || null,
    ocurrido_at: e.ocurrido_at,
  }))
}

function nuevoClientId() {
  return (crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.floor(performance.now() * 1000)}`)
}

/** Nombre del dispositivo, para saber desde dónde se marcó. */
function dispositivo() {
  const ua = navigator.userAgent
  if (/iPad/i.test(ua)) return 'iPad'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/Android/i.test(ua)) return 'Android'
  return 'Computador'
}

export function useZarpesDelDia(fecha) {
  const [zarpes, setZarpes] = useState([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    if (!fecha) return
    const { data } = await supabase
      .from('zarpes')
      .select('*, lanchas (id, nombre, codigo, capacidad)')
      .eq('fecha', fecha)
      .order('hora_programada', { ascending: true })
    setZarpes(data || [])
    setCargando(false)
  }, [fecha])

  useEffect(() => { recargar() }, [recargar])

  useEffect(() => {
    if (!fecha) return
    const canal = supabase
      .channel(`zarpes:${fecha}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zarpes' }, recargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [fecha, recargar])

  const programar = useCallback(async (hora = '09:00') => {
    const { error } = await supabase.rpc('programar_zarpes', { p_fecha: fecha, p_hora: hora })
    await recargar()
    return { error }
  }, [fecha, recargar])

  /**
   * El regreso de las 3:30. Solo vuelven las lanchas que fueron: programarle
   * el regreso a una que nunca zarpó llenaría el muelle de zarpes vacíos que
   * alguien tendría que cerrar a mano.
   *
   * La hora sale del ajuste `hora_regreso`; se le puede pasar otra si ese día
   * la lancha sale antes o después.
   */
  const programarRegreso = useCallback(async (hora = null) => {
    const { error } = await supabase.rpc('programar_regresos', {
      p_fecha: fecha, p_hora: hora,
    })
    await recargar()
    return { error }
  }, [fecha, recargar])

  // Ya fue alguna lancha, así que hay regreso que programar.
  const hayIdaCerrada = zarpes.some(z => z.sentido === 'ida' && ['zarpado', 'regresado'].includes(z.estado))
  const hayRegreso = zarpes.some(z => z.sentido === 'regreso')

  return { zarpes, cargando, recargar, programar, programarRegreso, hayIdaCerrada, hayRegreso }
}

/**
 * Lo que va a bordo sin ser pasadía: empleados, huéspedes de alojamiento, el
 * piloto y el catálogo de países. Solo el manifiesto lo necesita, así que vive
 * aparte de useEmbarque en vez de engordarlo.
 *
 * Con red se lee del servidor; sin red, de la copia local. Es lo mismo que
 * hace el embarque, y por la misma razón: el manifiesto se imprime en el
 * muelle, donde puede no haber señal.
 */
export function useDatosManifiesto(zarpe) {
  const [datos, setDatos] = useState({
    empleados: [], zarpeEmpleados: [], alojamiento: [], pilotos: [], paises: [],
  })

  const cargar = useCallback(async () => {
    if (!zarpe?.id) return

    if (navigator.onLine) {
      const [ze, za, emp, pil, pai] = await Promise.all([
        supabase.from('zarpe_empleados').select('*').eq('zarpe_id', zarpe.id),
        supabase.from('zarpe_alojamiento').select('*').eq('zarpe_id', zarpe.id),
        supabase.from('empleados').select('*'),
        supabase.from('pilotos').select('*'),
        supabase.from('paises').select('*'),
      ])
      if (!ze.error && !za.error) {
        setDatos({
          zarpeEmpleados: ze.data || [],
          alojamiento: za.data || [],
          empleados: emp.data || [],
          pilotos: pil.data || [],
          paises: pai.data || [],
        })
        return
      }
    }

    const local = await leerDiaLocal(zarpe.fecha)
    const [empleados, pilotos, paises] = await Promise.all([
      leerCatalogoLocal('empleados'),
      leerCatalogoLocal('pilotos'),
      leerCatalogoLocal('paises'),
    ])
    setDatos({
      zarpeEmpleados: (local.zarpeEmpleados || []).filter(z => z.zarpe_id === zarpe.id),
      alojamiento: (local.zarpeAlojamiento || []).filter(z => z.zarpe_id === zarpe.id),
      empleados, pilotos, paises,
    })
  }, [zarpe?.id, zarpe?.fecha])

  useEffect(() => { cargar() }, [cargar])

  return { ...datos, recargar: cargar }
}

/**
 * La lista de embarque de un zarpe: personas esperadas, su estado actual, y
 * las acciones que registran hechos nuevos.
 */
export function useEmbarque(zarpe) {
  const [registros, setRegistros] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [estados, setEstados] = useState([])
  // Lo que pasó en la ida de esa misma lancha. Solo se usa en el regreso, y
  // manda: de vuelta solo puede bajar quien subió.
  const [estadosIda, setEstadosIda] = useState([])
  const [cargando, setCargando] = useState(true)

  const esRegreso = zarpe?.sentido === 'regreso'
  // El hecho que cuenta como "listo" cambia con el sentido del viaje. Las dos
  // listas son constantes del módulo, no literales aquí: un array nuevo en
  // cada render rompería las dependencias de los useMemo de abajo.
  const EVENTOS_OK = esRegreso ? EVENTOS_REGRESO : EVENTOS_IDA

  /**
   * Con red, del servidor; sin red, de la copia local que se precargó al
   * cerrar el tentativo. En ambos casos se suman los hechos que todavía
   * están en la cola: lo que la asesora acaba de marcar tiene que verse ya.
   */
  const cargar = useCallback(async () => {
    if (!zarpe?.id) return

    let vivos = []
    let pax = []
    let est = []

    if (navigator.onLine) {
      const { data: regs, error } = await supabase
        .from('registros')
        .select(reservaCon({ relaciones: [CON_LANCHA, CON_PLAN] }))
        .eq('fecha', zarpe.fecha)
        .eq('lancha_id', zarpe.lancha_id)

      if (!error) {
        vivos = (regs || []).filter(r => r.estado !== 'cancelada')
        if (vivos.length) {
          const { data } = await supabase.from('pasajeros').select('*')
            .in('registro_id', vivos.map(r => r.id))
          pax = data || []
        }
        const { data: e } = await supabase.from('estado_embarques').select('*')
          .eq('zarpe_id', zarpe.id)
        est = e || []
        // La copia local se refresca con lo que se acaba de leer.
        if (vivos.length) await db.registros.bulkPut(vivos)
        if (pax.length) await db.pasajeros.bulkPut(pax)
      }
    }

    if (!vivos.length) {
      const local = await leerDiaLocal(zarpe.fecha)
      vivos = local.registros
        .filter(r => r.lancha_id === zarpe.lancha_id && r.estado !== 'cancelada')
      pax = local.pasajeros.filter(p => vivos.some(r => r.id === p.registro_id))
      if (!est.length) est = derivarDeEmbarques(local.embarques.filter(e => e.zarpe_id === zarpe.id))
    }

    // Los hechos que aún no salieron del iPad cuentan igual.
    const enCola = await db.cola.where('tabla').equals('embarques').toArray()
    const propios = enCola.map(c => c.fila).filter(f => f.zarpe_id === zarpe.id)
    if (propios.length) {
      est = derivarDeEmbarques([
        ...est.map(e => ({ ...e, evento: e.estado, ocurrido_at: e.ocurrido_at })),
        ...propios,
      ])
    }

    // Y los nombres que se acaban de escribir en el muelle. Con red, la lista
    // de pasajeros viene del servidor y todavía no los tiene; sin esto la
    // plaza recién nombrada desaparecería un segundo y volvería, que en un
    // muelle se lee como que no se guardó.
    const paxEnCola = (await db.cola.where('tabla').equals('pasajeros').toArray())
      .map(c => c.fila)
      .filter(p => vivos.some(r => r.id === p.registro_id))
    if (paxEnCola.length) {
      const ya = new Set(pax.map(p => p.id))
      pax = [...pax, ...paxEnCola.filter(p => !ya.has(p.id))]
    }

    // En el regreso hace falta saber a quién se llevó esa lancha por la
    // mañana: la lista de vuelta no es "los que tenían reserva" sino "los que
    // subieron", que incluye a los walk-in y excluye a los que no llegaron.
    let ida = []
    if (zarpe.sentido === 'regreso') {
      let zarpesIda = []
      if (navigator.onLine) {
        const { data } = await supabase.from('zarpes').select('id')
          .eq('fecha', zarpe.fecha).eq('lancha_id', zarpe.lancha_id).eq('sentido', 'ida')
        zarpesIda = data || []
      }
      if (!zarpesIda.length) {
        const local = await leerDiaLocal(zarpe.fecha)
        zarpesIda = local.zarpes.filter(
          z => z.lancha_id === zarpe.lancha_id && z.sentido === 'ida')
      }

      const idsIda = zarpesIda.map(z => z.id)
      if (idsIda.length) {
        if (navigator.onLine) {
          const { data } = await supabase.from('estado_embarques').select('*').in('zarpe_id', idsIda)
          ida = data || []
        }
        if (!ida.length) {
          const local = await leerDiaLocal(zarpe.fecha)
          ida = derivarDeEmbarques(local.embarques.filter(e => idsIda.includes(e.zarpe_id)))
        }
        const enColaIda = (await db.cola.where('tabla').equals('embarques').toArray())
          .map(c => c.fila).filter(f => idsIda.includes(f.zarpe_id))
        if (enColaIda.length) {
          ida = derivarDeEmbarques([
            ...ida.map(e => ({ ...e, evento: e.estado })),
            ...enColaIda,
          ])
        }
      }
      ida = ida.filter(e => ['check_in', 'walk_in'].includes(e.estado))
    }

    setRegistros(vivos)
    setPasajeros(pax)
    setEstados(est)
    setEstadosIda(ida)
    setCargando(false)
  }, [zarpe?.id, zarpe?.fecha, zarpe?.lancha_id, zarpe?.sentido])

  useEffect(() => { cargar() }, [cargar])

  // Si la cola cambia (se encoló algo o se drenó), la lista se repinta.
  useEffect(() => alCambiarLaCola(cargar), [cargar])

  // Lo que marque otro dispositivo aparece aquí.
  useEffect(() => {
    if (!zarpe?.id) return
    const canal = supabase
      .channel(`embarque:${zarpe.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'embarques' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [zarpe?.id, cargar])

  const porClave = useMemo(() => {
    const mapa = new Map()
    estados.forEach(e => mapa.set(e.pasajero_id || e.client_id, e))
    return mapa
  }, [estados])

  /**
   * La lista agrupada por reserva.
   *
   * En la IDA se espera a quien tiene reserva: los que tienen nombre cargado
   * como filas propias, y las plazas que todavía no lo tienen —los grupos
   * grandes— como "Persona N de M", que igual embarcan.
   *
   * En el REGRESO se espera a quien subió. No es lo mismo: el que no llegó en
   * la mañana no puede bajar en la tarde, y el walk-in que subió sin reserva
   * sí tiene que volver. Ponerlo al revés haría que el contador de faltantes
   * —lo único que importa a las 3:30— dijera cualquier cosa.
   */
  const grupos = useMemo(() => {
    return registros.map(r => {
      const suyos = pasajeros.filter(p => p.registro_id === r.id)
      const plan = r.adultos + r.ninos + r.infantes + r.cortesias

      const subioEnLaIda = p =>
        !esRegreso || estadosIda.some(e => e.pasajero_id === p.id)

      const filas = suyos.filter(subioEnLaIda).map(p => ({
        tipo: 'nominal',
        pasajero_id: p.id,
        registro_id: r.id,
        nombre: p.nombre,
        documento: p.documento,
        categoria: p.categoria,
        estado: porClave.get(p.id)?.estado || null,
      }))

      // Cuántas plazas sin nombre hay que mostrar. La regla vive en
      // plazas.js, que es donde se prueba: de ella depende que un grupo no
      // aparezca con más ni con menos gente de la que tiene.
      const anonimos = estados.filter(e => e.registro_id === r.id && !e.pasajero_id)
      const cuantas = plazasSinNombre({
        plan,
        conNombre: suyos.length,
        anonimos: anonimos.length,
        esRegreso,
        subieron: estadosIda.filter(e => e.registro_id === r.id && !e.pasajero_id).length,
      })

      for (let i = 0; i < cuantas; i++) {
        const ev = anonimos[i]
        filas.push({
          tipo: 'sin_nombre',
          registro_id: r.id,
          indice: i,
          client_id: ev?.client_id,
          nombre: esRegreso
            ? `Persona ${i + 1} de ${cuantas}`
            : `Persona ${suyos.length + i + 1} de ${plan}`,
          estado: ev?.estado || null,
        })
      }

      const listos = filas.filter(f => EVENTOS_OK.includes(f.estado)).length
      return {
        registro: r, filas, plan,
        embarcados: listos,
        faltan: filas.length - listos,
      }
    }).filter(g => g.filas.length > 0)   // en el regreso, quien no fue no aparece
  }, [registros, pasajeros, porClave, estados, estadosIda, esRegreso, EVENTOS_OK])

  /**
   * Los que llegaron sin reserva. En el regreso son los que subieron así por
   * la mañana: también tienen que volver, y sin esto nadie los contaría.
   */
  const walkIns = useMemo(() => {
    if (!esRegreso) return estados.filter(e => e.estado === 'walk_in' && !e.registro_id)
    return estadosIda
      .filter(e => e.estado === 'walk_in' && !e.registro_id)
      .map(e => ({
        ...e,
        // Su estado de vuelta es el del zarpe de regreso, no el de la ida.
        estado: estados.find(x => x.nombre === e.nombre && x.documento === e.documento)?.estado || null,
      }))
  }, [estados, estadosIda, esRegreso])

  const contador = useMemo(() => {
    const enFilas = grupos.reduce((s, g) => s + g.filas.length, 0)
    const walkInsListos = esRegreso
      ? walkIns.filter(w => EVENTOS_OK.includes(w.estado)).length
      : walkIns.length
    const esperados = enFilas + (esRegreso ? walkIns.length : 0)
    const embarcados = grupos.reduce((s, g) => s + g.embarcados, 0) + walkInsListos
    const noLlegaron = grupos.reduce(
      (s, g) => s + g.filas.filter(f => f.estado === 'no_show').length, 0)
    return { esperados, embarcados, noLlegaron, faltan: Math.max(0, esperados - embarcados - noLlegaron) }
  }, [grupos, walkIns, esRegreso, EVENTOS_OK])

  /**
   * Registra un hecho. Nunca corrige: siempre inserta.
   *
   * Se escribe PRIMERO en la cola local y se devuelve de inmediato: en el
   * muelle nadie espera a la red para seguir embarcando. El envío ocurre
   * detrás, y reenviarlo es inofensivo gracias al client_id.
   */
  const registrarEvento = useCallback(async (fila, evento, extra = {}) => {
    if (!zarpe?.id) return { error: { message: 'Sin zarpe activo' } }
    const { data: sesion } = await supabase.auth.getSession().catch(() => ({ data: null }))

    const evt = {
      zarpe_id: zarpe.id,
      pasajero_id: fila?.pasajero_id || null,
      registro_id: fila?.registro_id || null,
      evento,
      nombre: extra.nombre || null,
      documento: extra.documento || null,
      tipo_documento: extra.tipo_documento || null,
      pais_id: extra.pais_id || null,
      categoria: extra.categoria || null,
      ocurrido_at: new Date().toISOString(),
      registrado_por: sesion?.session?.user?.id || null,
      dispositivo: dispositivo(),
      client_id: nuevoClientId(),
    }

    const quien = extra.nombre || fila?.nombre || 'Alguien'
    const ETIQUETA = {
      check_in: 'embarcó', no_show: 'no llegó',
      walk_in: 'sin reserva', desembarque: 'desembarcó',
    }
    await encolar('embarques', evt, `${quien} — ${ETIQUETA[evento] || evento}`)

    // La copia local guarda el hecho aunque el servidor todavía no lo sepa.
    await db.embarques.put(evt)
    await cargar()
    return { error: null }
  }, [zarpe?.id, cargar])

  /**
   * Ponerle nombre a una plaza suelta, en el muelle y antes de que suba.
   *
   * La Capitanía exige la lista nominal: una plaza sin nombre en el manifiesto
   * es un problema con la autoridad, no un hueco cosmético. Aquí se resuelve
   * donde ocurre —la persona está enfrente— en vez de dejarlo para la oficina,
   * que ya no la tiene delante.
   *
   * Crea el pasajero de verdad y lo embarca de un golpe. El pasajero se
   * encola primero para que llegue antes que su embarque: al revés, la llave
   * foránea rechazaría el embarque de alguien que todavía no existe.
   *
   * Solo se ofrece en plazas que NO han subido. Nombrar una que ya subió
   * anónima crearía una fila nueva sin borrar la vieja —los embarques son
   * inmutables— y el grupo pasaría a contar una persona de más.
   */
  const nombrarPlaza = useCallback(async (fila, datos) => {
    if (!zarpe?.id || !fila?.registro_id) return { error: { message: 'Plaza sin reserva' } }

    const pasajero = {
      id: nuevoClientId(),
      registro_id: fila.registro_id,
      nombre: (datos.nombre || '').trim(),
      tipo_documento: datos.tipo_documento || null,
      documento: (datos.documento || '').trim() || null,
      pais_id: datos.pais_id || null,
      categoria: datos.categoria || 'adulto',
    }

    // La clave de cola es su propio id: pasajeros no tiene client_id, y el id
    // ya es único en la base, que es lo único que la cola necesita.
    await encolar('pasajeros', pasajero, `${pasajero.nombre} — nombre`, pasajero.id)
    await db.pasajeros.put(pasajero)

    return registrarEvento(
      { pasajero_id: pasajero.id, registro_id: fila.registro_id, nombre: pasajero.nombre },
      esRegreso ? 'desembarque' : 'check_in'
    )
  }, [zarpe?.id, esRegreso, registrarEvento])

  const cerrar = useCallback(async () => {
    const { data, error } = await supabase.rpc('cerrar_zarpe', { p_zarpe_id: zarpe.id })
    return { zarpe: Array.isArray(data) ? data[0] : data, error }
  }, [zarpe?.id])

  return {
    grupos, walkIns, contador, cargando, registrarEvento, nombrarPlaza, cerrar,
    recargar: cargar,
    esRegreso,
    // El hecho que se registra al tocar una fila, según el sentido del viaje.
    eventoDelToque: esRegreso ? 'desembarque' : 'check_in',
    eventosOk: EVENTOS_OK,
    // Crudos, para el manifiesto: lo arma armarManifiesto() y no esta pantalla.
    registros, pasajeros, estados,
  }
}
