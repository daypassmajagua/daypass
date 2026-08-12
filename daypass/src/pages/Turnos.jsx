import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { classNames, hoyLocal, fraseFecha } from '../lib/utils'
import { usePerfil } from '../hooks/usePerfil'
import { EstadoError, Esqueleto, PanelLateral } from '../components/patrones'
import PageHeader from '../components/layout/PageHeader'
import Select from '../components/ui/Select'
import {
  TIPOS, CODIGOS, puedeAsignar, diasDelMes, huecosAntes,
  mesAnterior, mesSiguiente, nombreDelMes, mesDeHoy, estadoDelDia, iniciales,
} from '../lib/turnos'

/**
 * Los turnos del mes.
 *
 * ── Por qué un calendario y no una lista ────────────────────────────────────
 *
 * Un turno no es un registro que se consulte: es una casilla de un mes que hay
 * que llenar. La pregunta que trae aquí no es «¿quién tiene el turno del 14?»
 * sino **«¿qué días de este mes están sin cubrir?»**, y esa pregunta solo se
 * responde de un vistazo si el mes se ve entero.
 *
 * ── El color dice lo único que importa ──────────────────────────────────────
 *
 * Coral **solo** en los días que tienen gente confirmada y no tienen a nadie
 * en embarque: sin quien embarque, la lancha no sale. Un día sin reservas se
 * queda en gris aunque no tenga turnos — marcarlo también sería enseñarle a
 * la gente a ignorar el color.
 *
 * ── Un toque por día ────────────────────────────────────────────────────────
 *
 * El día abre el panel lateral con sus tres turnos, y **cada turno se guarda
 * solo al elegir**. No hay botón de guardar: asignar un turno es una decisión
 * suelta, no un formulario, y quien está repartiendo el mes hace veinte
 * seguidas. La barra de guardado existe para lo que se edita en conjunto —una
 * tarifa, un plan—, no para esto.
 */
export default function Turnos() {
  const { mes: mesUrl } = useParams()
  const navigate = useNavigate()
  const { rol } = usePerfil()

  const mes = /^\d{4}-\d{2}$/.test(mesUrl || '') ? mesUrl : mesDeHoy()

  const [turnos, setTurnos] = useState({})     // fecha → { tipo: {user_id, nombre} }
  const [paxPorDia, setPaxPorDia] = useState({})
  const [equipo, setEquipo] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [diaAbierto, setDiaAbierto] = useState(null)

  const dias = diasDelMes(mes)

  // El rango se calcula dentro y la dependencia es el mes, no dos fechas
  // derivadas: con las derivadas el compilador de React no puede conservar la
  // memoización y la consulta se rearma en cada render.
  const cargar = useCallback(async () => {
    const delMes = diasDelMes(mes)
    const desde = delMes[0]
    const hasta = delMes[delMes.length - 1]

    setCargando(true)
    const [g, r, p] = await Promise.all([
      supabase.from('guardias').select('*').gte('fecha', desde).lte('fecha', hasta),
      // Cuánta gente viene cada día: es lo que decide si un hueco es un hueco.
      // Las canceladas y las que no llegaron no cuentan — no hay a quién subir.
      supabase.from('reservas').select('fecha, estado, adultos, ninos, infantes, cortesias')
        .gte('fecha', desde).lte('fecha', hasta),
      supabase.from('perfiles').select('user_id, nombre, rol, activo').order('nombre'),
    ])

    if (g.error) { setError(g.error.message); setCargando(false); return }
    setError(null)

    const nombreDe = new Map((p.data || []).map(x => [x.user_id, x.nombre]))
    const porDia = {}
    for (const fila of g.data || []) {
      porDia[fila.fecha] = porDia[fila.fecha] || {}
      porDia[fila.fecha][fila.tipo] = {
        user_id: fila.user_id,
        nombre: nombreDe.get(fila.user_id) || 'alguien que ya no está',
        // Quién repartió el turno. La sella el servidor desde la 030; antes
        // la columna existía y siempre venía vacía.
        asignoNombre: nombreDe.get(fila.asignada_por) || null,
      }
    }
    setTurnos(porDia)

    const pax = {}
    for (const res of r.data || []) {
      if (['cancelada', 'noshow'].includes(res.estado)) continue
      pax[res.fecha] = (pax[res.fecha] || 0)
        + (res.adultos || 0) + (res.ninos || 0) + (res.infantes || 0) + (res.cortesias || 0)
    }
    setPaxPorDia(pax)

    setEquipo((p.data || []).filter(x => x.activo !== false))
    setCargando(false)
  }, [mes])

  useEffect(() => { cargar() }, [cargar])

  /**
   * Asignar un turno: se borra y se pone.
   *
   * `guardias` tiene llave primaria `(fecha, tipo)` y **no tiene `id`**, así
   * que un `upsert` normal no sabe contra qué chocar. Borrar y poner dice
   * exactamente lo que pasa —un turno lo cubre una persona, y asignar a otra
   * es reemplazar— y funciona igual contra la base y contra la demo.
   */
  async function asignar(fecha, tipo, userId) {
    const borrado = await supabase.from('guardias').delete().eq('fecha', fecha).eq('tipo', tipo)
    if (borrado.error) { toast.error('No se pudo cambiar el turno. ' + borrado.error.message); return }

    if (userId) {
      const { error: err } = await supabase.from('guardias').insert({ fecha, tipo, user_id: userId })
      if (err) { toast.error('No se pudo asignar. ' + err.message); await cargar(); return }
      toast.success('Turno asignado')
    } else {
      toast.success('Turno libre')
    }
    await cargar()
  }

  const opcionesEquipo = [
    { value: '', label: 'Sin asignar' },
    ...equipo.map(p => ({ value: p.user_id, label: p.nombre })),
  ]

  const hoy = hoyLocal()

  return (
    <div className="marco py-6">
      <PageHeader
        title="Turnos"
        subtitle="Quién está en el muelle y en la isla cada día. El turno habilita las acciones de ese día; el rol no cambia."
      />

      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => navigate(`/config/turnos/${mesAnterior(mes)}`)}
          aria-label="Mes anterior"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-white hover:text-tinta"
        >
          <ChevronLeft size={20} />
        </button>
        {/* `capitalize` de Tailwind pone en mayúscula cada palabra y dejaba
            «Agosto De 2026». Solo la primera letra. */}
        <h2 className="text-[19px] font-bold text-tinta first-letter:uppercase">
          {nombreDelMes(mes)}
        </h2>
        <button
          onClick={() => navigate(`/config/turnos/${mesSiguiente(mes)}`)}
          aria-label="Mes siguiente"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-tinta-2 hover:bg-white hover:text-tinta"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {cargando ? (
        <Esqueleto filas={5} />
      ) : error ? (
        <EstadoError error={error} onReintentar={cargar} />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(d => (
              <div key={d} className="text-[11px] font-bold uppercase tracking-wider text-tinta-2 text-center pb-1">
                {d}
              </div>
            ))}

            {Array.from({ length: huecosAntes(mes) }, (_, i) => <div key={`hueco-${i}`} />)}

            {dias.map(fecha => (
              <DiaDelMes
                key={fecha}
                fecha={fecha}
                esHoy={fecha === hoy}
                pax={paxPorDia[fecha] || 0}
                turnos={turnos[fecha] || {}}
                onAbrir={() => setDiaAbierto(fecha)}
              />
            ))}
          </div>

          <Leyenda />
        </>
      )}

      {diaAbierto && (
        <PanelLateral
          titulo={fraseFecha(diaAbierto)}
          subtitulo={
            paxPorDia[diaAbierto]
              ? `${paxPorDia[diaAbierto]} personas confirmadas`
              : 'Todavía no viene nadie'
          }
          onCerrar={() => setDiaAbierto(null)}
        >
          <div className="flex flex-col gap-5">
            {TIPOS.map(t => {
              const puede = puedeAsignar(rol, t.codigo)
              const puesto = turnos[diaAbierto]?.[t.codigo]
              return (
                <div key={t.codigo}>
                  <Select
                    label={t.etiqueta}
                    value={puesto?.user_id || ''}
                    onChange={v => asignar(diaAbierto, t.codigo, v || null)}
                    options={opcionesEquipo}
                    disabled={!puede}
                    placeholder="Sin asignar"
                  />
                  <p className="text-[13px] text-tinta-2 mt-1">
                    {t.porque}
                    {!puede && ' La asigna la dirección.'}
                    {puesto?.asignoNombre && ` Lo puso ${puesto.asignoNombre}.`}
                  </p>
                </div>
              )
            })}

            <p className="text-[13px] text-tinta-2 border-t border-linea pt-3">
              Cada turno se guarda al elegirlo. Lo que llegue ese día —el manifiesto, los avisos—
              le llega a quien esté aquí, no a quien lo hizo la vez pasada.
            </p>
          </div>
        </PanelLateral>
      )}
    </div>
  )
}

// ─── Un día ───────────────────────────────────────────────────────────────────

const COLOR = {
  // Coral solo donde hay algo que hacer hoy: gente confirmada y nadie que la
  // embarque. Es el único hueco que detiene una lancha.
  pendiente: 'bg-coral-50 ring-coral-500',
  incompleto: 'bg-white ring-aviso-300',
  listo: 'bg-white ring-linea',
  quieto: 'bg-fondo ring-transparent',
  // Lo que ya pasó se ve como lo que es: consultable, no accionable.
  pasado: 'bg-fondo ring-transparent opacity-60',
}

/**
 * Un día del calendario. Se llamaba `Casilla` y colisionaba de nombre con la
 * casilla de marcar de Config: dos componentes homónimos que no se parecen en
 * nada son un `import` equivocado esperando a pasar.
 */
function DiaDelMes({ fecha, esHoy, pax, turnos, onAbrir }) {
  const estado = estadoDelDia({ fecha, pax, turnos })
  const dia = Number(fecha.slice(8, 10))

  return (
    <button
      onClick={onAbrir}
      className={classNames(
        'aspect-square sm:aspect-[4/3] min-h-[64px] rounded-xl ring-1 p-1.5 sm:p-2 text-left',
        'flex flex-col gap-1 transition-colors hover:ring-blue-500',
        COLOR[estado],
        esHoy && 'ring-2 ring-blue-600'
      )}
      aria-label={`${dia}, ${pax ? `${pax} personas` : 'sin reservas'}`}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className={classNames(
          'text-[13px] font-bold tabular',
          esHoy ? 'text-blue-700' : 'text-tinta'
        )}>
          {dia}
        </span>
        {pax > 0 && <span className="text-[11px] text-tinta-2 tabular">{pax}</span>}
      </span>

      {/* Tres huecos siempre, aunque estén vacíos: así la casilla no cambia de
          alto al asignar y el mes no baila mientras alguien lo reparte. */}
      <span className="flex flex-wrap gap-0.5 mt-auto">
        {CODIGOS.map(c => (
          <span
            key={c}
            title={c}
            className={classNames(
              'w-6 h-5 rounded text-[10px] font-bold flex items-center justify-center',
              turnos[c]
                ? 'bg-brand-100 text-brand-900'
                : pax > 0 ? 'bg-linea text-transparent' : 'bg-transparent text-transparent'
            )}
          >
            {turnos[c] ? iniciales(turnos[c].nombre) : '··'}
          </span>
        ))}
      </span>
    </button>
  )
}

function Leyenda() {
  return (
    <div className="flex items-center gap-4 flex-wrap mt-4 text-[13px] text-tinta-2">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-coral-50 ring-1 ring-coral-500" aria-hidden="true" />
        viene gente y nadie embarca
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-white ring-1 ring-aviso-300" aria-hidden="true" />
        falta isla o recibimiento
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays size={14} aria-hidden="true" />
        toca un día para repartirlo
      </span>
    </div>
  )
}
