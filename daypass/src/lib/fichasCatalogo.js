import { supabase } from './supabase'
import { hoyLocal, formatDateShort } from './utils'

/**
 * Los cuatro catálogos que tienen ficha propia, descritos en un sitio.
 *
 * ── Por qué un descriptor y no cuatro pantallas ─────────────────────────────
 *
 * Lancha, piloto, empleado y temporada son la misma forma: unos campos, un
 * estado con su consecuencia, y un «dónde se usa» que hay que saber **antes**
 * de desactivar. Escribir cuatro pantallas casi iguales es garantizar que en
 * seis meses sean cuatro pantallas distintas.
 *
 * El plan tiene la suya aparte porque además administra platos, que no se
 * parece a nada de esto.
 *
 * ── «Dónde se usa» es lo que justifica la ficha ─────────────────────────────
 *
 * Hoy desactivar una lancha es un interruptor sin consecuencia visible. Con
 * esto dice cuántas reservas futuras la tienen puesta — que es la diferencia
 * entre una decisión y una apuesta.
 */

/** Las reservas que apuntan a algo, en total y de hoy en adelante. */
async function reservasQueUsan(columna, id) {
  const hoy = hoyLocal()
  const [total, futuras] = await Promise.all([
    supabase.from('reservas').select('id', { count: 'exact', head: true })
      .eq(columna, id).neq('estado', 'cancelada'),
    supabase.from('reservas').select('id', { count: 'exact', head: true })
      .eq(columna, id).neq('estado', 'cancelada').gte('fecha', hoy),
  ])
  return [
    { etiqueta: 'Reservas en total', valor: total.count ?? 0 },
    { etiqueta: 'De hoy en adelante', valor: futuras.count ?? 0 },
  ]
}

async function cuantos(tabla, columna, id) {
  const { count } = await supabase.from(tabla).select(columna, { count: 'exact', head: true })
    .eq(columna, id)
  return count ?? 0
}

export const FICHAS = {
  lanchas: {
    tabla: 'lanchas',
    singular: 'lancha',
    volverA: '/equipo',
    volverEtiqueta: 'Lanchas, pilotos y empleados',
    campoActivo: 'activa',
    titulo: r => r.nombre,
    subtitulo: r => [r.codigo, r.capacidad ? `${r.capacidad} asientos` : null]
      .filter(Boolean).join(' · '),
    estado: {
      siEs: 'Se puede usar',
      siNoEs: 'Fuera de servicio',
      explicaSi: 'Se le pueden asignar reservas y zarpes.',
      explicaNo: 'No se le asignan reservas nuevas. Las que ya la tienen no cambian.',
    },
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'codigo', etiqueta: 'Código' },
      { clave: 'capacidad', etiqueta: 'Capacidad', numero: true,
        ayuda: 'De aquí sale el aviso de sobrecupo al cerrar el día.' },
      { clave: 'prioridad', etiqueta: 'Prioridad', numero: true,
        ayuda: 'El orden en que se llenan. Majagua 1 y 2 primero (regla 21).' },
    ],
    async uso(id) {
      const [reservas, zarpes] = await Promise.all([
        reservasQueUsan('lancha_id', id),
        cuantos('zarpes', 'lancha_id', id),
      ])
      return [...reservas, { etiqueta: 'Zarpes', valor: zarpes }]
    },
  },

  pilotos: {
    tabla: 'pilotos',
    singular: 'piloto',
    volverA: '/equipo',
    volverEtiqueta: 'Lanchas, pilotos y empleados',
    campoActivo: 'activo',
    titulo: r => r.nombre,
    subtitulo: r => r.documento || 'Sin documento',
    estado: {
      siEs: 'Puede navegar',
      siNoEs: 'Ya no navega',
      explicaSi: 'Aparece al asignar el piloto de un zarpe.',
      explicaNo: 'No aparece en zarpes nuevos. Los que ya hizo se quedan a su nombre.',
    },
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'documento', etiqueta: 'Documento' },
    ],
    async uso(id) {
      return [{ etiqueta: 'Zarpes que ha hecho', valor: await cuantos('zarpes', 'piloto_id', id) }]
    },
  },

  empleados: {
    tabla: 'empleados',
    singular: 'empleado',
    volverA: '/equipo',
    volverEtiqueta: 'Lanchas, pilotos y empleados',
    campoActivo: 'activo',
    titulo: r => r.nombre,
    subtitulo: r => r.documento || 'Sin documento',
    estado: {
      siEs: 'Va a bordo',
      siNoEs: 'Ya no va a bordo',
      explicaSi: 'Se le puede sumar a la lista nominal de un zarpe.',
      explicaNo: 'No aparece en zarpes nuevos. Los manifiestos viejos lo siguen nombrando.',
    },
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'documento', etiqueta: 'Documento',
        ayuda: 'La Capitanía lo exige también para los empleados (regla 15).' },
    ],
    async uso(id) {
      return [{
        etiqueta: 'Zarpes en los que fue',
        valor: await cuantos('zarpe_empleados', 'empleado_id', id),
      }]
    },
  },

  temporadas: {
    tabla: 'temporadas',
    singular: 'temporada',
    volverA: '/config/temporadas',
    volverEtiqueta: 'Temporadas',
    campoActivo: null,
    titulo: r => r.nombre,
    subtitulo: r => `${r.tipo === 'alta' ? 'Temporada alta' : 'Temporada baja'} · `
      + `${formatDateShort(r.fecha_inicio)} a ${formatDateShort(r.fecha_fin)}`,
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'fecha_inicio', etiqueta: 'Desde', fecha: true },
      { clave: 'fecha_fin', etiqueta: 'Hasta', fecha: true },
    ],
    /**
     * Aquí «dónde se usa» no es una llave foránea: una reserva no apunta a una
     * temporada, cae dentro de sus fechas. Se cuenta por rango, que es
     * exactamente como el sistema decide qué precio aplicar.
     */
    async uso(id, fila) {
      const { count } = await supabase.from('reservas')
        .select('id', { count: 'exact', head: true })
        .gte('fecha', fila.fecha_inicio).lte('fecha', fila.fecha_fin)
        .neq('estado', 'cancelada')
      return [{ etiqueta: 'Reservas en estas fechas', valor: count ?? 0 }]
    },
  },
}
