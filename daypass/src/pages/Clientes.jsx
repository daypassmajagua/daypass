import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Users, X, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDateShort, classNames, plural } from '../lib/utils'
import { EstadoError, Esqueleto, PanelLateral } from '../components/patrones'
import FichaPersona from '../components/clientes/FichaPersona'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'

/**
 * Quiénes son los clientes.
 *
 * El modelo existe desde la 020, pero no había dónde verlo: los datos estaban
 * y no había una sola pantalla que mostrara a una persona. Esto es esa
 * pantalla.
 *
 * La pregunta que responde no es "cuántos clientes tenemos" sino la que se
 * hace de verdad: *esta señora que está llamando, ¿ya vino?* Por eso lo
 * primero es un buscador y no una lista, y por eso la ficha empieza por las
 * visitas y no por los datos.
 *
 * ── El perfil se abre al lado ───────────────────────────────────────────────
 *
 * La lista no se va: el perfil entra por la derecha y la deja detrás. Así
 * mirar a cinco personas seguidas son cinco toques y no diez, y quien buscaba
 * no pierde su sitio. La dirección sigue siendo `/clientes/:id`, que es lo que
 * lo hace compartible y lo que le da destino al buscador global.
 */
export default function Clientes() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [ficha, setFicha] = useState(null)
  const [fallo, setFallo] = useState(null)

  // Sin búsqueda: los que más vienen. Es el mejor arranque para una lista que
  // va a tener miles de filas.
  const cargar = useCallback(async () => {
    setCargando(true)
    const busca = texto.trim()

    const { data, error: err } = busca.length >= 3
      ? await supabase.rpc('buscar_personas', { p_texto: busca, p_limite: 25 })
      : await supabase.from('clientes_ficha').select('*')
          .order('visitas', { ascending: false })
          .order('ultima', { ascending: false })
          .limit(25)

    if (err) setError(err.message)
    else { setError(null); setLista(data || []) }
    setCargando(false)
  }, [texto])

  // Un respiro entre teclas: esto corre mientras alguien escribe.
  useEffect(() => {
    const t = setTimeout(cargar, texto.trim() ? 350 : 0)
    return () => clearTimeout(t)
  }, [cargar, texto])

  /**
   * El perfil vive en la dirección, no en el estado.
   *
   * Antes se abría con un clic y no se podía volver a él: ni compartirlo, ni
   * recargarlo, ni llegar desde otro lado. Con `/clientes/:id` es un sitio —y
   * quien llega directo por la dirección ve la lista detrás igual, porque la
   * pantalla la carga de todos modos. No hay dos caminos.
   *
   * El fallo se guarda aparte del de la lista: que no se pueda abrir una
   * ficha no debería borrar los veinticinco resultados de atrás.
   */
  useEffect(() => {
    if (!id) { setFicha(null); setFallo(null); return }
    let vigente = true
    setFicha(null)
    setFallo(null)
    supabase.rpc('ficha_persona', { p_persona_id: id }).then(({ data, error: err }) => {
      if (!vigente) return
      if (err) { setFallo(err.message); return }
      setFicha(data)
    })
    return () => { vigente = false }
  }, [id])

  const abierta = Boolean(id)

  return (
    <div className="marco">
      <PageHeader title="Clientes" subtitle="Quién ha venido, y con qué suele venir" />

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none" />
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Nombre o documento"
          className="w-full rounded-xl border border-linea bg-white pl-11 pr-10 min-h-[48px] text-[16px]
                     focus:outline-none focus:ring-2 focus:ring-brand-900/30"
        />
        {texto && (
          <button
            onClick={() => setTexto('')}
            aria-label="Limpiar la búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-tinta-2 hover:bg-fondo"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {cargando ? (
        <Esqueleto filas={5} />
      ) : error ? (
        <EstadoError error={error} onReintentar={cargar} />
      ) : !lista.length ? (
        <Card className="p-12 text-center">
          <Users size={32} className="mx-auto text-tinta-2/50 mb-3" aria-hidden="true" />
          <p className="text-tinta-2 text-[17px]">
            {texto.trim()
              ? `Nadie coincide con "${texto.trim()}".`
              : 'Todavía no hay clientes con documento.'}
          </p>
          <p className="text-tinta-2 text-[15px] mt-1">
            La ficha se crea sola: quien trae documento en una reserva o en el
            check-in queda registrado.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map(p => {
            // La fila abierta se queda marcada: con el panel al lado, saber
            // cuál se está mirando es la mitad de para qué sirve el panel.
            const activa = p.id === id
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/clientes/${p.id}`)}
                aria-current={activa ? 'true' : undefined}
                className={classNames(
                  'text-left bg-white rounded-2xl px-4 py-3.5 ring-1 transition-colors flex items-center gap-3',
                  activa ? 'ring-blue-600 bg-blue-50/40' : 'ring-transparent hover:ring-linea'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-tinta truncate">{p.nombre_completo}</p>
                  <p className="text-[13px] text-tinta-2 truncate">
                    {p.documento || 'sin documento'}
                    {p.telefono && <> · {p.telefono}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold text-tinta tabular">
                    {plural(p.visitas ?? p.veces ?? 0, 'visita', 'visitas')}
                  </p>
                  {p.ultima && (
                    <p className="text-[12px] text-tinta-2">última {formatDateShort(p.ultima)}</p>
                  )}
                </div>
                <ChevronRight size={16} className="shrink-0 text-tinta-3" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      )}

      {abierta && (
        <PanelLateral
          titulo={ficha?.persona?.nombre_completo || 'Cargando…'}
          subtitulo={ficha?.persona?.documento || undefined}
          onCerrar={() => navigate('/clientes')}
        >
          {fallo ? (
            <EstadoError error={fallo} onReintentar={() => navigate(`/clientes/${id}`, { replace: true })} />
          ) : !ficha ? (
            <Esqueleto filas={4} />
          ) : (
            <FichaPersona ficha={ficha} />
          )}
        </PanelLateral>
      )}
    </div>
  )
}
