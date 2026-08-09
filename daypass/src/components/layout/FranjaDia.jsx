import { Wifi } from 'lucide-react'
import { classNames, formatDate } from '../../lib/utils'
import { ESTADO_DIA_LABELS, PUNTO_LABELS, useDiaOperativo } from '../../hooks/useDiaOperativo'
import useAppStore from '../../store/useAppStore'

/**
 * La franja del día: el latido del sistema.
 *
 * Está siempre presente y siempre dice en qué momento del ciclo está el día.
 * Es la respuesta permanente a "¿en qué fecha estoy y qué se puede hacer?",
 * para que ningún estado quede ambiguo.
 */

const APARIENCIA = {
  planeando:         { fondo: 'bg-blue-50',   texto: 'text-blue-700',   punto: 'bg-blue-600',   vivo: false },
  tentativo_cerrado: { fondo: 'bg-verde-50',  texto: 'text-verde-600',  punto: 'bg-verde-500',  vivo: false },
  en_operacion:      { fondo: 'bg-brand-900', texto: 'text-white',      punto: 'bg-verde-vivo',  vivo: true  },
  cerrado:           { fondo: 'bg-linea', texto: 'text-tinta-2',    punto: 'bg-tinta-3',  vivo: false },
}

function horaCorta(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function FranjaDia() {
  const fechaActiva = useAppStore(s => s.fechaActiva)
  const puntos = useAppStore(s => s.puntosEnLinea)
  const { dia, estado } = useDiaOperativo(fechaActiva)

  const look = APARIENCIA[estado] || APARIENCIA.planeando
  const cerradoA = horaCorta(dia?.cerrado_tentativo_at)

  return (
    <div className={classNames(
      'flex items-center gap-2.5 flex-wrap px-4 py-2.5 rounded-2xl mb-5',
      look.fondo, look.texto
    )}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {look.vivo && (
          <span className={classNames(
            'absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping',
            look.punto
          )} />
        )}
        <span className={classNames('relative inline-flex h-2.5 w-2.5 rounded-full', look.punto)} />
      </span>

      <span className="font-bold text-[15px] first-letter:uppercase">
        {formatDate(fechaActiva)}
      </span>

      <span className="opacity-40">·</span>

      <span className="font-bold text-[15px]">
        {ESTADO_DIA_LABELS[estado]}
      </span>

      {/* El sello: cuándo se cerró y quién lo cerró. */}
      {cerradoA && estado !== 'planeando' && (
        <span className="text-[13px] opacity-75 tabular">
          a las {cerradoA}
          {dia?.cerrado_tentativo_por_nombre && ` por ${dia.cerrado_tentativo_por_nombre}`}
        </span>
      )}

      {/* Qué puntos están en línea ahora mismo. */}
      {puntos.length > 0 && (
        <span className="ml-auto flex items-center gap-1.5 text-[13px] opacity-75">
          <Wifi size={14} />
          {puntos.map(p => PUNTO_LABELS[p] || p).join(' · ')}
        </span>
      )}
    </div>
  )
}
