import { supabase } from './supabase'

/**
 * Qué le falta al sistema para poder operar un día de verdad.
 *
 * ── Por qué esto existe ─────────────────────────────────────────────────────
 *
 * «Cargar los catálogos reales» era un pendiente que vivía en la cabeza del
 * dueño y en un documento. Eso funciona una vez; no funciona el día que se
 * monte otro entorno, ni cuando alguien borre algo sin darse cuenta.
 *
 * **La app tiene que saber decir qué le falta.** No es una lista de tareas: es
 * la comprobación de que la primera reserva se puede crear — que es
 * exactamente el umbral que separa «hay software» de «se puede trabajar».
 *
 * ── Qué se comprueba y qué no ───────────────────────────────────────────────
 *
 * Solo lo que **detiene** algo, y en el orden en que detiene:
 *
 *   · **Lanchas, planes y canales** — son NOT NULL en `registros`. Sin uno de
 *     los tres no se puede guardar ni una reserva.
 *   · **Temporadas** — no detiene, y por eso es la más peligrosa: sin ellas la
 *     app asume «baja» y **congela el precio bajo** en una fecha de temporada
 *     alta (regla 4). Un error que no se ve hasta que se factura.
 *   · **Pilotos** — el manifiesto de la Capitanía lleva el nombre del piloto.
 *     No detiene la reserva; detiene el zarpe.
 *
 * Países y canales vienen sembrados por las migraciones 027 y 028, y los tipos
 * de ingreso por la 007: se comprueban igual, porque una base montada a mano
 * puede no tenerlos y el fallo aparecería en el peor momento.
 */

const REQUISITOS = [
  {
    id: 'lanchas',
    tabla: 'lanchas',
    filtro: q => q.eq('activa', true),
    texto: 'No hay lanchas',
    detalle: 'Toda reserva viaja en una: sin lanchas no se puede guardar ninguna.',
    accion: { etiqueta: 'Cargar las lanchas', a: '/equipo' },
    detiene: 'la reserva',
  },
  {
    id: 'planes',
    tabla: 'planes',
    filtro: q => q.eq('activo', true),
    texto: 'No hay planes',
    detalle: 'El plan da la tarifa y decide qué platos se pueden elegir.',
    accion: { etiqueta: 'Cargar los planes', a: '/config/planes' },
    detiene: 'la reserva',
  },
  {
    id: 'canales',
    tabla: 'canales',
    texto: 'No hay canales de venta',
    detalle: 'Por dónde entró la reserva. Es obligatorio en toda reserva.',
    accion: { etiqueta: 'Cargar los canales', a: '/config/operacion' },
    detiene: 'la reserva',
  },
  {
    id: 'temporadas',
    tabla: 'temporadas',
    texto: 'No hay temporadas',
    // La única que no detiene nada y por eso hay que decirla más fuerte.
    detalle: 'Sin temporadas el sistema asume baja y congela el precio bajo, '
      + 'aunque la fecha sea de alta. Es un error que no se ve hasta que se factura.',
    accion: { etiqueta: 'Cargar las temporadas', a: '/config/temporadas' },
    detiene: 'el precio',
  },
  {
    id: 'pilotos',
    tabla: 'pilotos',
    filtro: q => q.eq('activo', true),
    texto: 'No hay pilotos',
    detalle: 'El manifiesto de la Capitanía lleva el nombre del piloto.',
    accion: { etiqueta: 'Cargar los pilotos', a: '/equipo' },
    detiene: 'el zarpe',
  },
  {
    id: 'tipos_ingreso',
    tabla: 'tipos_ingreso',
    texto: 'No hay tipos de ingreso',
    detalle: 'De aquí salen las tres banderas de cada persona: si ocupa cupo, '
      + 'si consume tiquete y si genera ingreso. Las siembra la migración 007.',
    accion: null,
    detiene: 'la reserva',
  },
]

/**
 * Los requisitos que están sin cumplir, en orden de lo que detienen.
 *
 * Una tabla que falla al consultarse **no se reporta como vacía**: no saber si
 * hay lanchas no es lo mismo que saber que no hay, y decir lo segundo mandaría
 * a alguien a cargar lo que ya está.
 */
export async function loQueFalta() {
  const resultados = await Promise.all(
    REQUISITOS.map(async r => {
      let consulta = supabase.from(r.tabla).select('id', { count: 'exact', head: true })
      if (r.filtro) consulta = r.filtro(consulta)
      const { count, error } = await consulta
      return { requisito: r, vacio: !error && (count ?? 0) === 0 }
    })
  )

  const orden = { 'la reserva': 0, 'el precio': 1, 'el zarpe': 2 }
  return resultados
    .filter(x => x.vacio)
    .map(x => x.requisito)
    .sort((a, b) => orden[a.detiene] - orden[b.detiene])
}
