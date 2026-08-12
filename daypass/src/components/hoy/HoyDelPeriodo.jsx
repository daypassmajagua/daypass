import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, hoyLocal, aFechaLocal, classNames } from '../../lib/utils'
import { etiquetaDePeriodo, porcentaje } from '../../lib/metas'
import { BloqueDato, TarjetaPendiente, EstadoError, Esqueleto } from '../patrones'

/**
 * «Hoy» para gerencia: el negocio, no la operación.
 *
 * ── Una cosa por pantalla ───────────────────────────────────────────────────
 *
 * La pregunta de esta es *«¿tengo que llamar a alguien hoy?»*. Si los bloques
 * están quietos, la respuesta es no y eso se ve en dos segundos. Por eso la
 * meta va sola y grande, y los otros tres debajo y en pequeño: **cuatro
 * indicadores del mismo tamaño no son una respuesta, son cuatro preguntas**.
 *
 * ── Sin `total_calculado` ───────────────────────────────────────────────────
 *
 * Los ingresos salen de `avance_metas`, que suma con `valor_a_cobrar()`. Es la
 * misma trampa que la cartera ya corrigió: `total_calculado` le pone precio a
 * una cortesía, a un huésped de alojamiento y a un empleado, y esa plata no
 * existe. Informes todavía la suma mal; esta pantalla nace corregida.
 *
 * ── Pensada para el celular ─────────────────────────────────────────────────
 *
 * La directora la abre tres veces al día en la mano, no en un monitor. De ahí
 * que sea una columna y no una parrilla.
 */
export default function HoyDelPeriodo() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    const hoy = hoyLocal()
    const [y, m, d] = hoy.split('-').map(Number)
    const hace30 = aFechaLocal(new Date(y, m - 1, d - 30))

    const [metas, cartera, delMes, deHoy] = await Promise.all([
      supabase.from('avance_metas').select('*'),
      supabase.from('cartera_por_organizacion').select('organizacion, mas_de_90'),
      supabase.from('reservas').select('fecha, adultos, ninos')
        .gte('fecha', hace30).lt('fecha', hoy).neq('estado', 'cancelada'),
      supabase.from('reservas').select('adultos, ninos')
        .eq('fecha', hoy).neq('estado', 'cancelada'),
    ])

    if (metas.error) { setError(metas.error.message); return }
    setError(null)

    // La meta que corre ahora. Se prefiere la del pasadía entero —la que no
    // tiene dueño— sobre la de una persona: gerencia mira el negocio, no a
    // alguien en particular.
    const vigentes = (metas.data || []).filter(x => x.desde <= hoy && hoy <= x.hasta)
    const meta = vigentes.find(x => !x.responsable_id) || vigentes[0] || null

    const paxHoy = (deHoy.data || []).reduce((s, r) => s + (r.adultos || 0) + (r.ninos || 0), 0)

    // El promedio se saca sobre los días que tuvieron gente, no sobre 30: un
    // hotel que no opera los martes tendría un promedio inventado a la baja.
    const porDia = {}
    for (const r of delMes.data || []) {
      porDia[r.fecha] = (porDia[r.fecha] || 0) + (r.adultos || 0) + (r.ninos || 0)
    }
    const dias = Object.values(porDia).filter(n => n > 0)
    const promedio = dias.length ? Math.round(dias.reduce((s, n) => s + n, 0) / dias.length) : null

    const vencida = (cartera.data || []).reduce((s, o) => s + Number(o.mas_de_90 || 0), 0)
    const debenViejo = (cartera.data || []).filter(o => Number(o.mas_de_90 || 0) > 0)

    setDatos({ meta, paxHoy, promedio, vencida, debenViejo })
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (error) return <EstadoError error={error} onReintentar={cargar} />
  if (!datos) return <Esqueleto filas={3} />

  const { meta, paxHoy, promedio, vencida, debenViejo } = datos
  const pct = meta ? porcentaje(meta.logrado, meta.valor) : null
  const enIngresos = meta?.unidad === 'ingresos'

  return (
    <div className="flex flex-col gap-5">
      {/* 1 · La meta, sola y grande. Para gerencia la pregunta es una. */}
      {meta ? (
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_2px_rgba(22,24,44,.05)]">
          <BloqueDato
            tamano="lg"
            etiqueta={`Meta · ${etiquetaDePeriodo(meta.periodo, meta.numero, meta.anio)}`}
            valor={`${pct}%`}
            // Verde solo si ya se cumplió: un color de «vamos bien» a mitad de
            // mes es una opinión, y esta pantalla no opina.
            tono={pct >= 100 ? 'cerrado' : 'normal'}
            detalle={enIngresos
              ? `${formatCurrency(meta.logrado)} de ${formatCurrency(meta.valor)}`
              : `${meta.logrado} de ${meta.valor} personas`}
          />
          <Barra pct={pct} />
        </div>
      ) : (
        // `TarjetaPendiente` es un `<li>`: va dentro de una lista aunque sea
        // de una sola, porque un `li` suelto no es HTML válido.
        <ul>
          <TarjetaPendiente pendiente={{
            id: 'sin-meta',
            tono: 'pendiente',
            texto: 'No hay una meta puesta para este periodo',
            detalle: 'Sin meta esta pantalla no puede decir si vamos bien.',
            accion: { etiqueta: 'Poner la meta', a: '/metas' },
          }} />
        </ul>
      )}

      {/* 2 · Los tres de apoyo. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white rounded-2xl p-5 shadow-[0_1px_2px_rgba(22,24,44,.05)]">
        <BloqueDato
          etiqueta="Hoy"
          valor={paxHoy}
          unidad={paxHoy === 1 ? 'persona' : 'personas'}
          comparacion={promedio
            ? { texto: 'que un día normal', delta: paxHoy - promedio }
            : undefined}
        />
        {enIngresos && (
          <BloqueDato
            etiqueta="El periodo"
            valor={formatCurrency(meta.logrado)}
            detalle="lo que de verdad se cobra"
          />
        )}
        <BloqueDato
          etiqueta="Vencida"
          valor={formatCurrency(vencida)}
          detalle="más de 90 días"
          tono={vencida > 0 ? 'pendiente' : 'normal'}
        />
      </div>

      {/* 3 · Lo que hay que hacer, si hay algo. */}
      {debenViejo.length > 0 && (
        <ul>
          <TarjetaPendiente pendiente={{
            id: 'cartera-vieja',
            tono: 'pendiente',
            texto: debenViejo.length === 1
              ? `${debenViejo[0].organizacion} debe hace más de 90 días`
              : `${debenViejo.length} agencias deben hace más de 90 días`,
            detalle: 'A partir de los 90 días la plata se cobra llamando, no esperando.',
            accion: { etiqueta: 'Ver la cartera', a: '/cartera' },
          }} />
        </ul>
      )}

      {/* 4 · Dos enlaces, los dos sustantivos que sí están en su menú. */}
      <div className="flex items-center gap-2 flex-wrap">
        {[['/informes', 'Informes'], ['/cartera', 'Cartera']].map(([a, etiqueta]) => (
          <Link
            key={a}
            to={a}
            className="inline-flex items-center gap-1.5 min-h-[2.75rem] px-4 rounded-xl bg-white text-[0.9375rem] font-bold text-blue-700 ring-1 ring-linea hover:ring-blue-500"
          >
            {etiqueta}
            <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </div>
  )
}

/** La barra de la meta. Verde solo cuando ya se cumplió. */
function Barra({ pct }) {
  return (
    <div className="mt-3 h-2 rounded-full bg-fondo overflow-hidden">
      <div
        className={classNames(
          'h-full rounded-full transition-[width] duration-300',
          pct >= 100 ? 'bg-verde-500' : 'bg-blue-600'
        )}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}
