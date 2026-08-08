import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Check, Globe, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { textos } from '../lib/textosPublicos'
import { classNames, formatDate } from '../lib/utils'
import Firma from '../components/publico/Firma'
import logoAzul from '../assets/logo-azul.png'

/**
 * La página del cliente: majagua.co/r/{token}
 *
 * Vive fuera del login. No lee tablas: todo pasa por funciones del servidor
 * que reciben el token y devuelven únicamente lo de esa reserva. Sin precios,
 * sin folios, sin nada de otras reservas.
 *
 * Dos etapas: al comprar se registran los pasajeros; desde 48 horas antes se
 * elige plato, se leen las condiciones y firma el titular, y eso emite el QR.
 */

const filaVacia = () => ({
  nombre: '', tipo_documento: 'cc', documento: '', pais_id: '',
  categoria: 'adulto', opcion_plato_id: '', restriccion_alimentaria: '',
})

function nuevoClientId() {
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** '08:30' → '8:30 a.m.' El servidor la guarda en 24 horas; nadie habla así. */
function formatoHora(hhmm, idioma) {
  const [h, m] = (hhmm || '08:30').split(':').map(Number)
  if (Number.isNaN(h)) return idioma === 'en' ? '8:30 am' : '8:30 a.m.'
  const sufijo = idioma === 'en' ? (h < 12 ? 'am' : 'pm') : (h < 12 ? 'a.m.' : 'p.m.')
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${sufijo}`
}

// ─── Piezas ────────────────────────────────────────────────────────────────────

function Marco({ children, idioma, onIdioma }) {
  return (
    <div className="min-h-screen bg-fondo">
      <header className="bg-gradient-to-r from-brand-900 via-[#2b3170] to-[#34418f] pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-5 h-20 flex items-center justify-between gap-3">
          <img src={logoAzul} alt="Hotel San Pedro de Majagua"
            className="h-12 w-auto brightness-0 invert" />
          <button
            onClick={onIdioma}
            className="flex items-center gap-1.5 rounded-xl bg-white/15 text-white px-3.5 min-h-[44px] text-sm font-bold"
          >
            <Globe size={16} />
            {textos(idioma).otro}
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-7 pb-[calc(env(safe-area-inset-bottom)+2rem)] overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}

function Aviso({ tono = 'neutro', titulo, detalle, children }) {
  return (
    <div className={classNames(
      'rounded-2xl px-5 py-6 text-center',
      tono === 'coral' ? 'bg-coral-50' : tono === 'verde' ? 'bg-verde-50' : 'bg-white'
    )}>
      <p className={classNames(
        'text-[19px] font-bold tracking-[-.01em]',
        tono === 'coral' ? 'text-coral-700' : tono === 'verde' ? 'text-verde-600' : 'text-tinta'
      )}>
        {titulo}
      </p>
      {detalle && <p className="text-[15px] text-tinta-2 mt-1.5">{detalle}</p>}
      {children}
    </div>
  )
}

function Campo({ etiqueta, children }) {
  // min-w-0: sin esto, un <select> se niega a encogerse por debajo de su
  // opción más larga ("República Dominicana") y ensancha toda la página.
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-sm font-bold text-tinta">{etiqueta}</span>
      {children}
    </label>
  )
}

const claseCampo =
  'w-full min-w-0 rounded-xl border-2 border-linea bg-white px-3.5 py-2.5 min-h-[52px] text-[16px] ' +
  'focus:outline-none focus:border-blue-600'

// ─── Pantalla ──────────────────────────────────────────────────────────────────

export default function CheckInPublico() {
  const { token } = useParams()
  const [idioma, setIdioma] = useState('es')
  const t = textos(idioma)

  const [reserva, setReserva] = useState(undefined)   // undefined = cargando
  const [pasajeros, setPasajeros] = useState([])
  const [documento, setDocumento] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const [trazo, setTrazo] = useState(null)
  const [firmanteNombre, setFirmanteNombre] = useState('')
  const [firmanteDoc, setFirmanteDoc] = useState('')
  const [leyoTodo, setLeyoTodo] = useState(false)
  const [qr, setQr] = useState(null)
  const cajaCondiciones = useRef(null)

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('reserva_publica', { p_token: token })
    if (err) { setError(err.message); setReserva(null); return }
    setReserva(data)
    if (data) {
      setPasajeros(data.pasajeros?.length ? data.pasajeros.map(p => ({
        ...p,
        tipo_documento: p.tipo_documento || 'cc',
        documento: p.documento || '',
        pais_id: p.pais_id || '',
        opcion_plato_id: p.opcion_plato_id || '',
        restriccion_alimentaria: p.restriccion_alimentaria || '',
      })) : [filaVacia()])
      setFirmanteNombre(prev => prev || data.titular || '')
    }
  }, [token])

  useEffect(() => {
    cargar()
    supabase.rpc('marcar_token_abierto', { p_token: token })
  }, [cargar, token])

  useEffect(() => {
    supabase.rpc('documento_vigente', { p_idioma: idioma }).then(({ data }) => setDocumento(data))
  }, [idioma])

  // El pase se dibuja cuando ya hay check-in.
  useEffect(() => {
    if (!reserva?.check_in_at) { setQr(null); return }
    QRCode.toDataURL(`daypass:${token}`, {
      width: 520, margin: 1,
      color: { dark: '#1e2045', light: '#ffffff' },
    }).then(setQr).catch(() => setQr(null))
  }, [reserva?.check_in_at, token])

  const totalPax = useMemo(() => {
    if (!reserva) return 0
    return (reserva.adultos || 0) + (reserva.ninos || 0) +
           (reserva.infantes || 0) + (reserva.cortesias || 0)
  }, [reserva])

  const opciones = reserva?.opciones_plato || []
  const hayPlatos = opciones.length > 0

  // Los que ya están en la base, no las filas vacías del formulario.
  // Sin useMemo: filtrar una lista de veinte no cuesta nada, y memoizarlo le
  // impedía al compilador de React conservar la memoización de cargar().
  const pasajerosGuardados = (reserva?.pasajeros || []).filter(p => p.nombre?.trim())

  // 08:30 → 8:30 a.m. El servidor la manda en 24 horas; aquí se lee como se
  // habla. Si el servidor todavía no la manda, se asume la de siempre.
  const horaZarpe = formatoHora(reserva?.cierra_a, idioma)
  const horaCocina = formatoHora(reserva?.cocina_cierra_a, idioma)

  // Como con puede_registrar: si la migración 010 todavía no corrió, el campo
  // llega vacío y se asume abierta. Peor sería esconderle el almuerzo a todo
  // el mundo por una migración pendiente.
  const cocinaAbierta = reserva?.puede_elegir_plato ?? true

  function editar(i, campo, valor) {
    setPasajeros(prev => prev.map((p, j) => j === i ? { ...p, [campo]: valor } : p))
  }

  async function guardarPasajeros() {
    setGuardando(true); setError(null)
    const { data, error: err } = await supabase.rpc('guardar_pasajeros_por_token', {
      p_token: token,
      p_pasajeros: pasajeros.filter(p => p.nombre.trim()),
    })
    setGuardando(false)
    if (err) { setError(err.message); return }
    setReserva(data)
    setAviso(t.guardado)
    setTimeout(() => setAviso(null), 3000)
  }

  async function firmar() {
    if (!firmanteNombre.trim()) { setError(t.faltaNombre); return }
    if (!trazo) { setError(t.faltaFirma); return }

    setGuardando(true); setError(null)
    // Los nombres y platos se guardan junto con la firma: es un solo paso
    // para el cliente aunque sean dos llamadas.
    const { error: errPax } = await supabase.rpc('guardar_pasajeros_por_token', {
      p_token: token,
      p_pasajeros: pasajeros.filter(p => p.nombre.trim()),
    })
    if (errPax) { setGuardando(false); setError(errPax.message); return }

    const { data, error: err } = await supabase.rpc('firmar_por_token', {
      p_token: token,
      p_documento_legal_id: documento.id,
      p_firmante_nombre: firmanteNombre.trim(),
      p_firmante_documento: firmanteDoc.trim() || null,
      p_trazo: trazo,
      p_client_id: nuevoClientId(),
      p_dispositivo: navigator.userAgent.slice(0, 120),
    })
    setGuardando(false)
    if (err) { setError(err.message); return }
    setReserva(data)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cambiarIdioma = () => setIdioma(i => (i === 'es' ? 'en' : 'es'))

  // ── Estados de salida ──
  if (reserva === undefined) {
    return <Marco idioma={idioma} onIdioma={cambiarIdioma}>
      <p className="text-tinta-2 text-[17px] py-10 text-center">{t.cargando}</p>
    </Marco>
  }

  if (!reserva) {
    return <Marco idioma={idioma} onIdioma={cambiarIdioma}>
      <Aviso tono="coral" titulo={t.noExiste} detalle={t.noExisteDetalle} />
    </Marco>
  }

  const yaPaso = new Date(reserva.fecha + 'T23:59:59') < new Date()
  const listo = Boolean(reserva.check_in_at)

  // El servidor manda puede_registrar desde la migración 009. Si el front sale
  // antes que ella, ese campo llega vacío y sin este respaldo todo el mundo
  // vería la puerta cerrada. Con él, se comporta como antes hasta que la
  // migración corra.
  const puedeRegistrar = reserva.puede_registrar ?? (reserva.estado_dia === 'planeando')

  return (
    <Marco idioma={idioma} onIdioma={cambiarIdioma}>
      {/* Encabezado de la reserva */}
      <div className="mb-6">
        <p className="text-[15px] text-tinta-2">{t.hola},</p>
        <h1 className="text-[26px] font-bold tracking-[-.02em] text-tinta text-balance">
          {reserva.grupo || reserva.titular}
        </h1>
        <p className="text-[17px] text-tinta-2 mt-1 first-letter:uppercase">
          {t.para} {formatDate(reserva.fecha)}
        </p>
        <p className="text-[15px] text-tinta-2">
          {totalPax} {totalPax === 1 ? t.persona : t.personas}
          {reserva.plan ? ` · ${reserva.plan}` : ''}
        </p>
      </div>

      {/* ── Ya hizo check-in: el pase ── */}
      {listo && !yaPaso && (
        <div className="flex flex-col gap-5">
          <Aviso tono="verde" titulo={t.paseTitulo} detalle={t.paseAyuda} />
          {qr && (
            <div className="rounded-2xl bg-white p-6 flex flex-col items-center gap-3 shadow-[0_1px_2px_rgba(22,24,44,.05),0_8px_24px_rgba(22,24,44,.06)]">
              <img src={qr} alt={t.tuPase} className="w-full max-w-[280px]" />
              <p className="text-[15px] font-bold text-tinta text-center">
                {reserva.grupo || reserva.titular}
              </p>
              <p className="text-[13px] text-tinta-2 text-center">{t.paseGuardar}</p>
            </div>
          )}
        </div>
      )}

      {yaPaso && (
        <Aviso tono="verde" titulo={t.gracias} detalle={t.graciasDetalle} />
      )}

      {/* ── Ya zarpó ──
          El registro en línea cierra a la hora de zarpe, no cuando la
          coordinadora cierra el día: para entonces el cliente todavía está
          despierto y muchas veces es justo cuando abre el enlace.

          Quien llega después igual viaja —la reserva existe y el pase nunca
          fue obligatorio para embarcar—, así que en vez de un "cerrado" a
          secas se le devuelve lo que sí le sirve: adónde ir y a quiénes
          alcanzamos a registrar. */}
      {!listo && !yaPaso && !puedeRegistrar && (
        <div className="flex flex-col gap-5">
          <Aviso
            tono="verde"
            titulo={t.cerrado}
            detalle={t.cerradoDetalle.replace('{hora}', horaZarpe)}
          />

          {pasajerosGuardados.length > 0 ? (
            <div className="rounded-2xl bg-white p-5 flex flex-col gap-3 shadow-[0_1px_2px_rgba(22,24,44,.05)]">
              <h2 className="text-[17px] font-bold text-tinta">{t.quienesVan}</h2>
              <ul className="flex flex-col gap-2">
                {pasajerosGuardados.map((p, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="text-tinta truncate">{p.nombre}</span>
                    {p.documento && (
                      <span className="text-tinta-2 tabular shrink-0">{p.documento}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[15px] text-tinta-2">{t.sinNombresAun}</p>
          )}
        </div>
      )}

      {/* ── El formulario ── */}
      {!listo && !yaPaso && puedeRegistrar && (
        <div className="flex flex-col gap-8">
          {/* Etapa 1 · quiénes vienen */}
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-[20px] font-bold text-tinta tracking-[-.01em]">{t.paso1Titulo}</h2>
              <p className="text-[15px] text-tinta-2 mt-0.5">{t.paso1Ayuda}</p>
            </div>

            {pasajeros.map((p, i) => (
              <div key={i} className="rounded-2xl bg-white p-4 flex flex-col gap-3 shadow-[0_1px_2px_rgba(22,24,44,.05)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-tinta-2">{i + 1}</span>
                  {pasajeros.length > 1 && (
                    <button
                      onClick={() => setPasajeros(prev => prev.filter((_, j) => j !== i))}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-tinta-2 min-h-[44px] px-2"
                    >
                      <Trash2 size={15} /> {t.quitar}
                    </button>
                  )}
                </div>

                <Campo etiqueta={t.nombre}>
                  <input value={p.nombre} onChange={e => editar(i, 'nombre', e.target.value)}
                    className={claseCampo} />
                </Campo>

                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
                  <Campo etiqueta="Tipo">
                    <select value={p.tipo_documento} onChange={e => editar(i, 'tipo_documento', e.target.value)}
                      className={claseCampo}>
                      <option value="cc">CC</option><option value="ce">CE</option>
                      <option value="pasaporte">Pass</option><option value="ti">TI</option>
                      <option value="rc">RC</option><option value="otro">Otro</option>
                    </select>
                  </Campo>
                  <Campo etiqueta={t.documento}>
                    <input value={p.documento} inputMode="numeric"
                      onChange={e => editar(i, 'documento', e.target.value)} className={claseCampo} />
                  </Campo>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                  <Campo etiqueta={t.pais}>
                    <select value={p.pais_id} onChange={e => editar(i, 'pais_id', e.target.value)}
                      className={claseCampo}>
                      <option value="">—</option>
                      {(reserva.paises || []).map(pa => (
                        <option key={pa.id} value={pa.id}>{pa.nombre}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta={t.categoria}>
                    <select value={p.categoria} onChange={e => editar(i, 'categoria', e.target.value)}
                      className={claseCampo}>
                      <option value="adulto">{t.adulto}</option>
                      <option value="nino">{t.nino}</option>
                      <option value="infante">{t.infante}</option>
                      <option value="cortesia">{t.cortesia}</option>
                    </select>
                  </Campo>
                </div>

                {/* Etapa 2 · el plato, si el plan lo permite y cocina todavía
                    recibe. Cuando cocina cierra el selector desaparece en vez
                    de aceptar un cambio que no va a llegar a la isla. */}
                {hayPlatos && p.categoria !== 'infante' && cocinaAbierta && (
                  <Campo etiqueta={t.plato}>
                    <select value={p.opcion_plato_id}
                      onChange={e => editar(i, 'opcion_plato_id', e.target.value)}
                      className={claseCampo}>
                      <option value="">{t.elegirPlato}</option>
                      {opciones.map(o => (
                        <option key={o.id} value={o.id}>{idioma === 'en' ? o.en : o.es}</option>
                      ))}
                    </select>
                  </Campo>
                )}

                <Campo etiqueta={t.restriccion}>
                  <input value={p.restriccion_alimentaria}
                    placeholder={t.restriccionPlaceholder}
                    onChange={e => editar(i, 'restriccion_alimentaria', e.target.value)}
                    className={claseCampo} />
                </Campo>
              </div>
            ))}

            <button
              onClick={() => setPasajeros(prev => [...prev, filaVacia()])}
              className="self-start inline-flex items-center gap-2 rounded-xl bg-blue-50 text-blue-700 font-bold px-4 min-h-[52px] text-[15px]"
            >
              <Plus size={18} /> {t.agregarPersona}
            </button>

            {hayPlatos && !cocinaAbierta && (
              <p className="text-[15px] text-tinta-2">
                {t.cocinaCerrada.replace('{hora}', horaCocina)}
              </p>
            )}

            {!hayPlatos && (
              <p className="text-[15px] text-tinta-2">{t.sinOpciones}</p>
            )}

            {/* Guardar sin firmar todavía: los nombres pueden llegar antes. */}
            {!reserva.puede_check_in && (
              <button
                onClick={guardarPasajeros}
                disabled={guardando}
                className="rounded-xl bg-blue-600 text-white font-bold min-h-[56px] text-[17px] disabled:opacity-50"
              >
                {guardando ? t.guardando : t.guardarPersonas}
              </button>
            )}
          </section>

          {/* Condiciones y firma: solo desde 48 h antes */}
          {reserva.puede_check_in && documento && (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-[20px] font-bold text-tinta tracking-[-.01em]">{documento.titulo}</h2>
                <p className="text-[15px] text-tinta-2 mt-0.5">{t.condicionesAyuda}</p>
              </div>

              <div
                ref={cajaCondiciones}
                onScroll={e => {
                  const el = e.currentTarget
                  if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setLeyoTodo(true)
                }}
                className="rounded-2xl bg-white p-5 max-h-72 overflow-y-auto overscroll-contain text-[15px] text-tinta whitespace-pre-line leading-relaxed shadow-[0_1px_2px_rgba(22,24,44,.05)]"
              >
                {documento.contenido}
              </div>

              {!leyoTodo && (
                <p className="text-[13px] text-tinta-2">{t.leerCompleto}</p>
              )}

              <div className={classNames('flex flex-col gap-4 transition-opacity', !leyoTodo && 'opacity-40 pointer-events-none')}>
                <h3 className="text-[17px] font-bold text-tinta">{t.firmaTitulo}</h3>
                <p className="text-[15px] text-tinta-2 -mt-3">{t.firmaAyuda}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                  <Campo etiqueta={t.firmaNombre}>
                    <input value={firmanteNombre} onChange={e => setFirmanteNombre(e.target.value)}
                      className={claseCampo} />
                  </Campo>
                  <Campo etiqueta={t.firmaDocumento}>
                    <input value={firmanteDoc} inputMode="numeric"
                      onChange={e => setFirmanteDoc(e.target.value)} className={claseCampo} />
                  </Campo>
                </div>

                <Firma onCambio={setTrazo} etiquetaLimpiar={t.limpiar} />

                <button
                  onClick={firmar}
                  disabled={guardando}
                  className="rounded-xl bg-blue-600 text-white font-bold min-h-[60px] text-[18px] disabled:opacity-50"
                >
                  {guardando ? t.guardando : t.confirmar}
                </button>
              </div>
            </section>
          )}

          {!reserva.puede_check_in && (
            <Aviso titulo={t.aunNo} detalle={t.aunNoDetalle} />
          )}
        </div>
      )}

      {aviso && (
        <p className="mt-5 flex items-center gap-2 rounded-xl bg-verde-50 text-verde-600 font-bold px-4 py-3">
          <Check size={18} /> {aviso}
        </p>
      )}

      {error && (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-coral-50 text-coral-700 font-bold px-4 py-3">
          <TriangleAlert size={18} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}
    </Marco>
  )
}
