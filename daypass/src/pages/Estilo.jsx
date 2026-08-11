import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Anchor, Palmtree, Building2 } from 'lucide-react'
import { usePerfil } from '../hooks/usePerfil'
import { classNames, formatCurrency } from '../lib/utils'
import { coloresPorFamilia } from '../lib/tokens'
import { MODOS, useModo } from '../lib/modo'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Card from '../components/ui/Card'
import {
  BloqueDato, InsigniaEstado, TarjetaPendiente, EstadoVacio, FiltroBarra,
  ContadorVivo, LineaDeTiempo, Esqueleto, EstadoError, DondeSeUsa,
} from '../components/patrones'

/**
 * `/estilo`: el sistema entero en una página.
 *
 * ── Para qué sirve, exactamente ─────────────────────────────────────────────
 *
 * No cambia cómo se ve nada. Sirve para **una** pregunta, la que aparece al
 * construir una pantalla nueva: *«¿esto ya existe, y cómo se llama?»*. Sin un
 * sitio donde mirar, la respuesta es inventarlo — y así fue como Config e
 * Informes acumularon juntas 99 clases `gray-*` y 20 colores escritos a mano.
 *
 * ── Los tokens se leen, no se copian ────────────────────────────────────────
 *
 * La lista de colores sale del CSS en vivo. Una guía con los colores copiados
 * a mano envejece —alguien agrega uno, nadie lo agrega aquí— y una guía que
 * miente es peor que ninguna: la gente deja de creerle y vuelve a inventar.
 *
 * ── Y se puede ver en los tres modos ────────────────────────────────────────
 *
 * El selector de arriba cambia el modo del aparato de verdad, no una
 * simulación: es el mismo `data-modo` que usa el iPad del muelle. Así se ve si
 * algo se rompe a 20 px **antes** de que se rompa en la isla.
 *
 * ── Solo super_admin ────────────────────────────────────────────────────────
 *
 * Es una herramienta de quien mantiene el sistema, no de quien lo usa. A
 * Daniela una página de muestrarios solo le ocuparía sitio en el menú.
 */
export default function Estilo() {
  const { rol, cargando } = usePerfil()
  const modo = useModo()
  const [familias, setFamilias] = useState([])

  // Los tokens se leen después de montar: en el primer render las hojas de
  // estilo pueden no estar listas todavía.
  useEffect(() => { setFamilias(coloresPorFamilia()) }, [])

  if (cargando) return <div className="max-w-4xl mx-auto px-4 py-6"><Esqueleto filas={4} /></div>
  if (rol !== 'super_admin') return <Navigate to="/" replace />

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-8">
      <PageHeader
        title="El sistema"
        subtitle="Los tokens, los primitivos y los patrones. Antes de inventar algo, mirar si ya está aquí."
      />

      <CambiarModo actual={modo} />

      <Seccion
        titulo="Color"
        porque="Leído del CSS en vivo: si un token existe, aparece aquí. Una guía copiada a mano miente a los tres meses. La paleta de fábrica de Tailwind no se muestra: no es de este sistema, y enseñarla sería invitar a usarla."
      >
        {familias.length === 0 ? (
          <p className="text-[0.9375rem] text-tinta-2">
            No se pudieron leer los tokens del CSS. Es raro y vale la pena mirarlo: significa que
            esta página no puede describir el sistema.
          </p>
        ) : familias.map(f => (
          <div key={f.prefijo} className="mb-5">
            <h3 className="text-[0.9375rem] font-bold text-tinta">{f.nombre}</h3>
            {f.porque && <p className="text-[0.8125rem] text-tinta-2 mb-2">{f.porque}</p>}
            <div className="flex flex-wrap gap-2">
              {f.colores.map(c => (
                <div key={c.nombre} className="w-[7.5rem]">
                  <div
                    className="h-10 rounded-lg ring-1 ring-black/5"
                    style={{ background: `var(${c.nombre})` }}
                  />
                  <p className="text-[0.6875rem] text-tinta-2 mt-1 truncate" title={c.nombre}>
                    {c.nombre.replace('--color-', '')}
                  </p>
                  <p className="text-[0.6875rem] text-tinta-3 tabular">{c.valor}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Tipografía" porque="Manrope, auto-alojada: el muelle y la isla arrancan sin señal.">
        <div className="flex flex-col gap-2">
          {[
            ['2.125rem', 'El número del muelle'],
            ['1.5rem', 'Título de pantalla'],
            ['1.25rem', 'Título de tarjeta'],
            ['1.125rem', 'Cuerpo de afuera'],
            ['1rem', 'Cuerpo de oficina'],
            ['0.9375rem', 'Secundario'],
            ['0.8125rem', 'Nota al pie'],
          ].map(([tam, que]) => (
            <div key={tam} className="flex items-baseline gap-4 border-b border-linea pb-1.5">
              <span className="text-[0.6875rem] tabular text-tinta-3 w-20 shrink-0">{tam}</span>
              <span style={{ fontSize: tam }} className="font-bold text-tinta truncate">{que}</span>
            </div>
          ))}
        </div>
        <p className="text-[0.8125rem] text-tinta-2 mt-3">
          Todo en <b>rem</b>: es lo que hace que el modo del aparato mueva la pantalla entera.
          Un tamaño en píxeles es un tamaño que el modo no puede tocar.
        </p>
      </Seccion>

      <Seccion titulo="Movimiento" porque="Cuatro animaciones, cada una con su trabajo. Sin librería: son 60 líneas de CSS.">
        <Animaciones />
      </Seccion>

      <Seccion titulo="Primitivos" porque="Los ladrillos. Ninguna pantalla debería usar un <select> ni un <input> del navegador.">
        <div className="flex flex-wrap items-end gap-3">
          <Button>Guardar</Button>
          <Button variant="secondary">Segundo</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger">Eliminar</Button>
          <Button loading>Guardando</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Input label="Un campo" placeholder="Escribe algo" />
          <Input label="Con error" error="Falta el nombre" />
          <Select
            label="Un desplegable"
            value=""
            onChange={() => {}}
            options={[{ value: 'a', label: 'Una opción' }, { value: 'b', label: 'Otra' }]}
          />
          <Select
            label="De afuera (sol)"
            size="sol"
            value=""
            onChange={() => {}}
            options={[{ value: 'a', label: 'Una opción' }]}
          />
        </div>
      </Seccion>

      <Seccion titulo="Patrones" porque="Páginas a medio armar. Si algo se parece a uno de estos, es ese y no uno nuevo.">
        <Muestra nombre="InsigniaEstado" que="Un estado, siempre con la misma palabra y el mismo color.">
          <div className="flex flex-wrap gap-2">
            {['tentativa', 'confirmada', 'en_isla', 'completada', 'noshow', 'cancelada'].map(e => (
              <InsigniaEstado key={e} estado={e} />
            ))}
          </div>
        </Muestra>

        <Muestra nombre="BloqueDato" que="Un número con su etiqueta y su comparación. `lg` para lo que se lee de lejos.">
          <div className="flex flex-wrap gap-8">
            <BloqueDato etiqueta="Hoy" valor={92} unidad="personas"
              comparacion={{ texto: 'que un día normal', delta: 63 }} />
            <BloqueDato etiqueta="Cartera" valor={formatCurrency(4_200_000)} tono="pendiente" />
            <BloqueDato etiqueta="Meta" valor="108%" tono="cerrado" tamano="lg" />
          </div>
        </Muestra>

        <Muestra nombre="ContadorVivo" que="El número que cambia solo. Nunca se mueve de sitio; el dígito hace tic.">
          <div className="flex flex-wrap items-center gap-6">
            <ContadorVivo valor={34} etiqueta="en la isla" edad="hace 12 min" />
            <div className="bg-brand-900 rounded-xl px-3 py-2">
              <ContadorVivo valor={34} etiqueta="en la isla" tamano="oscuro" />
            </div>
          </div>
        </Muestra>

        <Muestra nombre="TarjetaPendiente" que="Qué falta, por qué importa y el botón que lo resuelve.">
          <ul className="flex flex-col gap-2">
            <TarjetaPendiente pendiente={{
              texto: 'Boda Herrera: faltan los 28 nombres',
              porque: 'La Capitanía pide nombre y documento de cada persona antes de zarpar.',
              accion: { etiqueta: 'Agregar los nombres', a: '/estilo' },
            }} />
            <TarjetaPendiente pendiente={{
              tono: 'tardio',
              texto: 'Una reserva cambió después del cierre',
              detalle: 'La cocina y la isla ya trabajaron con la versión anterior.',
            }} />
          </ul>
        </Muestra>

        <Muestra nombre="FiltroBarra" que="Filtros como fichas: se ve qué está filtrado sin abrir nada.">
          <FiltroBarra
            grupos={[{
              id: 'demo', etiqueta: 'Qué', valor: 'tarifas',
              opciones: [
                { valor: 'tarifas', etiqueta: 'Tarifas' },
                { valor: 'cierres', etiqueta: 'Cierres' },
              ],
              onCambiar: () => {},
            }]}
            onLimpiar={() => {}}
          />
        </Muestra>

        <Muestra nombre="LineaDeTiempo" que="La historia de algo. Lo reciente arriba; solo se destaca lo que alguien hizo a mano.">
          <LineaDeTiempo
            agruparPor="dia"
            desdeCuandoHayFirma="2026-08-10"
            eventos={[
              { cuando: '2026-08-11T14:05:00Z', texto: 'Cambió la tarifa de Rack Gold', quien: 'Andrés Villamizar', destacado: true },
              { cuando: '2026-08-11T13:12:00Z', texto: 'Cerró el zarpe', quien: 'Daniela Restrepo' },
            ]}
          />
        </Muestra>

        <Muestra nombre="DondeSeUsa" que="Lo que hay que saber antes de desactivar algo.">
          <div className="max-w-xs">
            <DondeSeUsa lineas={[
              { etiqueta: 'Reservas en total', valor: 37 },
              { etiqueta: 'De hoy en adelante', valor: 4 },
            ]} />
          </div>
        </Muestra>

        <Muestra nombre="EstadoVacio" que="Un vacío es una invitación a hacer algo, no un error.">
          <EstadoVacio
            titulo="Todavía no hay nada"
            detalle="Cuando alguien haga la primera, aparece aquí."
            accion={{ etiqueta: 'Crear la primera', a: '/estilo' }}
          />
        </Muestra>

        <Muestra nombre="Esqueleto y EstadoError" que="Los dos estados que toda pantalla con datos tiene que traer.">
          <Esqueleto filas={2} />
          <div className="mt-3">
            <EstadoError error="No se pudo cargar" onReintentar={() => {}} />
          </div>
        </Muestra>
      </Seccion>
    </div>
  )
}

// ─── Piezas de la página ──────────────────────────────────────────────────────

const ICONO_MODO = { oficina: Building2, muelle: Anchor, isla: Palmtree }

/**
 * Cambia el modo de verdad, no una simulación.
 *
 * Es el mismo `data-modo` que usa el iPad del muelle, así que lo que se vea
 * aquí a 20 px es exactamente lo que se va a ver en la isla. Simularlo con un
 * `transform: scale` habría mentido justo en lo que importa: cómo se reparte
 * el texto cuando crece.
 */
function CambiarModo({ actual }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[0.8125rem] font-bold uppercase tracking-wide text-tinta-2">
        Ver como
      </span>
      {Object.values(MODOS).map(m => {
        const Icono = ICONO_MODO[m.id]
        const puesto = actual.id === m.id
        return (
          <button
            key={m.id}
            onClick={() => actual.cambiar(m.id)}
            aria-pressed={puesto}
            className={classNames(
              'inline-flex items-center gap-1.5 rounded-xl px-3 min-h-[2.75rem] text-[0.9375rem] font-bold transition-colors',
              puesto ? 'bg-blue-600 text-white' : 'bg-white text-tinta-2 ring-1 ring-linea hover:bg-blue-50'
            )}
          >
            <Icono size={15} />
            {m.nombre}
            <span className="opacity-70">{m.base}px</span>
          </button>
        )
      })}
    </div>
  )
}

function Seccion({ titulo, porque, children }) {
  return (
    <section>
      <h2 className="text-[1.25rem] font-bold text-tinta">{titulo}</h2>
      <p className="text-[0.9375rem] text-tinta-2 mb-4">{porque}</p>
      <Card className="p-5">{children}</Card>
    </section>
  )
}

function Muestra({ nombre, que, children }) {
  return (
    <div className="py-4 border-b border-linea last:border-0">
      <p className="text-[0.9375rem] font-bold text-tinta">{nombre}</p>
      <p className="text-[0.8125rem] text-tinta-2 mb-3">{que}</p>
      {children}
    </div>
  )
}

/** Las cuatro, cada una disparada a mano: una animación se juzga viéndola. */
function Animaciones() {
  const [clave, setClave] = useState(0)
  const cuales = [
    ['destello', 'Algo acaba de llegar por Realtime', '800ms'],
    ['tic-entra', 'El dígito nuevo entra', '140ms'],
    ['eco', 'El dedo llegó, en el muelle', '300ms'],
    ['aparecer', 'Entra una tarjeta o un modal', '160ms'],
    ['entra-de-lado', 'El panel lateral', '180ms'],
  ]

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {cuales.map(([nombre, que, ms]) => (
          <div key={nombre} className="w-40">
            <div
              key={`${nombre}-${clave}`}
              className={classNames('h-14 rounded-xl bg-white ring-1 ring-linea flex items-center justify-center text-[0.8125rem] font-bold text-tinta', nombre)}
            >
              {nombre}
            </div>
            <p className="text-[0.6875rem] text-tinta-2 mt-1">{que}</p>
            <p className="text-[0.6875rem] text-tinta-3 tabular">{ms}</p>
          </div>
        ))}
      </div>
      <Button variant="secondary" className="mt-4" onClick={() => setClave(k => k + 1)}>
        Volver a lanzarlas
      </Button>
      <p className="text-[0.8125rem] text-tinta-2 mt-2">
        Con <code className="font-bold">prefers-reduced-motion</code> no se mueve ninguna. Lo que
        no se apaga es la información: los avisos que dependen de un cambio de color usan clases
        de estado, no keyframes.
      </p>
    </div>
  )
}
