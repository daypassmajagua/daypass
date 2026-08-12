import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import {
  Ship, Building2, Tag, CalendarDays, Mail, History, Palette,
  Settings, UserCog, LifeBuoy, ChevronRight,
} from 'lucide-react'
import { usePerfil } from '../hooks/usePerfil'
import { seccionesDe } from '../lib/navegacion'
import { classNames } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import { Esqueleto, TarjetaPendiente } from '../components/patrones'
import { loQueFalta } from '../lib/listoParaOperar'
import Config from './Config'

/**
 * Configuración: el sitio de lo ocasional.
 *
 * No es una pantalla, es un contenedor. El menú de arriba lleva los siete
 * sustantivos del negocio —lo que se toca todos los días— y todo lo demás vive
 * aquí, en secciones con nombre propio.
 *
 * **Cada sección dice para qué sirve.** Una lista de siete nombres sueltos se
 * lee tan mal como un menú de dieciséis: «Temporadas» no significa nada hasta
 * que dice *qué fechas son de temporada alta*.
 *
 * Y el orden no es alfabético ni caprichoso: **lo primero es lo de la
 * coordinadora**. Lanchas, pilotos y empleados están aquí porque se tocan de
 * vez en cuando, no porque sean de otro (regla 21). Estar guardado no es estar
 * restringido.
 */

const ICONOS = { Ship, Building2, Tag, CalendarDays, Mail, History, Palette, Settings, UserCog, LifeBuoy }

/**
 * Qué catálogos trae cada sección, y con qué encabezado.
 *
 * `claves` son claves de `CATALOGOS` en `Config.jsx`, **no nombres de tabla**:
 * la de agencias se llama `agencias` aunque escriba en `organizaciones` desde
 * la migración 020. Confundirlas deja la pantalla en blanco.
 */
const CONTENIDO = {
  agencias: {
    claves: ['agencias'],
    titulo: 'Agencias y organizaciones',
    subtitulo: 'Con quién trata el hotel. Se desactivan, nunca se borran: el histórico las referencia.',
  },
  planes: {
    claves: ['planes'],
    titulo: 'Planes, platos y tarifas',
    subtitulo: 'Lo que se vende y a qué precio. Cambiar una tarifa no reescribe lo ya vendido.',
  },
  temporadas: {
    claves: ['temporadas'],
    titulo: 'Temporadas',
    subtitulo: 'Qué fechas son de temporada alta. De aquí sale el precio que se congela en cada reserva.',
  },
  operacion: {
    claves: ['canales', 'paises'],
    titulo: 'Ajustes de la operación',
    subtitulo: 'Las horas, el modo de este aparato, y los dos catálogos sin los que no se puede vender.',
    conAjustes: true,
  },
}

export default function Configuracion() {
  const { seccion } = useParams()
  const { rol, cargando } = usePerfil()
  const secciones = seccionesDe(rol)

  // **Se espera al perfil antes de decidir.** Sin esto, el primer render llega
  // con el rol en null, `seccionesDe` devuelve vacío y la pantalla se redirige
  // sola a Hoy antes de que el perfil alcance a cargar — que fue exactamente
  // lo que pasó la primera vez que se probó.
  if (cargando) {
    return <div className="marco py-6"><Esqueleto filas={4} /></div>
  }

  // Sin secciones no hay engranaje: no debería haber llegado hasta aquí, pero
  // si llegó por la barra de direcciones, se devuelve sin regañar.
  if (!secciones.length) return <Navigate to="/" replace />

  if (seccion) {
    const puede = secciones.some(s => s.ruta === `/config/${seccion}`)
    const contenido = CONTENIDO[seccion]
    if (!puede || !contenido) return <Navigate to="/config" replace />

    return (
      <div>
        <div className="marco pt-4">
          <Link
            to="/config"
            className="inline-flex items-center gap-1 text-[14px] font-bold text-tinta-2 hover:text-blue-700 min-h-[44px]"
          >
            <ChevronRight size={15} className="rotate-180" />
            Configuración
          </Link>
        </div>
        <Config
          soloClaves={contenido.claves}
          titulo={contenido.titulo}
          subtitulo={contenido.subtitulo}
          conAjustes={Boolean(contenido.conAjustes)}
        />
      </div>
    )
  }

  return (
    <div className="marco py-6">
      <PageHeader
        title="Configuración"
        subtitle="Lo que se cambia de vez en cuando. Lo de todos los días está arriba."
      />

      <AntesDeOperar />

      <div className="flex flex-col gap-2">
        {secciones.map(s => {
          const Icono = ICONOS[s.icono] || Settings
          return (
            <Link
              key={s.id}
              to={s.ruta}
              className={classNames(
                'group flex items-center gap-4 bg-white rounded-2xl px-4 py-4',
                'ring-1 ring-transparent hover:ring-linea transition-colors',
                'shadow-[0_1px_2px_rgba(22,24,44,.05)]'
              )}
            >
              <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Icono size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-tinta">{s.etiqueta}</span>
                <span className="block text-[14px] text-tinta-2">{s.porque}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-tinta-3 group-hover:text-tinta-2" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Lo que falta para poder operar, si es que falta algo.
 *
 * ── Por qué está aquí y no en un documento ──────────────────────────────────
 *
 * «Cargar los catálogos reales» era un pendiente que vivía en la cabeza del
 * dueño. Eso funciona una vez y falla el día que se monte otro entorno o que
 * alguien desactive la última lancha sin darse cuenta.
 *
 * **El silencio es el estado sano**: cuando todo está cargado, este bloque no
 * existe. Aparece solo cuando hay algo que hacer, y dice qué se rompe si no se
 * hace — no «falta configurar temporadas», sino que sin ellas el precio se
 * congela mal.
 */
function AntesDeOperar() {
  const [falta, setFalta] = useState(null)

  useEffect(() => {
    let vigente = true
    loQueFalta().then(r => { if (vigente) setFalta(r) })
    return () => { vigente = false }
  }, [])

  if (!falta?.length) return null

  const detieneLaReserva = falta.some(f => f.detiene === 'la reserva')

  return (
    <section className="mb-6">
      <h2 className="text-[12px] font-bold uppercase tracking-[.12em] text-tinta-2 mb-2">
        Antes de operar
      </h2>
      <p className="text-[15px] text-tinta-2 mb-3">
        {detieneLaReserva
          ? 'Todavía no se puede crear una reserva. Esto es lo que falta:'
          : 'Se puede reservar, pero hay cosas que van a fallar más adelante:'}
      </p>
      <ul className="flex flex-col gap-2">
        {falta.map(f => (
          <TarjetaPendiente
            key={f.id}
            pendiente={{
              // Coral solo para lo que detiene una reserva: si todo se pinta
              // igual, la temporada que falta pesa lo mismo que el piloto.
              tono: f.detiene === 'la reserva' ? 'tardio' : 'pendiente',
              texto: f.texto,
              detalle: f.detalle,
              accion: f.accion,
            }}
          />
        ))}
      </ul>
    </section>
  )
}
