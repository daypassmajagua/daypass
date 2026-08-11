import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Users, Phone, Mail, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateShort, classNames, plural } from '../lib/utils'
import { EstadoError, Esqueleto } from '../components/patrones'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'

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
 */
export default function Clientes() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [ficha, setFicha] = useState(null)

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
   * La ficha vive en la dirección, no en el estado.
   *
   * Antes se abría con un clic y no se podía volver a ella: ni compartirla, ni
   * recargarla, ni llegar desde otro lado. Ahora `/clientes/:id` es un sitio,
   * que es lo que necesita el buscador global para tener a dónde aterrizar. El
   * paso 6 le cambia la ventana por una página; la dirección ya es la buena.
   */
  useEffect(() => {
    if (!id) { setFicha(null); return }
    let vigente = true
    supabase.rpc('ficha_persona', { p_persona_id: id }).then(({ data, error: err }) => {
      if (!vigente) return
      if (err) { setError(err.message); return }
      setFicha(data)
    })
    return () => { vigente = false }
  }, [id])

  return (
    <div className="max-w-4xl mx-auto px-4">
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
          {lista.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/clientes/${p.id}`)}
              className="text-left bg-white rounded-2xl px-4 py-3.5 ring-1 ring-transparent
                         hover:ring-linea transition-colors flex items-center gap-3"
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
            </button>
          ))}
        </div>
      )}

      {ficha && <Ficha ficha={ficha} onCerrar={() => navigate('/clientes')} />}
    </div>
  )
}

function Ficha({ ficha, onCerrar }) {
  const p = ficha.persona || {}
  const calculadas = ficha.etiquetas_calculadas || []
  const puestas = ficha.etiquetas_puestas || []

  return (
    <Modal open onClose={onCerrar} title={p.nombre_completo}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          <Dato etiqueta="Visitas" valor={ficha.visitas} />
          {ficha.ultima && <Dato etiqueta="Última" valor={formatDateShort(ficha.ultima)} />}
          {ficha.primera && <Dato etiqueta="Primera" valor={formatDateShort(ficha.primera)} />}
          {/* En null cuando quien mira no puede ver plata: lo decide el
              servidor, no esta pantalla. */}
          {ficha.gastado != null && (
            <Dato etiqueta="Ha dejado" valor={formatCurrency(ficha.gastado)} />
          )}
        </div>

        {(p.telefono || p.email || p.documento) && (
          <div className="flex flex-col gap-1.5 text-[15px] text-tinta">
            {p.documento && <p className="text-tinta-2">{p.documento}</p>}
            {p.telefono && (
              <a href={`tel:${p.telefono}`} className="flex items-center gap-2 text-blue-700 font-bold">
                <Phone size={15} /> {p.telefono}
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className="flex items-center gap-2 text-blue-700 font-bold break-all">
                <Mail size={15} /> {p.email}
              </a>
            )}
          </div>
        )}

        {(calculadas.length > 0 || puestas.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {calculadas.map(e => (
              <span key={e} className="text-[13px] font-bold px-2.5 py-1 rounded-lg bg-mar-50 text-mar-700">
                {e}
              </span>
            ))}
            {puestas.map(e => (
              <span key={e} className="text-[13px] font-bold px-2.5 py-1 rounded-lg bg-arena-100 text-arena-700">
                {e}
              </span>
            ))}
          </div>
        )}

        {ficha.plan_usual && (
          <p className="text-[15px] text-tinta-2">
            Suele venir en <b className="text-tinta">{ficha.plan_usual}</b>.
          </p>
        )}

        {(ficha.organizaciones || []).length > 0 && (
          <p className="text-[15px] text-tinta-2">
            {ficha.organizaciones.map(o => `${o.nombre} (${o.tipo.replace('_', ' ')})`).join(' · ')}
          </p>
        )}

        {(ficha.historial || []).length > 0 && (
          <div>
            <p className="text-[13px] font-bold text-tinta-2 uppercase tracking-wider mb-1.5">
              Cuándo vino
            </p>
            <ul className="flex flex-col gap-1">
              {ficha.historial.slice(0, 12).map(v => (
                <li key={`${v.fecha}-${v.registro_id}`}
                  className="flex items-center gap-2 text-[15px] text-tinta">
                  <span className="tabular">{formatDateShort(v.fecha)}</span>
                  {v.plan && <span className="text-tinta-2">· {v.plan}</span>}
                  {!v.titular && (
                    <span className="text-[12px] text-tinta-2">· con otra reserva</span>
                  )}
                </li>
              ))}
            </ul>
            {ficha.historial.length > 12 && (
              <p className="text-[13px] text-tinta-2 mt-1">
                y {ficha.historial.length - 12} más.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <p className="text-[12px] font-bold text-tinta-2 uppercase tracking-wider">{etiqueta}</p>
      <p className={classNames('text-[20px] font-bold text-tinta tabular')}>{valor}</p>
    </div>
  )
}
