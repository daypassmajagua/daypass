import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Check, ChevronLeft, Search, Settings2, Ship, UserPlus, X, Anchor, Undo2,
} from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { useZarpesDelDia, useEmbarque, claveDe } from '../hooks/useEmbarque'
import { classNames, fraseFecha, hora12, plural } from '../lib/utils'
import PrepararZarpe from '../components/zarpe/PrepararZarpe'
import IndicadorSync from '../components/layout/IndicadorSync'

/**
 * El muelle.
 *
 * Aquí la vara es física, no estética: iPad en horizontal, usado de pie, a
 * pleno sol, con una mano ocupada y 250 personas esperando. Alto contraste
 * sin grises medios —el sol los lava—, filas de 64px y un toque para marcar.
 */

const VENTANA_DESHACER = 8000

// ─── Selección de zarpe ────────────────────────────────────────────────────────

function SelectorZarpe({ zarpes, onElegir, onProgramar, onRecargar, fecha, cargando }) {
  const [programando, setProgramando] = useState(false)
  const [preparando, setPreparando] = useState(null)

  if (cargando) return <p className="text-[18px] text-[#3a3d52] p-6">Buscando los zarpes del día…</p>

  if (!zarpes.length) {
    return (
      <div className="p-6 flex flex-col items-start gap-4">
        <p className="text-[20px] font-bold text-[#101223]">
          Todavía no hay zarpes programados para {fraseFecha(fecha).toLowerCase()}.
        </p>
        <p className="text-[17px] text-[#3a3d52]">
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
        <h1 className="text-[24px] font-bold text-[#101223] tracking-[-.02em]">
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
                cerrado ? 'bg-white ring-[#d8d8d2]' : 'bg-white ring-[#101223]'
              )}
            >
              <Ship size={28} className={cerrado ? 'text-[#6a6d80]' : 'text-blue-700'} />
              <span className="flex-1 min-w-0">
                <span className="block text-[20px] font-bold text-[#101223]">
                  {z.lanchas?.nombre || 'Lancha'}
                </span>
                <span className="block text-[16px] text-[#3a3d52]">
                  {z.sentido === 'ida' ? 'Ida' : 'Regreso'}
                  {z.hora_programada ? ` · ${z.hora_programada.slice(0, 5)}` : ''}
                  {preparado && z.pilotos?.nombre ? ` · ${z.pilotos.nombre}` : ''}
                  {cerrado && ` · zarpó ${hora12(z.hora_real_salida) || ''}`}
                </span>
              </span>
              {cerrado
                ? <span className="text-[16px] font-bold text-verde-600 shrink-0">Cerrado</span>
                : <ChevronLeft size={26} className="rotate-180 text-[#6a6d80] shrink-0" />}
            </button>

            {!cerrado && (
              <button
                onClick={() => setPreparando(z)}
                className={classNames(
                  'shrink-0 w-[92px] rounded-2xl ring-2 text-[14px] font-bold flex flex-col items-center justify-center gap-1 transition-colors',
                  preparado
                    ? 'bg-verde-50 ring-verde-500 text-verde-600'
                    : 'bg-white ring-[#c8c9d4] text-[#3a3d52]'
                )}
              >
                <Settings2 size={20} />
                {preparado ? 'Lista' : 'Preparar'}
              </button>
            )}
          </div>
        )
      })}

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

function FormularioWalkIn({ onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [categoria, setCategoria] = useState('adulto')
  const [guardando, setGuardando] = useState(false)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-bold text-[#101223]">Llegó sin reserva</h2>
          <button onClick={onCerrar} className="w-12 h-12 flex items-center justify-center rounded-xl text-[#3a3d52]">
            <X size={26} />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[16px] font-bold text-[#101223]">Nombre</span>
          <input
            value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
            className="rounded-xl border-2 border-[#c8c9d4] px-4 min-h-[60px] text-[18px] focus:outline-none focus:border-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[16px] font-bold text-[#101223]">Documento</span>
          <input
            value={documento} onChange={e => setDocumento(e.target.value)} inputMode="numeric"
            className="rounded-xl border-2 border-[#c8c9d4] px-4 min-h-[60px] text-[18px] tabular focus:outline-none focus:border-blue-600"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[16px] font-bold text-[#101223]">Categoría</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'adulto', l: 'Adulto' }, { v: 'nino', l: 'Niño' },
              { v: 'infante', l: 'Infante' }, { v: 'cortesia', l: 'Cortesía' },
            ].map(o => (
              <button
                key={o.v} type="button" onClick={() => setCategoria(o.v)}
                className={classNames(
                  'rounded-xl min-h-[60px] text-[17px] font-bold ring-2 transition-colors',
                  categoria === o.v ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-[#101223] ring-[#c8c9d4]'
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
            await onGuardar({ nombre: nombre.trim(), documento: documento.trim(), categoria })
            setGuardando(false)
          }}
          className="rounded-2xl bg-blue-600 text-white text-[19px] font-bold min-h-[64px] disabled:opacity-40"
        >
          Embarcar
        </button>
      </div>
    </div>
  )
}

// ─── Pantalla ──────────────────────────────────────────────────────────────────

export default function Embarque() {
  const fechaActiva = useAppStore(s => s.fechaActiva)
  const { zarpes, cargando, programar, recargar: recargarZarpes } = useZarpesDelDia(fechaActiva)
  const [zarpeId, setZarpeId] = useState(null)

  const zarpe = useMemo(() => zarpes.find(z => z.id === zarpeId) || null, [zarpes, zarpeId])
  const { grupos, walkIns, contador, registrarEvento, cerrar, recargar } = useEmbarque(zarpe)

  const [busqueda, setBusqueda] = useState('')
  const [walkInAbierto, setWalkInAbierto] = useState(false)
  const [cerrando, setCerrando] = useState(false)
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
      <div className="min-h-screen bg-[#f4f4f0]">
        <SelectorZarpe zarpes={zarpes} onElegir={z => setZarpeId(z.id)}
          onProgramar={programar} onRecargar={recargarZarpes}
          fecha={fechaActiva} cargando={cargando} />
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
    const embarcado = ['check_in', 'walk_in'].includes(fila.estado)

    // Volver a tocar dentro de la ventana deshace lo que se acaba de marcar.
    if (embarcado && hace && Date.now() - hace < VENTANA_DESHACER) {
      setRecientes(prev => { const s = { ...prev }; delete s[clave]; return s })
      await registrarEvento(fila, 'no_show')
      toast('Deshecho', { duration: 1500 })
      return
    }
    if (embarcado) return   // ya estaba: un toque no lo tumba después de la ventana

    setRecientes(prev => ({ ...prev, [clave]: Date.now() }))
    // Pasada la ventana, la fila deja de ofrecer deshacer por sí sola.
    setTimeout(() => {
      setRecientes(prev => { const s = { ...prev }; delete s[clave]; return s })
    }, VENTANA_DESHACER)
    await registrarEvento(fila, 'check_in')
  }

  async function embarcarTodos(grupo) {
    const pendientes = grupo.filas.filter(f => !['check_in', 'walk_in'].includes(f.estado))
    for (const f of pendientes) await registrarEvento(f, 'check_in')
    toast.success(`${plural(pendientes.length, 'persona embarcada', 'personas embarcadas')}`)
  }

  async function cerrarZarpe() {
    setCerrando(true)
    const { error } = await cerrar()
    setCerrando(false)
    if (error) { toast.error('No se pudo cerrar el zarpe. ' + error.message); return }
    toast.success('Zarpe cerrado. Su gente ya está en la isla.')
    await recargar()
  }

  return (
    <div className="min-h-screen bg-[#f4f4f0] flex flex-col">
      {/* Cabecera fija: buscador y contador siempre a la vista */}
      <header className="sticky top-0 z-30 bg-[#f4f4f0] border-b-2 border-[#d8d8d2] px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setZarpeId(null)}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-[#101223] shrink-0"
            aria-label="Cambiar de lancha"
          >
            <ChevronLeft size={28} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-bold text-[#101223] truncate">
              {zarpe.lanchas?.nombre}
              {zarpe.hora_programada && <span className="text-[#3a3d52] font-normal"> · {zarpe.hora_programada.slice(0, 5)}</span>}
            </p>
            {cerrado && (
              <p className="text-[15px] text-[#3a3d52]">
                Zarpó a las {hora12(zarpe.hora_real_salida) || ''}
              </p>
            )}
          </div>

          {!cerrado && <IndicadorSync muelle />}

          {/* El contador: lo que ella mira cada 30 segundos */}
          <div className="text-right shrink-0">
            <p className="text-[34px] leading-none font-bold text-[#101223] tabular">
              {contador.embarcados}<span className="text-[#6a6d80]">/{contador.esperados}</span>
            </p>
            <p className="text-[15px] text-[#3a3d52]">
              {contador.faltan > 0 ? `faltan ${contador.faltan}` : 'todos a bordo'}
            </p>
          </div>
        </div>

        <div className="relative">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6a6d80] pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o documento"
            className="w-full rounded-2xl border-2 border-[#c8c9d4] bg-white pl-13 pr-4 min-h-[60px] text-[18px] focus:outline-none focus:border-blue-600"
            style={{ paddingLeft: '3.25rem' }}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-[#3a3d52]"
              aria-label="Limpiar la búsqueda"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </header>

      {/* La lista */}
      <main className="flex-1 px-4 py-4 flex flex-col gap-5 pb-32">
        {grupos.map(g => {
          const filas = g.filas.filter(coincide)
          if (!filas.length) return null
          const quien = g.registro.nombre_grupo || g.registro.agencia_nombre || g.registro.nombre_pasajero
          const pendientes = g.filas.filter(f => !['check_in', 'walk_in'].includes(f.estado)).length

          return (
            <section key={g.registro.id}>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-[18px] font-bold text-[#101223] flex-1 min-w-0 truncate">{quien}</h2>
                <span className="text-[16px] font-bold tabular text-[#3a3d52] shrink-0">
                  {g.embarcados}/{g.filas.length}
                </span>
                {!cerrado && pendientes > 0 && (
                  <button
                    onClick={() => embarcarTodos(g)}
                    className="shrink-0 rounded-xl bg-[#101223] text-white text-[15px] font-bold px-4 min-h-[48px]"
                  >
                    Embarcar los {pendientes} que faltan
                  </button>
                )}
              </div>

              <ul className="flex flex-col gap-1.5">
                {filas.map(f => {
                  const embarcado = ['check_in', 'walk_in'].includes(f.estado)
                  const noLlego = f.estado === 'no_show'
                  const clave = claveDe(f)
                  const reciente = embarcado && Boolean(recientes[clave])

                  return (
                    <li key={clave}>
                      <button
                        onClick={() => alTocar(f)}
                        disabled={cerrado}
                        className={classNames(
                          'w-full flex items-center gap-4 rounded-2xl px-5 min-h-[64px] text-left ring-2 transition-colors',
                          embarcado ? 'bg-verde-500 ring-verde-500'
                            : noLlego ? 'bg-white ring-[#c8c9d4] opacity-60'
                            : 'bg-white ring-[#101223]'
                        )}
                      >
                        <span className={classNames(
                          'w-9 h-9 shrink-0 rounded-full flex items-center justify-center ring-2',
                          embarcado ? 'bg-white ring-white' : 'ring-[#c8c9d4]'
                        )}>
                          {embarcado && <Check size={22} className="text-verde-600" strokeWidth={3.5} />}
                        </span>

                        <span className="flex-1 min-w-0">
                          <span className={classNames(
                            'block text-[18px] font-bold truncate',
                            embarcado ? 'text-white' : 'text-[#101223]'
                          )}>
                            {f.nombre}
                          </span>
                          {(f.documento || f.categoria) && (
                            <span className={classNames(
                              'block text-[15px] tabular truncate',
                              embarcado ? 'text-white/85' : 'text-[#3a3d52]'
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
                          <span className="shrink-0 text-[15px] font-bold text-[#3a3d52]">No llegó</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        {walkIns.length > 0 && (
          <section>
            <h2 className="text-[18px] font-bold text-[#101223] mb-2">
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
          <p className="text-[18px] text-[#3a3d52] py-8 text-center">
            {busqueda ? 'Nadie coincide con esa búsqueda.' : 'Esta lancha no tiene gente asignada.'}
          </p>
        )}
      </main>

      {/* Acciones fijas abajo */}
      {!cerrado && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-[#f4f4f0] border-t-2 border-[#d8d8d2] px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex gap-3">
          <button
            onClick={() => setWalkInAbierto(true)}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white ring-2 ring-[#101223] text-[#101223] text-[17px] font-bold min-h-[64px]"
          >
            <UserPlus size={22} />
            Sin reserva
          </button>
          <button
            onClick={cerrarZarpe}
            disabled={cerrando}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 text-white text-[17px] font-bold min-h-[64px] disabled:opacity-50"
          >
            <Anchor size={22} />
            {cerrando ? 'Cerrando…' : 'Cerrar el zarpe'}
          </button>
        </div>
      )}

      {walkInAbierto && (
        <FormularioWalkIn
          onCerrar={() => setWalkInAbierto(false)}
          onGuardar={async datos => {
            const { error } = await registrarEvento(null, 'walk_in', datos)
            setWalkInAbierto(false)
            if (error) toast.error('No se pudo registrar. ' + error.message)
            else toast.success(`${datos.nombre} embarcado`)
          }}
        />
      )}
    </div>
  )
}
