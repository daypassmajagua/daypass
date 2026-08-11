import { Link } from 'react-router-dom'
import { Phone, Mail, MessageCircle } from 'lucide-react'
import { formatCurrency, formatDateShort, hace, classNames } from '../../lib/utils'
import { LineaDeTiempo } from '../patrones'

/**
 * Quién es esta persona, en el orden en que se necesita saberlo.
 *
 * ── La pregunta que trae a alguien aquí ─────────────────────────────────────
 *
 * Casi siempre es la misma y suena por teléfono: *«esta señora que está
 * llamando, ¿ya vino?»*. Todo lo demás —el correo, las etiquetas, el plan que
 * suele pedir— es contexto para el tono de esa llamada. Por eso el orden:
 *
 *   1. El nombre y cómo confirmar que es la misma  → el documento
 *   2. Cómo hablarle ya                            → teléfono y correo, tocables
 *   3. Si es de casa o es nueva                    → visitas y cuánto hace
 *   4. Con qué suele venir                         → plan, etiquetas, agencias
 *   5. Cuándo vino, con detalle                    → la línea de tiempo
 *
 * ── «Hace cuatro meses» antes que «14 de abril» ─────────────────────────────
 *
 * Arriba el tiempo va relativo, porque es lo que se dice en voz alta y no
 * obliga a restar mentalmente mientras alguien espera al otro lado. La fecha
 * exacta no desaparece: vive en la línea de tiempo, que es donde sí se
 * necesita precisa.
 *
 * ── Dos clases de etiqueta, dos colores ─────────────────────────────────────
 *
 * Las **calculadas** las pone el sistema —«frecuente», «de agencia»— y las
 * **puestas** las pone una persona. Se ven distintas porque discutir con una
 * y con la otra no es lo mismo: una se corrige cambiando el dato, la otra
 * quitándola.
 */
export default function FichaPersona({ ficha }) {
  const p = ficha.persona || {}
  const calculadas = ficha.etiquetas_calculadas || []
  const puestas = ficha.etiquetas_puestas || []
  const historial = ficha.historial || []
  const wa = (p.telefono || '').replace(/\D/g, '')

  return (
    <div className="flex flex-col gap-5">
      {/* 1 · Cómo hablarle. Va primero porque es lo único de aquí que se hace,
          y no solo se lee. En el iPad `tel:` marca de verdad. */}
      {(p.telefono || p.email) && (
        <div className="flex flex-col gap-1.5">
          {p.telefono && (
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`tel:${p.telefono}`}
                className="inline-flex items-center gap-2 min-h-[44px] text-[16px] font-bold text-blue-700 hover:underline">
                <Phone size={16} /> {p.telefono}
              </a>
              {wa.length >= 10 && (
                <a href={`https://wa.me/${wa.length === 10 ? '57' + wa : wa}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-verde-50 text-verde-700 text-[14px] font-bold hover:bg-verde-100">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
            </div>
          )}
          {p.email && (
            <a href={`mailto:${p.email}`}
              className="inline-flex items-center gap-2 min-h-[44px] text-[15px] text-blue-700 hover:underline break-all">
              <Mail size={15} /> {p.email}
            </a>
          )}
        </div>
      )}

      {/* 2 · Si es de casa o es nueva. Cuatro números y ni uno más: cada uno
          cambia lo que se le dice. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-fondo rounded-2xl px-4 py-3.5">
        <Dato etiqueta="Visitas" valor={ficha.visitas ?? 0} />
        <Dato etiqueta="Última" valor={hace(ficha.ultima) || '—'} chico />
        <Dato etiqueta="Primera" valor={ficha.primera ? formatDateShort(ficha.primera) : '—'} chico />
        {/* En null cuando quien mira no puede ver plata: lo decide el
            servidor, no esta pantalla. */}
        {ficha.gastado != null && (
          <Dato etiqueta="Ha dejado" valor={formatCurrency(ficha.gastado)} chico />
        )}
      </div>

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

      {(ficha.plan_usual || (ficha.organizaciones || []).length > 0) && (
        <div className="flex flex-col gap-1 text-[15px] text-tinta-2">
          {ficha.plan_usual && (
            <p>Suele venir en <b className="text-tinta">{ficha.plan_usual}</b>.</p>
          )}
          {(ficha.organizaciones || []).length > 0 && (
            <p>{ficha.organizaciones.map(o => `${o.nombre} (${String(o.tipo).replace(/_/g, ' ')})`).join(' · ')}</p>
          )}
        </div>
      )}

      {p.notas && (
        <p className="text-[15px] text-tinta bg-aviso-50 rounded-xl px-3.5 py-2.5">{p.notas}</p>
      )}

      {/* 5 · Cuándo vino. Antes era una lista plana de doce y un «y N más» que
          no llevaba a ninguna parte. Ahora se agrupa por año y cada visita
          enlaza a su reserva: la historia de alguien se lee como historia. */}
      <section>
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-tinta-2 mb-2">
          Cuándo vino
        </h3>
        <LineaDeTiempo
          agruparPor="anio"
          eventos={historial.map(v => ({
            cuando: v.fecha,
            texto: (
              <Link to={`/editar/${v.registro_id}`} className="hover:text-blue-700">
                {v.plan || 'Pasadía'}
                {!v.titular && <span className="text-tinta-2 font-normal"> · con la reserva de otro</span>}
              </Link>
            ),
            quien: null,
          }))}
          vacio={{
            titulo: 'Todavía no ha venido',
            detalle: 'Aparece aquí en cuanto embarque por primera vez.',
          }}
        />
      </section>
    </div>
  )
}

function Dato({ etiqueta, valor, chico = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-2">{etiqueta}</p>
      <p className={classNames(
        'font-bold text-tinta tabular truncate',
        chico ? 'text-[15px]' : 'text-[22px] leading-tight'
      )}>
        {valor}
      </p>
    </div>
  )
}
