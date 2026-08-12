import { useState, useMemo, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  PlusCircle, Edit2, Trash2,
  AlertTriangle, CheckCircle2, Filter, MessageCircle, History
} from 'lucide-react'
import EnviarTarjetas from '../components/hoy/EnviarTarjetas'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { EstadoError, Esqueleto, InsigniaEstado } from '../components/patrones'
import { usePerfil } from '../hooks/usePerfil'
import { puedeVer } from '../lib/navegacion'
import {
  formatCurrency, formatDate, classNames, plural,
  ESTADO_LABELS, FORMA_PAGO_LABELS, IMPUESTOS_LABELS
} from '../lib/utils'
import { contarPorRegistro } from '../hooks/usePasajeros'
import { useRegistrosEnVivo, useDiaOperativo, cambiarEstadoManual } from '../hooks/useDiaOperativo'
import FranjaDia from '../components/layout/FranjaDia'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import DateNav from '../components/ui/DateNav'
import BotonIcono from '../components/ui/BotonIcono'
import PageHeader from '../components/layout/PageHeader'
import { useMuestraDinero } from '../lib/modo'

const ESTADOS = ['tentativa', 'confirmada', 'en_isla', 'completada', 'noshow', 'cancelada']

/**
 * Esta reserva cambió después de cerrar el tentativo. La cocina y la isla ya
 * trabajaron con la versión anterior, así que tiene que verse.
 */
function MarcaCambioTardio({ registro }) {
  if (!registro.cambio_tardio) return null
  const hora = registro.cambio_tardio_at
    ? new Date(registro.cambio_tardio_at).toLocaleTimeString('es-CO', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg bg-coral-50 text-coral-600 px-2 py-0.5 text-[12px] font-bold shrink-0"
      title={hora ? `Cambió a las ${hora}, después del cierre` : 'Cambió después del cierre'}
    >
      <AlertTriangle size={12} />
      Cambió tras el cierre
    </span>
  )
}

/**
 * Cuántos nombres tiene la reserva contra lo planeado. Coral cuando faltan:
 * es un pendiente, no un error — los listados llegan tarde y eso es normal.
 */
function ContadorNombres({ registro, conteo }) {
  const plan = registro.adultos + registro.ninos + registro.infantes + registro.cortesias
  if (conteo >= plan && plan > 0) {
    return <span className="text-verde-500 font-bold text-xs tabular">{conteo}/{plan}</span>
  }
  return (
    <Link
      to={`/editar/${registro.id}`}
      className={classNames(
        'inline-block rounded-lg px-2 py-0.5 text-xs font-bold tabular',
        conteo === 0 ? 'bg-coral-50 text-coral-600' : 'bg-coral-50 text-coral-600'
      )}
      title="Agregar los nombres de esta reserva"
    >
      {conteo}/{plan}
    </Link>
  )
}

/**
 * El estado de una reserva: un dato que se puede cambiar, no un control.
 *
 * ── Qué estaba mal ──────────────────────────────────────────────────────────
 *
 * Cada fila tenía un desplegable abierto. Con doce reservas eso son **doce
 * controles activos** compitiendo por la atención en una pantalla que se abre
 * para *leer* el día, no para editarlo.
 *
 * Y hay algo peor que el ruido. La regla 3 dice que **los estados los dispara
 * la operación y el cambio manual es la excepción auditada**: el muelle marca
 * quién subió, el regreso marca quién bajó. Con un desplegable por fila, la
 * excepción era lo más fácil de hacer sin querer — un roce en el iPad y una
 * reserva pasaba a «no llegó» sin que nadie lo notara.
 *
 * ── Qué hace ahora ──────────────────────────────────────────────────────────
 *
 * Se muestra como lo que es: el estado, con su palabra y su color. Tocarlo
 * abre el selector. **Es un clic más y está bien**: lo que cansa no es hacer
 * clic, es dudar. Un clic deliberado sobre algo que dice «Confirmada» no
 * cuesta nada; doce desplegables sí cuestan.
 *
 * Quien no puede editar ve lo mismo, sin el toque. La pantalla se lee igual
 * para todos, que es lo que hace que se pueda hablar de ella por teléfono.
 */
function EstadoDeLaFila({ registro, puedeEditar, onCambiar }) {
  const [abierto, setAbierto] = useState(false)

  if (!puedeEditar) return <InsigniaEstado estado={registro.estado} />

  if (abierto) {
    return (
      <Select
        size="sm"
        value={registro.estado}
        onChange={v => { setAbierto(false); onCambiar(v) }}
        options={ESTADOS.map(e => ({ value: e, label: ESTADO_LABELS[e] }))}
        className="w-36"
      />
    )
  }

  return (
    <button
      onClick={() => setAbierto(true)}
      // El objetivo llega a 44px aunque la insignia sea más chica: esto se
      // toca en un iPad.
      className="min-h-[2.75rem] flex items-center rounded-xl hover:bg-blue-50 px-1 -mx-1"
      title={`Cambiar el estado de ${registro.nombre_pasajero}`}
    >
      <InsigniaEstado estado={registro.estado} />
    </button>
  )
}

export default function ListadoDia() {
  const navigate = useNavigate()

  /**
   * Si el aparato está configurado como muelle o isla, no se pinta plata.
   *
   * **No es control de acceso** —eso es la RLS, y ya enmascara por rol— es
   * discreción física: esta lista se abre de pie, con la fila detrás mirando
   * la pantalla. La misma persona con el mismo permiso no debería enseñar
   * totales en el muelle.
   */
  const muestraDinero = useMuestraDinero()
  const {
    fechaActiva, setFechaActiva,
    filtroLancha, setFiltroLancha,
    filtroEstado, setFiltroEstado,
    filtroCanal, setFiltroCanal,
  } = useAppStore()

  const { registros, loading, error, updateRegistro, deleteRegistro, refetch } = useRegistros(fechaActiva)

  // Lo que un rol no puede usar, no aparece: la isla y gerencia abren esta
  // pantalla para mirar, y la base les rechaza escribir (018 y 019). Un botón
  // que siempre responde con un error es peor que no tener el botón.
  const { rol } = usePerfil()
  const puedeEditar = puedeVer(rol, '/editar')

  // Lo que cambie en el muelle o en la isla aparece aquí sin recargar.
  useRegistrosEnVivo(fechaActiva, refetch)

  const [editingFolio, setEditingFolio] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [nombres, setNombres] = useState({})
  const [pidiendoMotivo, setPidiendoMotivo] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [mandandoEnlaces, setMandandoEnlaces] = useState(false)
  const { enPlaneacion } = useDiaOperativo(fechaActiva)

  useEffect(() => {
    let vigente = true
    contarPorRegistro(registros.map(r => r.id))
      .then(conteo => { if (vigente) setNombres(conteo) })
    return () => { vigente = false }
  }, [registros])

  const lanchas = useMemo(() => {
    const map = {}
    registros.forEach(r => { if (r.lanchas) map[r.lanchas.id] = r.lanchas })
    return Object.values(map)
  }, [registros])

  const canales = useMemo(() => {
    const map = {}
    registros.forEach(r => { if (r.canales) map[r.canales.id] = r.canales })
    return Object.values(map)
  }, [registros])

  const filtered = useMemo(() =>
    registros.filter(r => {
      if (filtroLancha && r.lancha_id !== filtroLancha) return false
      if (filtroEstado && r.estado !== filtroEstado) return false
      if (filtroCanal && r.canal_id !== filtroCanal) return false
      return true
    }),
    [registros, filtroLancha, filtroEstado, filtroCanal]
  )

  const byLancha = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const key = r.lanchas?.nombre || 'Sin lancha'
      if (!map[key]) map[key] = []
      map[key].push(r)
    })
    return map
  }, [filtered])

  async function handleEstadoChange(id, newEstado, registro) {
    if (newEstado === 'completada' && !registro.folio_zeus) {
      toast.error('Escribe el folio Zeus antes de dar esta reserva por completada.')
      return
    }
    // Con el día ya cerrado, todo cambio a mano pide motivo: queda en la
    // bitácora y la cocina y la isla tienen que enterarse.
    if (!enPlaneacion) {
      setPidiendoMotivo({ id, estado: newEstado, nombre: registro.nombre_pasajero })
      return
    }
    await aplicarEstado(id, newEstado)
  }

  async function aplicarEstado(id, nuevoEstado, motivo) {
    const { error } = motivo
      ? await cambiarEstadoManual(id, nuevoEstado, motivo).then(r => ({ error: r.error }))
      : await updateRegistro(id, { estado: nuevoEstado })
    if (error) {
      toast.error('No se pudo cambiar el estado. Inténtalo otra vez.')
    } else {
      toast.success(`Ahora está ${ESTADO_LABELS[nuevoEstado].toLowerCase()}`)
      if (motivo) await refetch()
    }
  }

  async function handleFolioSave(id, folio) {
    const { error } = await updateRegistro(id, { folio_zeus: folio })
    if (error) toast.error('Error al guardar folio')
    else {
      toast.success('Folio guardado')
      setEditingFolio(prev => ({ ...prev, [id]: undefined }))
    }
  }

  async function handleDelete(id) {
    const { error } = await deleteRegistro(id)
    if (error) toast.error('No se pudo eliminar la reserva. Inténtalo otra vez.')
    else toast.success('Reserva eliminada')
    setDeletingId(null)
  }

  const totalPax = filtered
    .filter(r => !['cancelada', 'noshow'].includes(r.estado))
    .reduce((s, r) => s + r.adultos + r.ninos, 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <FranjaDia />
      <PageHeader
        title="Reservas"
        subtitle={formatDate(fechaActiva)}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DateNav value={fechaActiva} onChange={setFechaActiva} />
            {/* Historial salió del menú: se llega desde su sustantivo, que es
                donde alguien lo busca — «reservas, pero de antes». */}
            <Link
              to="/historial"
              className="flex items-center gap-1.5 text-sm font-bold text-tinta-2 hover:text-blue-700 px-2 min-h-[40px]"
            >
              <History size={14} />
              Historial
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={14} />
              Filtros
            </Button>
            {/* Aquí y no solo en el cierre: el check-in se cierra con el día,
                así que el enlace tiene que poder salir desde el momento en
                que la reserva existe. */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMandandoEnlaces(true)}
              disabled={registros.length === 0}
            >
              <MessageCircle size={14} />
              Enlaces
            </Button>
            {puedeVer(rol, '/nuevo') && (
              <Button size="sm" onClick={() => navigate('/nuevo')}>
                <PlusCircle size={16} />
                Nueva reserva
              </Button>
            )}
          </div>
        }
      />

      {/* Resumen rápido */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <span><b className="text-tinta">{filtered.length}</b> {filtered.length === 1 ? 'reserva' : 'reservas'}</span>
        <span>·</span>
        <span><b className="text-gray-900">{totalPax}</b> personas</span>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card className="p-4 mb-4">
          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Lancha"
              value={filtroLancha}
              onChange={setFiltroLancha}
              options={[
                { value: '', label: 'Todas' },
                ...lanchas.map(l => ({ value: l.id, label: l.nombre })),
              ]}
            />
            <Select
              label="Estado"
              value={filtroEstado}
              onChange={setFiltroEstado}
              options={[
                { value: '', label: 'Todos' },
                ...ESTADOS.map(e => ({ value: e, label: ESTADO_LABELS[e] })),
              ]}
            />
            <Select
              label="Canal"
              value={filtroCanal}
              onChange={setFiltroCanal}
              options={[
                { value: '', label: 'Todos' },
                ...canales.map(c => ({ value: c.id, label: c.nombre })),
              ]}
            />
          </div>
          <button
            onClick={() => { setFiltroLancha(''); setFiltroEstado(''); setFiltroCanal('') }}
            className="text-xs text-blue-600 hover:underline mt-2"
          >
            Limpiar filtros
          </button>
        </Card>
      )}

      {loading ? (
        <Esqueleto filas={5} />
      ) : error ? (
        <EstadoError error={error} onReintentar={refetch} />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-tinta-2">Todavía no hay reservas para este día</p>
          <Button className="mt-4" onClick={() => navigate('/nuevo')}>
            <PlusCircle size={16} />
            Crear la primera
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(byLancha).map(([nombreLancha, regs]) => (
            <div key={nombreLancha}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{nombreLancha}</h2>
                <span className="text-xs text-gray-400">
                  {regs.filter(r=>!['cancelada','noshow'].includes(r.estado)).reduce((s,r)=>s+r.adultos+r.ninos,0)} pax
                </span>
              </div>

              <Card>
                {/* Desktop table */}
                {/* Tabla completa solo desde 1280px. En iPad —768 vertical y
                    1024 horizontal— las tarjetas de abajo son más operables
                    que diez columnas apretadas. */}
                <div className="hidden xl:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pasajero</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Pax</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Nombres</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Pago</th>
                        {/* «Impuesto», no «Imp.». La columna la lee quien va a
                            cobrarlo en el muelle: abreviarla ahorra ocho
                            píxeles y cuesta una pregunta. */}
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Impuesto</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Folio Zeus</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {regs.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 flex items-center gap-1.5 flex-wrap">
                              {r.tipo === 'grupo' && (
                                <span className="text-xs bg-arena-100 text-arena-700 px-1.5 py-0.5 rounded font-bold">GRUPO</span>
                              )}
                              {r.nombre_pasajero}
                              <MarcaCambioTardio registro={r} />
                            </div>
                            {r.nombre_grupo && <div className="text-xs text-gray-400 mt-0.5">{r.nombre_grupo}</div>}
                            {r.agencia_nombre && <div className="text-xs text-gray-400">{r.agencia_nombre}</div>}
                          </td>
                          <td className="px-3 py-3 text-gray-600 text-xs">{r.planes?.nombre || '—'}</td>
                          <td className="px-3 py-3 text-center">
                            <span className="font-medium">{r.adultos}</span>
                            {r.ninos > 0 && <span className="text-gray-400 text-xs ml-1">+{r.ninos}n</span>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ContadorNombres registro={r} conteo={nombres[r.id] || 0} />
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-gray-900">
                            {muestraDinero ? formatCurrency(r.total_calculado) : '—'}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600">
                            {r.forma_pago ? FORMA_PAGO_LABELS[r.forma_pago] : (
                              <span className="text-orange-500 flex items-center gap-1">
                                <AlertTriangle size={12} /> Sin pago
                              </span>
                            )}
                          </td>
                          {/**
                            * El impuesto es un dato, no un estado.
                            *
                            * Venía como píldora de color —verde, rojo, gris—
                            * al lado de la columna de estado, que también son
                            * píldoras de color. Dos filas de colores juntas y
                            * el ojo no sabe cuál mirar.
                            *
                            * Y el rojo mentía. En este sistema **rojo es error
                            * real y sobrecupo**; que a alguien no se le cobre
                            * el impuesto de puerto no es un error, es lo
                            * acordado. Ese rojo le robaba peso al coral de «No
                            * llegó», que sí pide algo.
                            *
                            * Queda como texto. Solo «Exento» se distingue, y
                            * en gris: es la excepción, y la que hay que ver de
                            * reojo cuando se cobra en el muelle.
                            */}
                          <td className="px-3 py-3">
                            <span className={classNames(
                              'text-xs',
                              r.impuestos_puerto === 'exe'
                                ? 'font-bold text-tinta-2 bg-fondo px-2 py-0.5 rounded'
                                : 'text-tinta-2'
                            )}>
                              {IMPUESTOS_LABELS[r.impuestos_puerto]}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <EstadoDeLaFila
                              registro={r}
                              puedeEditar={puedeEditar}
                              onCambiar={v => handleEstadoChange(r.id, v, r)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            {!puedeEditar ? (
                              <span className="text-xs font-mono text-tinta-2">
                                {r.folio_zeus || '—'}
                              </span>
                            ) : editingFolio[r.id] !== undefined ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingFolio[r.id]}
                                  onChange={e => setEditingFolio(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  className="w-24 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleFolioSave(r.id, editingFolio[r.id])
                                    if (e.key === 'Escape') setEditingFolio(prev => ({ ...prev, [r.id]: undefined }))
                                  }}
                                />
                                <button
                                  onClick={() => handleFolioSave(r.id, editingFolio[r.id])}
                                  aria-label="Guardar el folio"
                                  title="Guardar el folio"
                                  className="icono-tactil w-11 h-11 inline-flex items-center justify-center text-verde-600 hover:text-verde-700 rounded-xl transition-colors"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingFolio(prev => ({ ...prev, [r.id]: r.folio_zeus || '' }))}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  r.folio_zeus
                                    ? 'font-mono text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-orange-500 bg-orange-50 hover:bg-orange-100 flex items-center gap-1'
                                }`}
                              >
                                {r.folio_zeus || (
                                  <><AlertTriangle size={11} /> Sin folio</>
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {/* Editar y eliminar, separados. Estaban pegados,
                                a 26px cada uno y del mismo gris: el
                                destructivo se veía igual que el corriente y
                                cabían los dos bajo un dedo. Ahora el objetivo
                                es de 44px —esto se usa en iPad— y entre los
                                dos hay aire. */}
                            <div className="flex items-center gap-2">
                              {puedeEditar && (
                                <>
                                  <BotonIcono
                                    onClick={() => navigate(`/editar/${r.id}`)}
                                    etiqueta={`Editar la reserva de ${r.nombre_pasajero}`}
                                    titulo="Editar"
                                  >
                                    <Edit2 size={16} />
                                  </BotonIcono>
                                  <BotonIcono
                                    tono="peligro"
                                    onClick={() => setDeletingId(r.id)}
                                    etiqueta={`Eliminar la reserva de ${r.nombre_pasajero}`}
                                    titulo="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </BotonIcono>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tarjetas: móvil e iPad. Dos por fila en horizontal. */}
                <div className="xl:hidden divide-y divide-linea lg:divide-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:p-3">
                  {regs.map(r => {
                    const plan = r.adultos + r.ninos + r.infantes + r.cortesias
                    const conNombre = nombres[r.id] || 0
                    return (
                      <div key={r.id} className="bg-white p-4 lg:rounded-xl lg:ring-1 lg:ring-linea flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-[15px] text-tinta truncate">{r.nombre_pasajero}</p>
                            {r.nombre_grupo && <p className="text-[13px] text-tinta-2 truncate">{r.nombre_grupo}</p>}
                            {r.agencia_nombre && <p className="text-[13px] text-tinta-2 truncate">{r.agencia_nombre}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <InsigniaEstado estado={r.estado} />
                            <MarcaCambioTardio registro={r} />
                          </div>
                        </div>

                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-tinta-2 truncate">{r.planes?.nombre || '—'}</span>
                          <span className="font-bold text-tinta tabular shrink-0">
                            {muestraDinero ? formatCurrency(r.total_calculado) : '—'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-[13px]">
                          <span className="tabular text-tinta-2">
                            {plural(r.adultos, 'adulto', 'adultos')}
                            {r.ninos > 0 ? ` · ${plural(r.ninos, 'niño', 'niños')}` : ''}
                          </span>
                          <span className="text-linea">·</span>
                          {conNombre >= plan && plan > 0 ? (
                            <span className="text-verde-500 font-bold tabular">{conNombre}/{plan} nombres</span>
                          ) : (
                            <Link
                              to={`/editar/${r.id}`}
                              className="rounded-lg bg-coral-50 text-coral-600 font-bold px-2 py-0.5 tabular"
                            >
                              {conNombre}/{plan} nombres
                            </Link>
                          )}
                          {!r.forma_pago && (
                            <>
                              <span className="text-linea">·</span>
                              <span className="text-coral-600 font-bold">Sin pago</span>
                            </>
                          )}
                          {!r.folio_zeus && (
                            <>
                              <span className="text-linea">·</span>
                              <span className="text-coral-600 font-bold">Sin folio</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <EstadoDeLaFila
                            registro={r}
                            puedeEditar={puedeEditar}
                            onCambiar={v => handleEstadoChange(r.id, v, r)}
                          />
                          {puedeEditar && (
                            <>
                              <BotonIcono
                                onClick={() => navigate(`/editar/${r.id}`)}
                                etiqueta={`Editar la reserva de ${r.nombre_pasajero}`}
                                className="text-blue-700 bg-blue-50"
                              >
                                <Edit2 size={18} />
                              </BotonIcono>
                              <BotonIcono
                                tono="peligro"
                                onClick={() => setDeletingId(r.id)}
                                etiqueta={`Eliminar la reserva de ${r.nombre_pasajero}`}
                                className="bg-fondo"
                              >
                                <Trash2 size={18} />
                              </BotonIcono>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {mandandoEnlaces && (
        <EnviarTarjetas
          registros={registros}
          cerrado={!enPlaneacion}
          onCerrar={() => { setMandandoEnlaces(false); refetch() }}
        />
      )}

      <Modal open={Boolean(deletingId)} onClose={() => setDeletingId(null)} title="Eliminar la reserva">
        <p className="text-[15px] text-tinta mb-4">
          Se va a eliminar esta reserva y los nombres que tenga cargados. No se puede deshacer.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(deletingId)}>Eliminar</Button>
        </div>
      </Modal>

      {/* Con el día cerrado, un cambio a mano necesita explicación. */}
      <Modal
        open={Boolean(pidiendoMotivo)}
        onClose={() => { setPidiendoMotivo(null); setMotivo('') }}
        title="¿Por qué cambia esta reserva?"
      >
        <p className="text-[15px] text-tinta">
          El día ya está cerrado y <b>{pidiendoMotivo?.nombre}</b> pasa a{' '}
          <b>{ESTADO_LABELS[pidiendoMotivo?.estado]?.toLowerCase()}</b>. Deja una línea:
          queda en la bitácora y la isla la ve.
        </p>
        <input
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          autoFocus
          placeholder="Ej: la agencia canceló a las 6 a.m."
          className="w-full mt-3 rounded-xl border border-linea px-3 py-2.5 min-h-[44px] text-sm bg-white focus:outline-none focus:border-blue-600"
        />
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="ghost" onClick={() => { setPidiendoMotivo(null); setMotivo('') }}>
            Cancelar
          </Button>
          <Button
            disabled={!motivo.trim()}
            onClick={async () => {
              await aplicarEstado(pidiendoMotivo.id, pidiendoMotivo.estado, motivo.trim())
              setPidiendoMotivo(null)
              setMotivo('')
            }}
          >
            Guardar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
