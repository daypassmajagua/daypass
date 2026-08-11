import { supabase } from './supabase'
import { formatDateShort } from './utils'

/**
 * La búsqueda global: escribir en vez de navegar.
 *
 * Con siete sustantivos en el menú, esto deja de ser un accesorio y pasa a ser
 * la otra mitad de la navegación. Un menú corto solo funciona si lo que no
 * está en el menú se alcanza escribiendo.
 *
 * ── Cuatro consultas y no una ───────────────────────────────────────────────
 *
 * Cada grupo pregunta por su lado, en paralelo. Tres razones, en orden de
 * importancia:
 *
 * 1. **Cada tabla tiene su propia RLS.** Una consulta gigante que las mezclara
 *    tendría que reimplementar cuatro políticas en un `union`, y ese es el
 *    tipo de código que se desincroniza de la seguridad real sin avisar. Así,
 *    quien no puede ver reservas simplemente recibe cero reservas.
 * 2. **Una lenta no detiene a las demás.** Los resultados aparecen por grupo,
 *    conforme llegan.
 * 3. **Se agrega un grupo agregando una función**, no reescribiendo un `union`.
 *
 * ── Sin funciones nuevas en la base ─────────────────────────────────────────
 *
 * Personas ya tiene la suya —`buscar_personas`, de la 020, con el documento
 * normalizado— y las otras tres son `select` con `or`, que PostgREST resuelve
 * respetando la RLS de cada tabla. En PostgreSQL toda función nace ejecutable
 * por `PUBLIC` y cada `create or replace` restablece ese permiso: tres
 * funciones nuevas son tres puertas que hay que acordarse de cerrar en cada
 * migración. Estas consultas no abren ninguna.
 *
 * ── El folio no es un grupo ─────────────────────────────────────────────────
 *
 * Quien tiene el folio en la mano lo escribe y quiere caer en la reserva. Un
 * grupo «Folios» que abriera la misma pantalla que el grupo «Reservas» sería
 * el mismo destino ofrecido dos veces.
 */

/** Desde aquí se busca. Menos letras devuelven media base de datos. */
export const MINIMO = 3

/** Lo que espera entre teclas: ni cada letra ni una eternidad. */
export const RESPIRO = 250

/** Cuántos por grupo. Más no cabe en pantalla sin desplazarse. */
const POR_GRUPO = 5

/** Para `ilike` de PostgREST: los comodines van con `*`, no con `%`. */
function comodin(texto) {
  return `*${texto.replace(/[,*()]/g, ' ').trim()}*`
}

// ─── Los cuatro grupos ────────────────────────────────────────────────────────

async function personas(texto) {
  const { data } = await supabase.rpc('buscar_personas', { p_texto: texto, p_limite: POR_GRUPO })
  return (data || []).map(p => ({
    tipo: 'persona',
    id: p.id,
    titulo: p.nombre_completo,
    detalle: [
      p.documento || null,
      p.veces > 0 ? `${p.veces} ${p.veces === 1 ? 'vez' : 'veces'}` : null,
    ].filter(Boolean).join(' · '),
    a: `/clientes/${p.id}`,
  }))
}

async function reservas(texto) {
  const q = comodin(texto)
  const { data } = await supabase
    .from('reservas')
    .select('id, fecha, estado, nombre_pasajero, nombre_grupo, folio_zeus, adultos, ninos, infantes, cortesias')
    .or(`nombre_pasajero.ilike.${q},nombre_grupo.ilike.${q},folio_zeus.ilike.${q}`)
    .order('fecha', { ascending: false })
    .limit(POR_GRUPO)

  return (data || []).map(r => {
    const pax = (r.adultos || 0) + (r.ninos || 0) + (r.infantes || 0) + (r.cortesias || 0)
    return {
      tipo: 'reserva',
      id: r.id,
      titulo: r.nombre_grupo || r.nombre_pasajero || 'Sin nombre',
      detalle: [
        formatDateShort(r.fecha),
        r.estado,
        pax ? `${pax} pax` : null,
        r.folio_zeus ? `folio ${r.folio_zeus}` : null,
      ].filter(Boolean).join(' · '),
      a: `/editar/${r.id}`,
    }
  })
}

async function organizaciones(texto) {
  const q = comodin(texto)
  const { data } = await supabase
    .from('organizaciones')
    .select('id, nombre, tipo, nit, activa')
    .or(`nombre.ilike.${q},nit.ilike.${q}`)
    .order('nombre')
    .limit(POR_GRUPO)

  return (data || []).map(o => ({
    tipo: 'organizacion',
    id: o.id,
    titulo: o.nombre,
    detalle: [o.tipo, o.nit, o.activa === false ? 'ya no se usa' : null]
      .filter(Boolean).join(' · '),
    // Todavía no tiene ficha propia: cae en la sección donde vive. Cuando la
    // tenga (paso 7), esta línea es lo único que cambia.
    a: '/config/agencias',
  }))
}

async function tripulacion(texto) {
  const q = comodin(texto)
  const [lanchas, empleados] = await Promise.all([
    supabase.from('lanchas').select('id, nombre, codigo, activa').or(`nombre.ilike.${q},codigo.ilike.${q}`).limit(POR_GRUPO),
    supabase.from('empleados').select('id, nombre, documento, activo').or(`nombre.ilike.${q},documento.ilike.${q}`).limit(POR_GRUPO),
  ])

  return [
    ...(lanchas.data || []).map(l => ({
      tipo: 'lancha',
      id: l.id,
      titulo: l.nombre,
      detalle: [l.codigo, l.activa === false ? 'fuera de servicio' : null].filter(Boolean).join(' · '),
      a: '/equipo',
    })),
    ...(empleados.data || []).map(e => ({
      tipo: 'empleado',
      id: e.id,
      titulo: e.nombre,
      detalle: [e.documento, e.activo === false ? 'ya no trabaja' : null].filter(Boolean).join(' · '),
      a: '/equipo',
    })),
  ].slice(0, POR_GRUPO)
}

/**
 * Los grupos, en el orden en que se muestran.
 *
 * El orden no es alfabético ni casual: es la frecuencia con que se busca cada
 * cosa. Una persona que llama y una reserva que hay que abrir son el día a
 * día; una lancha se busca una vez al mes.
 */
export const GRUPOS = [
  { clave: 'personas', etiqueta: 'Personas', buscar: personas },
  { clave: 'reservas', etiqueta: 'Reservas', buscar: reservas },
  { clave: 'organizaciones', etiqueta: 'Agencias y organizaciones', buscar: organizaciones },
  { clave: 'tripulacion', etiqueta: 'Lanchas y empleados', buscar: tripulacion },
]

/**
 * Busca en los cuatro a la vez y devuelve los grupos que trajeron algo.
 *
 * Un grupo que falla —sin permiso, sin red— devuelve vacío y no tumba a los
 * demás: media respuesta sirve, una pantalla en blanco no.
 */
export async function buscarTodo(texto) {
  const limpio = String(texto || '').trim()
  if (limpio.length < MINIMO) return []

  const resultados = await Promise.all(
    GRUPOS.map(g => g.buscar(limpio).catch(() => []))
  )

  return GRUPOS
    .map((g, i) => ({ ...g, items: resultados[i] }))
    .filter(g => g.items.length > 0)
}

/** Todos los resultados en una sola fila, para las flechas y el Enter. */
export function aplanar(grupos) {
  return grupos.flatMap(g => g.items)
}
