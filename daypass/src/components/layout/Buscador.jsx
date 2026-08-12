import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, CalendarDays, Building2, Ship, HardHat, CornerDownLeft } from 'lucide-react'
import { classNames } from '../../lib/utils'
import { buscarTodo, aplanar, MINIMO, RESPIRO } from '../../lib/busqueda'

/**
 * El buscador global.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * El menú se redujo a siete sustantivos. Eso solo funciona si lo que no está
 * en el menú se alcanza escribiendo: nadie navega hasta una señora que llamó,
 * la busca. Escribir es más corto que recordar dónde está guardada una cosa.
 *
 * ── Dónde no aparece ────────────────────────────────────────────────────────
 *
 * En el muelle y en la isla, no. Esas pantallas tienen su propia búsqueda por
 * nombre sobre la copia local, que funciona sin señal; meterles una barra
 * global sería devolverles el marco de oficina que se les quitó a propósito.
 * Por eso se monta en `Navbar` y no en `NavegacionMinima`.
 *
 * ── Cuatro decisiones ───────────────────────────────────────────────────────
 *
 * **Arriba, no en el centro.** Una ventana centrada tapa lo que estabas
 * mirando. Esta baja del encabezado, que es de donde vendría si fuera un
 * cajón: el contexto sigue detrás y a la vista.
 *
 * **Un solo cursor recorre todos los grupos.** Las flechas no saltan de grupo
 * en grupo ni obligan a tabular: la lista es una sola aunque se vea partida.
 * Enter abre lo que esté marcado, que al empezar es el primer resultado — así
 * escribir tres letras y darle Enter es un camino completo.
 *
 * **Los resultados no reemplazan la pantalla**: la tapan y se van. Buscar y
 * arrepentirse no debería costar una navegación.
 *
 * **Cada resultado dice de qué es**, con su icono y su línea de detalle: una
 * lista de nombres sueltos obliga a adivinar cuál de los tres Juan Pérez es.
 */

const ICONOS = {
  persona: User,
  reserva: CalendarDays,
  organizacion: Building2,
  lancha: Ship,
  empleado: HardHat,
}

export default function Buscador() {
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [grupos, setGrupos] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [marcado, setMarcado] = useState(0)
  const campoRef = useRef(null)
  // Cada búsqueda lleva número: si la de «ana» vuelve después de la de «anab»,
  // se descarta. Sin esto, escribir rápido deja en pantalla el resultado de
  // una consulta vieja.
  const turno = useRef(0)

  const cerrar = useCallback(() => {
    setAbierto(false)
    setTexto('')
    setGrupos([])
    setMarcado(0)
  }, [])

  // Ctrl+K en computador. En táctil no hay atajo que recordar: está el botón.
  useEffect(() => {
    function alTeclado(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAbierto(a => !a)
      }
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [])

  useEffect(() => {
    if (abierto) campoRef.current?.focus()
  }, [abierto])

  useEffect(() => {
    const limpio = texto.trim()
    if (limpio.length < MINIMO) {
      setGrupos([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    const mio = ++turno.current
    const t = setTimeout(async () => {
      const encontrados = await buscarTodo(limpio)
      if (mio !== turno.current) return
      setGrupos(encontrados)
      setMarcado(0)
      setBuscando(false)
    }, RESPIRO)
    return () => clearTimeout(t)
  }, [texto])

  const planos = aplanar(grupos)

  function abrir(item) {
    cerrar()
    navigate(item.a)
  }

  function alTeclear(e) {
    if (e.key === 'Escape') { cerrar(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMarcado(i => Math.min(i + 1, planos.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMarcado(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && planos[marcado]) {
      e.preventDefault()
      abrir(planos[marcado])
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        aria-label="Buscar"
        /* 44px y no 36: es la otra mitad de la navegación desde que el menú se
           redujo a siete sustantivos, y en la tablet de oficina un objetivo
           por debajo del mínimo del propio sistema convierte la forma
           principal de moverse en la más difícil de tocar. */
        className="flex items-center gap-2 min-h-[44px] px-3.5 rounded-xl bg-white/10 text-white/80
                   hover:bg-white/20 hover:text-white transition-colors"
      >
        <Search size={16} />
        <span className="hidden lg:inline text-[14px]">Buscar</span>
        <kbd className="hidden lg:inline text-[11px] font-bold px-1.5 py-0.5 rounded bg-white/15">
          Ctrl K
        </kbd>
      </button>
    )
  }

  const limpio = texto.trim()
  let indice = -1

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-tinta/40"
        onClick={cerrar}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        // 120px: ocho por debajo del encabezado más alto que puede haber
        // —barra de «ver la app como» de 48 más la de 64—. En porcentaje de
        // alto se le montaba encima en las pantallas bajas, que son justo los
        // portátiles de la oficina.
        className="fixed z-50 left-1/2 -translate-x-1/2 top-[7.5rem] w-[calc(100%-1.5rem)] max-w-2xl
                   bg-white rounded-2xl shadow-[0_24px_60px_rgba(22,24,44,.28)] overflow-hidden aparecer"
      >
        <div className="flex items-center gap-3 px-4 border-b border-linea">
          <Search size={18} className="shrink-0 text-tinta-3" />
          <input
            ref={campoRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={alTeclear}
            placeholder="Un nombre, un documento, un folio"
            className="w-full bg-transparent py-4 text-[17px] text-tinta placeholder-tinta-3"
          />
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain">
          {limpio.length < MINIMO ? (
            <p className="px-4 py-5 text-[15px] text-tinta-2">
              Escribe al menos {MINIMO} letras. Busca personas, reservas, agencias, lanchas y
              empleados.
            </p>
          ) : buscando && !grupos.length ? (
            <p className="px-4 py-5 text-[15px] text-tinta-2">Buscando…</p>
          ) : !grupos.length ? (
            <p className="px-4 py-5 text-[15px] text-tinta-2">
              Nada con «{limpio}». Prueba con el apellido, o con el documento sin puntos.
            </p>
          ) : (
            grupos.map(g => (
              <section key={g.clave} className="py-1.5">
                <h2 className="px-4 py-1 text-[12px] font-bold uppercase tracking-wider text-tinta-2">
                  {g.etiqueta}
                </h2>
                <ul>
                  {g.items.map(item => {
                    indice += 1
                    const esteIndice = indice
                    const activo = esteIndice === marcado
                    const Icono = ICONOS[item.tipo] || Search
                    return (
                      <li key={`${item.tipo}-${item.id}`}>
                        <button
                          onClick={() => abrir(item)}
                          onMouseEnter={() => setMarcado(esteIndice)}
                          className={classNames(
                            'w-full flex items-center gap-3 px-4 py-2.5 min-h-[52px] text-left transition-colors',
                            activo ? 'bg-blue-50' : 'hover:bg-blue-50/50'
                          )}
                        >
                          <Icono size={17} className="shrink-0 text-tinta-2" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-bold text-tinta truncate">
                              {item.titulo}
                            </span>
                            {item.detalle && (
                              <span className="block text-[13px] text-tinta-2 truncate">
                                {item.detalle}
                              </span>
                            )}
                          </span>
                          {activo && (
                            <CornerDownLeft size={15} className="shrink-0 text-blue-600" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  )
}
