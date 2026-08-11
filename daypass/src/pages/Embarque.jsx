import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Check, ChevronLeft, FileText, QrCode, Search, Settings2, Ship, UserPlus, X, Anchor, Undo2,
} from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { useZarpesDelDia, useEmbarque, useDatosManifiesto, claveDe } from '../hooks/useEmbarque'
import { armarManifiesto } from '../lib/manifiesto'
import { sePuedeNombrar } from '../lib/plazas'
import { resolverToken } from '../lib/offline/precarga'
import { tocar } from '../lib/sonido'
import { veredictoDePase } from '../lib/veredictoPase'
import { openPrintWindow, buildManifiestoHTML } from '../lib/printDoc'
import { classNames, fraseFecha, hora12, plural } from '../lib/utils'
import Select from '../components/ui/Select'
import PrepararZarpe from '../components/zarpe/PrepararZarpe'
import LectorQR from '../components/zarpe/LectorQR'
import IndicadorSync from '../components/layout/IndicadorSync'
import { EstadoError } from '../components/patrones'

/**
 * El muelle.
 *
 * Aquí la vara es física, no estética: iPad en horizontal, usado de pie, a
 * pleno sol, con una mano ocupada y 250 personas esperando. Alto contraste
 * sin grises medios —el sol los lava—, filas de 64px y un toque para marcar.
 */

const VENTANA_DESHACER = 8000

/** Los mismos del enum `tipo_documento` (002), en el orden en que se usan. */
const TIPOS_DOCUMENTO = [
  { value: 'cc', label: 'C.C.' },
  { value: 'ce', label: 'C.E.' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'ti', label: 'T.I.' },
  { value: 'rc', label: 'R.C.' },
  { value: 'otro', label: 'Otro' },
]

// ─── Selección de zarpe ────────────────────────────────────────────────────────

function SelectorZarpe({ zarpes, onElegir, onProgramar, onProgramarRegreso, onRecargar, fecha, cargando, error, hayIdaCerrada, hayRegreso }) {
  const [programando, setProgramando] = useState(false)
  const [preparando, setPreparando] = useState(null)

  if (cargando) return <p className="text-[18px] text-sol-tinta-2 p-6">Buscando los zarpes del día…</p>

  // Antes de decir "no hay zarpes": si la consulta falló y tampoco hay copia
  // local, decirlo. "No hay" y "no pude cargar" llevan a decisiones opuestas.
  if (error) return <EstadoError error={error} onReintentar={onRecargar} />

  if (!zarpes.length) {
    return (
      <div className="p-6 flex flex-col items-start gap-4">
        <p className="text-[20px] font-bold text-sol-tinta">
          Todavía no hay zarpes programados para {fraseFecha(fecha).toLowerCase()}.
        </p>
        <p className="text-[17px] text-sol-tinta-2">
          Se crea uno por cada lancha que tenga gente ese día.
        </p>
        <button
          onClick={async () => {
            setProgramando(true)
            const { error } = await onProgramar()
            setProgramando(false)
            if (error) toast.error('No se pudieron programar. ' + error.message)
          }}
          disabled={programando}
          className="rounded-2xl bg-blue-600 text-white text-[18px] font-bold px-6 min-h-[64px] disabled:opacity-50"
        >
          {programando ? 'Programando…' : 'Programar los zarpes del día'}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="text-[24px] font-bold text-sol-tinta tracking-[-.02em]">
          ¿Qué lancha vas a embarcar?
        </h1>
        <Link to="/" className="text-[16px] font-bold text-blue-700 underline min-h-[44px] flex items-center">
          Volver a la oficina
        </Link>
      </div>
      {zarpes.map(z => {
        const cerrado = ['zarpado', 'regresado'].includes(z.estado)
        const preparado = Boolean(z.piloto_id)
        return (
          <div key={z.id} className="flex items-stretch gap-2">
            <button
              onClick={() => onElegir(z)}
              className={classNames(
                'flex-1 flex items-center gap-4 rounded-2xl px-5 min-h-[80px] text-left ring-2 transition-colors',
                cerrado ? 'bg-white ring-sol-linea-2' : 'bg-white ring-sol-tinta'
              )}
            >
              <Ship size={28} className={cerrado ? 'text-sol-tinta-3' : 'text-blue-700'} />
              <span className="flex-1 min-w-0">
                <span className="block text-[20px] font-bold text-sol-tinta">
                  {z.lanchas?.nombre || 'Lancha'}
                </span>
                <span className="block text-[16px] text-sol-tinta-2">
                  {z.sentido === 'ida' ? 'Ida' : 'Regreso'}
                  {z.hora_programada ? ` · ${z.hora_programada.slice(0, 5)}` : ''}
                  {preparado && z.pilotos?.nombre ? ` · ${z.pilotos.nombre}` : ''}
                  {cerrado && (z.sentido === 'regreso'
                    ? ` · regresó ${hora12(z.hora_real_regreso) || ''}`
                    : ` · zarpó ${hora12(z.hora_real_salida) || ''}`)}
                </span>
              </span>
              {cerrado
                ? <span className="text-[16px] font-bold text-verde-600 shrink-0">Cerrado</span>
                : <ChevronLeft size={26} className="rotate-180 text-sol-tinta-3 shrink-0" />}
            </button>

            {!cerrado && (
              <button
                onClick={() => setPreparando(z)}
                className={classNames(
                  'shrink-0 w-[92px] rounded-2xl ring-2 text-[14px] font-bold flex flex-col items-center justify-center gap-1 transition-colors',
                  preparado
                    ? 'bg-verde-50 ring-verde-500 text-verde-600'
                    : 'bg-white ring-sol-linea text-sol-tinta-2'
                )}
              >
                <Settings2 size={20} />
                {preparado ? 'Lista' : 'Preparar'}
              </button>
            )}
          </div>
        )
      })}

      {/* El regreso de las 3:30. Aparece cuando ya salió alguna lancha: antes
          no hay nada que traer de vuelta. */}
      {hayIdaCerrada && !hayRegreso && (
        <button
          onClick={async () => {
            setProgramando(true)
            const { error } = await onProgramarRegreso()
            setProgramando(false)
            if (error) toast.error('No se pudo programar el regreso. ' + error.message)
            else toast.success('Regreso programado')
          }}
          disabled={programando}
          className="self-start mt-2 flex items-center gap-2 rounded-2xl bg-white ring-2 ring-sol-tinta text-sol-tinta text-[17px] font-bold px-6 min-h-[64px] disabled:opacity-50"
        >
          <Anchor size={22} />
          {programando ? 'Programando…' : 'Programar el regreso'}
        </button>
      )}

      {preparando && (
        <PrepararZarpe
          zarpe={preparando}
          onCerrar={() => setPreparando(null)}
          onGuardado={onRecargar}
        />
      )}
    </div>
  )
}

// ─── Walk-in ───────────────────────────────────────────────────────────────────

/**
 * Los datos de una persona, en el muelle.
 *
 * Sirve para los dos casos que llegan sin nombre: el que aparece sin reserva y
 * la plaza suelta de un grupo cuyo listado no alcanzó a llegar. Piden lo mismo
 * —nombre, tipo de documento, número y país— porque los dos van al manifiesto
 * y la Capitanía los exige igual.
 *
 * Cédula y Colombia vienen puestos: es lo que trae la mayoría, y aquí cada
 * toque cuesta.
 */
function FormularioPersona({ titulo, cta, onGuardar, onCerrar, paises = [] }) {
  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('cc')
  // null = no lo ha tocado. Se deriva en vez de sembrarlo desde un efecto: el
  // catálogo de países puede llegar después de que se abra el formulario, y
  // sembrarlo entonces repintaría encima de lo que ella ya hubiera elegido.
  const [paisId, setPaisId] = useState(null)
  const [categoria, setCategoria] = useState('adulto')
  const [guardando, setGuardando] = useState(false)

  const colombia = paises.find(p => p.codigo === 'CO' || /colombia/i.test(p.nombre || ''))
  const paisElegido = paisId ?? (colombia?.id || '')

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-bold text-sol-tinta">{titulo}</h2>
          <button onClick={onCerrar} className="w-12 h-12 flex items-center justify-center rounded-xl text-sol-tinta-2">
            <X size={26} />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[16px] font-bold text-sol-tinta">Nombre</span>
          <input
            value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
            className="rounded-xl border-2 border-sol-linea px-4 min-h-[60px] text-[18px] focus:outline-none focus:border-blue-600"
          />
        </label>

        <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[16px] font-bold text-sol-tinta">Tipo</span>
            <Select
              size="sol"
              value={tipoDocumento}
              onChange={setTipoDocumento}
              options={TIPOS_DOCUMENTO}
            />
          </div>
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[16px] font-bold text-sol-tinta">Documento</span>
            <input
              value={documento} onChange={e => setDocumento(e.target.value)} inputMode="numeric"
              className="rounded-xl border-2 border-sol-linea px-4 min-h-[60px] text-[18px] tabular focus:outline-none focus:border-blue-600"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[16px] font-bold text-sol-tinta">País</span>
          <Select
            size="sol"
            value={paisElegido}
            onChange={setPaisId}
            placeholder="Sin especificar"
            options={[
              { value: '', label: 'Sin especificar' },
              ...paises.map(p => ({ value: p.id, label: p.nombre })),
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[16px] font-bold text-sol-tinta">Categoría</span>
          <div className="grid grid-cols-2 gap-2">
            {/* Solo edades. `cortesia` estaba aquí y era el solapamiento que
                deshizo la 020: por qué entró alguien lo dice el tipo de
                ingreso de su reserva, no su categoría — y desde esa migración
                la base rechaza el valor, así que esto fallaba en el muelle. */}
            {[
              { v: 'adulto', l: 'Adulto' }, { v: 'nino', l: 'Niño' },
              { v: 'infante', l: 'Infante' },
            ].map(o => (
              <button
                key={o.v} type="button" onClick={() => setCategoria(o.v)}
                className={classNames(
                  'rounded-xl min-h-[60px] text-[17px] font-bold ring-2 transition-colors',
                  categoria === o.v ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-sol-tinta ring-sol-linea'
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!nombre.trim() || guardando}
          onClick={async () => {
            setGuardando(true)
            await onGuardar({
              nombre: nombre.trim(),
              documento: documento.trim(),
              tipo_documento: tipoDocumento,
              pais_id: paisElegido || null,
              categoria,
            })
            setGuardando(false)
          }}
          className="rounded-2xl bg-blue-600 text-white text-[19px] font-bold min-h-[64px] disabled:opacity-40"
        >
          {cta}
        </button>
      </div>
    </div>
  )
}

// ─── Pantalla ──────────────────────────────────────────────────────────────────

export default function Embarque() {
  const fechaActiva = useAppStore(s => s.fechaActiva)
  const {
    zarpes, cargando, error, programar, programarRegreso, hayIdaCerrada, hayRegreso,
    recargar: recargarZarpes,
  } = useZarpesDelDia(fechaActiva)
  const [zarpeId, setZarpeId] = useState(null)

  const zarpe = useMemo(() => zarpes.find(z => z.id === zarpeId) || null, [zarpes, zarpeId])
  const {
    grupos, walkIns, contador, registrarEvento, nombrarPlaza, cerrar, recargar,
    registros, pasajeros, estados, esRegreso, eventoDelToque, eventosOk,
  } = useEmbarque(zarpe)
  const extras = useDatosManifiesto(zarpe)

  // Lo que se le entrega a la Capitanía. Se recalcula con cada toque porque el
  // documento tiene que decir quién va a bordo AHORA, no cuando se abrió la
  // pantalla.
  const manifiesto = useMemo(
    () => armarManifiesto(zarpe, {
      registros, pasajeros, estados,
      empleados: extras.empleados,
      zarpeEmpleados: extras.zarpeEmpleados,
      alojamiento: extras.alojamiento,
      pilotos: extras.pilotos,
      paises: extras.paises,
    }),
    [zarpe, registros, pasajeros, estados,
     extras.empleados, extras.zarpeEmpleados, extras.alojamiento,
     extras.pilotos, extras.paises]
  )

  // Lo que le falta al documento, en el orden en que importa: sin piloto no lo
  // reciben; sin un documento sí, y eso se completa en la ventanilla.
  const faltasDelManifiesto = [
    !manifiesto.piloto && 'sin piloto',
    manifiesto.sinNombre > 0 && `con ${manifiesto.sinNombre} sin nombre`,
    manifiesto.sinDocumento > 0 && `con ${manifiesto.sinDocumento} sin documento`,
  ].filter(Boolean)

  /**
   * Un pase leído. Se resuelve contra la copia local —sin pedirle nada al
   * servidor, que en el muelle puede no estar— y se lleva a su grupo.
   *
   * No embarca solo: deja el grupo filtrado y a la vista para que ella toque.
   * El QR dice quién es, no cuántos vinieron, y en un grupo de 24 la que sabe
   * cuántos subieron es ella.
   */
  /**
   * Un pase leído. **Devuelve el veredicto en vez de mostrarlo**: el lector se
   * queda abierto y lo pinta adentro, para que la fila siga avanzando sin
   * abrir y cerrar la cámara por cada persona.
   *
   * No embarca a nadie, y eso es por regla: el QR dice **quién es**, no
   * **cuántos suben**. En un grupo de veinticuatro, la que sabe cuántos
   * llegaron es la persona del muelle. Lo que hace es dejar el grupo filtrado
   * y resaltado, listo para el toque.
   */
  async function alLeerPase(texto) {
    const registroId = await resolverToken(texto)
    const grupo = registroId ? grupos.find(g => g.registro.id === registroId) : null

    // Si es de esta lancha, se filtra y se resalta igual: el lector sigue
    // abierto, y cuando se cierre el grupo ya está en pantalla esperando el
    // toque. Las reglas del veredicto viven en `lib/veredictoPase` y tienen
    // sus propias pruebas.
    if (grupo) {
      setBusqueda('')
      setGrupoResaltado(registroId)
    }

    return veredictoDePase({ registroId, grupo, esRegreso })
  }

  function imprimirManifiesto() {
    openPrintWindow(
      `Manifiesto — ${zarpe.lanchas?.nombre || ''} ${fechaActiva}`,
      buildManifiestoHTML(zarpe, manifiesto, fechaActiva, zarpe.lanchas)
    )
  }

  const [busqueda, setBusqueda] = useState('')
  const [walkInAbierto, setWalkInAbierto] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [confirmandoFaltantes, setConfirmandoFaltantes] = useState(false)
  const [marcandoGrupo, setMarcandoGrupo] = useState(false)
  const [lectorAbierto, setLectorAbierto] = useState(false)
  const [nombrando, setNombrando] = useState(null)
  // Un pase leído deja su reserva sola en pantalla, hasta que ella la suelte.
  const [grupoResaltado, setGrupoResaltado] = useState(null)
  // Toques recientes: volver a tocar dentro de la ventana deshace.
  // Va en estado, no en un ref: la fila tiene que repintarse cuando la
  // ventana se abre y cuando se cierra sola a los 8 segundos.
  const [recientes, setRecientes] = useState({})

  useEffect(() => {
    document.body.style.background = '#f4f4f0'
    return () => { document.body.style.background = '' }
  }, [])

  if (!zarpe) {
    return (
      <div className="min-h-screen bg-sol-fondo">
        <SelectorZarpe zarpes={zarpes} onElegir={z => setZarpeId(z.id)}
          onProgramar={programar} onProgramarRegreso={programarRegreso}
          onRecargar={recargarZarpes}
          hayIdaCerrada={hayIdaCerrada} hayRegreso={hayRegreso}
          fecha={fechaActiva} cargando={cargando} error={error} />
      </div>
    )
  }

  const cerrado = ['zarpado', 'regresado', 'cancelado'].includes(zarpe.estado)

  // Buscar por las primeras letras de cualquier palabra: la gente dice
  // "Martínez", no el nombre completo.
  const coincide = fila => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    const campos = `${fila.nombre || ''} ${fila.documento || ''}`.toLowerCase()
    return q.split(/\s+/).every(t =>
      campos.split(/\s+/).some(palabra => palabra.startsWith(t)) || campos.includes(t))
  }

  async function alTocar(fila) {
    if (cerrado) return
    const clave = claveDe(fila)
    const hace = recientes[clave]
    const listo = eventosOk.includes(fila.estado)

    // Volver a tocar dentro de la ventana deshace lo que se acaba de marcar.
    // En el regreso no hay "no llegó" que registrar —ya está en la isla—, así
    // que deshacer no aplica: el hecho queda y se corrige con la conciliación.
    if (listo && hace && Date.now() - hace < VENTANA_DESHACER && !esRegreso) {
      setRecientes(prev => { const s = { ...prev }; delete s[clave]; return s })
      await registrarEvento(fila, 'no_show')
      toast('Deshecho', { duration: 1500 })
      return
    }
    if (listo) return   // ya estaba: un toque no lo tumba después de la ventana

    // El tic suena AQUÍ, con el cambio de estado y no después de que responda
    // el servidor. Es el tercer canal de confirmación —color, contador,
    // sonido— para cuando ni siquiera se puede mirar la pantalla.
    tocar('tic')
    setRecientes(prev => ({ ...prev, [clave]: Date.now() }))
    // Pasada la ventana, la fila deja de ofrecer deshacer por sí sola.
    setTimeout(() => {
      setRecientes(prev => { const s = { ...prev }; delete s[clave]; return s })
    }, VENTANA_DESHACER)
    await registrarEvento(fila, eventoDelToque)
  }

  /**
   * Marcar un grupo entero de un toque.
   *
   * El candado no es adorno: cada llamada registra un hecho nuevo por
   * persona, y como las plazas sin nombre no tienen identidad propia, dos
   * toques seguidos antes de que la lista se repinte embarcan al grupo dos
   * veces. En un muelle con 250 personas esperando, el segundo toque pasa.
   */
  async function embarcarTodos(grupo) {
    if (marcandoGrupo) return
    setMarcandoGrupo(true)
    try {
      const pendientes = grupo.filas.filter(f => !eventosOk.includes(f.estado))
      for (const f of pendientes) await registrarEvento(f, eventoDelToque)
      toast.success(esRegreso
        ? `${plural(pendientes.length, 'persona bajó', 'personas bajaron')}`
        : `${plural(pendientes.length, 'persona embarcada', 'personas embarcadas')}`)
    } finally {
      setMarcandoGrupo(false)
    }
  }

  async function cerrarZarpe() {
    // A las 3:30 el que no bajó se quedó en la isla, y eso no se cierra a la
    // ligera: se pregunta antes, con el número delante.
    if (esRegreso && contador.faltan > 0 && !confirmandoFaltantes) {
      setConfirmandoFaltantes(true)
      return
    }
    setCerrando(true)
    const { error } = await cerrar()
    setCerrando(false)
    setConfirmandoFaltantes(false)
    if (error) { toast.error('No se pudo cerrar el zarpe. ' + error.message); return }
    toast.success(esRegreso
      ? 'Regreso cerrado. Su Day Tour quedó completo.'
      : 'Zarpe cerrado. Su gente ya está en la isla.')
    await recargar()
  }

  return (
    <div className="min-h-screen bg-sol-fondo flex flex-col">
      {/* Cabecera fija: buscador y contador siempre a la vista */}
      <header className="sticky top-0 z-30 bg-sol-fondo border-b-2 border-sol-linea-2 px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setZarpeId(null)}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-sol-tinta shrink-0"
            aria-label="Cambiar de lancha"
          >
            <ChevronLeft size={28} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-bold text-sol-tinta truncate">
              {zarpe.lanchas?.nombre}
              {esRegreso && <span className="text-blue-700"> · Regreso</span>}
              {zarpe.hora_programada && <span className="text-sol-tinta-2 font-normal"> · {zarpe.hora_programada.slice(0, 5)}</span>}
            </p>
            {cerrado && (
              <p className="text-[15px] text-sol-tinta-2">
                {esRegreso
                  ? `Regresó a las ${hora12(zarpe.hora_real_regreso) || ''}`
                  : `Zarpó a las ${hora12(zarpe.hora_real_salida) || ''}`}
              </p>
            )}
          </div>

          {!cerrado && <IndicadorSync muelle />}

          {/* El contador: lo que ella mira cada 30 segundos.
              En el regreso "faltan" quiere decir que se quedaron en la isla,
              que es otra cosa muy distinta y por eso se pinta en rojo. */}
          <div className="text-right shrink-0">
            <p className="text-[34px] leading-none font-bold text-sol-tinta tabular">
              {contador.embarcados}<span className="text-sol-tinta-3">/{contador.esperados}</span>
            </p>
            <p className={classNames(
              'text-[15px] font-bold',
              esRegreso && contador.faltan > 0 ? 'text-alarma-700' : 'text-sol-tinta-2'
            )}>
              {contador.faltan > 0
                ? (esRegreso ? `${contador.faltan} sin bajar` : `faltan ${contador.faltan}`)
                : (esRegreso ? 'todos bajaron' : 'todos a bordo')}
            </p>
          </div>
        </div>

        {/* Un pase leído deja su reserva sola. Se suelta con un toque, porque
            si el lector se equivoca de grupo la lista no puede quedar
            secuestrada. */}
        {grupoResaltado && (
          <button
            onClick={() => setGrupoResaltado(null)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-50 ring-2 ring-blue-600 text-blue-700 text-[17px] font-bold min-h-[56px]"
          >
            <X size={20} />
            Ver toda la lancha otra vez
          </button>
        )}

        <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-sol-tinta-3 pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o documento"
            className="w-full rounded-2xl border-2 border-sol-linea bg-white pl-13 pr-4 min-h-[60px] text-[18px] focus:outline-none focus:border-blue-600"
            style={{ paddingLeft: '3.25rem' }}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-sol-tinta-2"
              aria-label="Limpiar la búsqueda"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* El pase, cuando lo traen. Nunca es requisito: al lado del buscador
            y no encima, porque buscar por nombre sigue siendo el camino. */}
        {!cerrado && (
          <button
            onClick={() => setLectorAbierto(true)}
            className="shrink-0 w-[72px] min-h-[60px] rounded-2xl bg-white ring-2 ring-sol-tinta text-sol-tinta flex items-center justify-center"
            aria-label="Leer el pase con la cámara"
          >
            <QrCode size={28} />
          </button>
        )}
        </div>
      </header>

      {/* La lista */}
      <main className="flex-1 px-4 py-4 flex flex-col gap-5 pb-32">
        {grupos.map(g => {
          if (grupoResaltado && g.registro.id !== grupoResaltado) return null
          const filas = g.filas.filter(coincide)
          if (!filas.length) return null
          const quien = g.registro.nombre_grupo || g.registro.agencia_nombre || g.registro.nombre_pasajero
          const pendientes = g.filas.filter(f => !eventosOk.includes(f.estado)).length

          return (
            <section key={g.registro.id}>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-[18px] font-bold text-sol-tinta flex-1 min-w-0 truncate">{quien}</h2>
                <span className="text-[16px] font-bold tabular text-sol-tinta-2 shrink-0">
                  {g.embarcados}/{g.filas.length}
                </span>
                {!cerrado && pendientes > 0 && (
                  <button
                    onClick={() => embarcarTodos(g)}
                    disabled={marcandoGrupo}
                    className="shrink-0 rounded-xl bg-sol-tinta text-white text-[15px] font-bold px-4 min-h-[48px] disabled:opacity-40"
                  >
                    {esRegreso
                      ? `Bajar los ${pendientes} que faltan`
                      : `Embarcar los ${pendientes} que faltan`}
                  </button>
                )}
              </div>

              <ul className="flex flex-col gap-1.5">
                {filas.map(f => {
                  // "Listo" es haber subido en la ida y haber bajado en el
                  // regreso: la misma fila verde significa cosas distintas.
                  const embarcado = eventosOk.includes(f.estado)
                  const noLlego = f.estado === 'no_show'
                  const clave = claveDe(f)
                  // En el regreso no hay deshacer: no existe el "no llegó" de
                  // alguien que ya está en la isla.
                  const reciente = embarcado && !esRegreso && Boolean(recientes[clave])

                  // Nombrar solo tiene sentido antes de que suba: los
                  // embarques son inmutables, así que nombrar a alguien que ya
                  // subió anónimo crearía una fila nueva sin quitar la vieja y
                  // el grupo contaría una persona de más.
                  const puedeNombrarse = sePuedeNombrar(f, { embarcado, cerrado })

                  return (
                    <li key={clave} className="flex items-stretch gap-2">
                      <button
                        onClick={() => alTocar(f)}
                        disabled={cerrado}
                        className={classNames(
                          'flex-1 min-w-0 flex items-center gap-4 rounded-2xl px-5 min-h-[64px] text-left ring-2 transition-colors',
                          embarcado ? 'bg-verde-500 ring-verde-500'
                            : noLlego ? 'bg-white ring-sol-linea opacity-60'
                            : 'bg-white ring-sol-tinta'
                        )}
                      >
                        <span className={classNames(
                          'w-9 h-9 shrink-0 rounded-full flex items-center justify-center ring-2',
                          embarcado ? 'bg-white ring-white' : 'ring-sol-linea'
                        )}>
                          {embarcado && <Check size={22} className="text-verde-600" strokeWidth={3.5} />}
                        </span>

                        <span className="flex-1 min-w-0">
                          <span className={classNames(
                            'block text-[18px] font-bold truncate',
                            embarcado ? 'text-white' : 'text-sol-tinta'
                          )}>
                            {f.nombre}
                          </span>
                          {(f.documento || f.categoria) && (
                            <span className={classNames(
                              'block text-[15px] tabular truncate',
                              embarcado ? 'text-white/85' : 'text-sol-tinta-2'
                            )}>
                              {[f.documento, f.categoria !== 'adulto' ? f.categoria : null]
                                .filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>

                        {reciente && (
                          <span className="shrink-0 flex items-center gap-1.5 text-white text-[15px] font-bold">
                            <Undo2 size={18} /> Toca para deshacer
                          </span>
                        )}
                        {noLlego && (
                          <span className="shrink-0 text-[15px] font-bold text-sol-tinta-2">No llegó</span>
                        )}
                      </button>

                      {/* Aparte del botón de embarcar, no dentro: un toque
                          sigue siendo un toque, y quien tenga prisa embarca
                          sin escribir nada. */}
                      {puedeNombrarse && (
                        <button
                          onClick={() => setNombrando(f)}
                          className="shrink-0 w-[76px] rounded-2xl bg-white ring-2 ring-sol-linea text-sol-tinta-2 flex flex-col items-center justify-center gap-0.5"
                          aria-label={`Ponerle nombre a la ${f.nombre.toLowerCase()}`}
                        >
                          <UserPlus size={20} />
                          <span className="text-[13px] font-bold">Nombre</span>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        {walkIns.length > 0 && (
          <section>
            <h2 className="text-[18px] font-bold text-sol-tinta mb-2">
              Sin reserva ({walkIns.length})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {walkIns.map(w => (
                <li key={w.client_id}
                  className="flex items-center gap-4 rounded-2xl px-5 min-h-[64px] bg-verde-500 ring-2 ring-verde-500">
                  <Check size={22} className="text-white shrink-0" strokeWidth={3.5} />
                  <span className="text-[18px] font-bold text-white truncate">{w.nombre}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {grupos.every(g => !g.filas.filter(coincide).length) && (
          <p className="text-[18px] text-sol-tinta-2 py-8 text-center">
            {busqueda ? 'Nadie coincide con esa búsqueda.' : 'Esta lancha no tiene gente asignada.'}
          </p>
        )}
      </main>

      {/* Acciones fijas abajo.
          El manifiesto también después de cerrado: la Capitanía puede pedirlo
          otra vez y no hay razón para esconderlo. */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-sol-fondo border-t-2 border-sol-linea-2 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex gap-3">
        {!cerrado && (
          <button
            onClick={() => setWalkInAbierto(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white ring-2 ring-sol-tinta text-sol-tinta text-[17px] font-bold min-h-[64px]"
          >
            <UserPlus size={22} />
            Sin reserva
          </button>
        )}
        <button
          onClick={imprimirManifiesto}
          disabled={manifiesto.total === 0}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white ring-2 ring-sol-tinta text-sol-tinta text-[17px] font-bold min-h-[64px] disabled:opacity-40"
        >
          <FileText size={22} />
          <span>Manifiesto</span>
          <span className="tabular text-[15px] font-black">{manifiesto.total}</span>
        </button>
        {!cerrado && (
          <button
            onClick={cerrarZarpe}
            disabled={cerrando}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 text-white text-[17px] font-bold min-h-[64px] disabled:opacity-50"
          >
            <Anchor size={22} />
            {cerrando ? 'Cerrando…' : esRegreso ? 'Cerrar el regreso' : 'Cerrar el zarpe'}
          </button>
        )}
      </div>

      {/* A las 3:30 el que no bajó se quedó en la isla. Es lo único de todo el
          día que no se puede arreglar después. */}
      {/* El contador se sigue moviendo mientras el aviso está abierto: si la
          cola termina de drenar y ya no falta nadie, el aviso desaparece solo.
          Dejarlo diciendo "0 personas no han bajado" sería peor que no
          mostrarlo. */}
      {confirmandoFaltantes && contador.faltan > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 flex flex-col gap-4">
            <h2 className="text-[24px] font-bold text-alarma-700">
              {plural(contador.faltan, 'persona no ha bajado', 'personas no han bajado')}
            </h2>
            <p className="text-[17px] text-sol-tinta">
              Si cierras ahora quedan registradas como que se quedaron en la isla.
              Revisa la lista antes: es lo único del día que no se arregla después.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConfirmandoFaltantes(false)}
                className="flex-1 rounded-2xl bg-blue-600 text-white text-[18px] font-bold min-h-[64px]"
              >
                Volver a revisar
              </button>
              <button
                onClick={cerrarZarpe}
                disabled={cerrando}
                className="flex-1 rounded-2xl bg-white ring-2 ring-alarma-700 text-alarma-700 text-[18px] font-bold min-h-[64px] disabled:opacity-50"
              >
                {cerrando ? 'Cerrando…' : 'Cerrar así'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lo que le va a faltar al documento, antes de imprimirlo y no después
          de que la autoridad lo devuelva. */}
      {!cerrado && faltasDelManifiesto.length > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] inset-x-0 z-20 px-4">
          <p className={classNames(
            'mx-auto max-w-2xl rounded-xl px-4 py-2 text-[15px] font-bold text-center ring-2',
            manifiesto.piloto
              ? 'bg-aviso-50 ring-aviso-300 text-aviso-700'
              : 'bg-alarma-50 ring-alarma-300 text-alarma-900'
          )}>
            El manifiesto va {faltasDelManifiesto.join(' y ')}
          </p>
        </div>
      )}

      {lectorAbierto && (
        <LectorQR
          onLeer={alLeerPase}
          onCerrar={() => setLectorAbierto(false)}
          onBuscarPorNombre={() => { setLectorAbierto(false); setBusqueda('') }}
        />
      )}

      {walkInAbierto && (
        <FormularioPersona
          titulo="Llegó sin reserva"
          cta="Embarcar"
          paises={extras.paises}
          onCerrar={() => setWalkInAbierto(false)}
          onGuardar={async datos => {
            const { error } = await registrarEvento(null, 'walk_in', datos)
            setWalkInAbierto(false)
            if (error) toast.error('No se pudo registrar. ' + error.message)
            else toast.success(`${datos.nombre} embarcado`)
          }}
        />
      )}

      {/* Una plaza suelta que sí trae a alguien delante. Se nombra y sube de un
          golpe: la Capitanía la quiere nominal y la persona está ahí. */}
      {nombrando && (
        <FormularioPersona
          titulo="¿Quién es?"
          cta={esRegreso ? 'Guardar y bajar' : 'Guardar y embarcar'}
          paises={extras.paises}
          onCerrar={() => setNombrando(null)}
          onGuardar={async datos => {
            const { error } = await nombrarPlaza(nombrando, datos)
            setNombrando(null)
            if (error) toast.error('No se pudo guardar. ' + error.message)
            else toast.success(`${datos.nombre} — ${esRegreso ? 'bajó' : 'a bordo'}`)
          }}
        />
      )}
    </div>
  )
}
