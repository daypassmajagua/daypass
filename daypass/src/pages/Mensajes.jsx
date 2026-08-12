import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Mail, MessageCircle, Plus, Trash2, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { classNames, formatDate, hoyLocal } from '../lib/utils'
import {
  MARCAS, PLANTILLA_RESPALDO, llenarPlantilla,
} from '../lib/enlaceReserva'
import { EstadoError, Esqueleto } from '../components/patrones'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'

/**
 * Destinatarios y mensajes: a quién le llega qué, y con qué palabras.
 *
 * ── Los mensajes ────────────────────────────────────────────────────────────
 *
 * Estaban escritos en `lib/enlaceReserva.js`, con el nombre del hotel y el del
 * muelle adentro. Cambiarle una coma al WhatsApp que se le manda a sesenta
 * clientes al mes era una tarea de programación y un despliegue — justo la
 * dependencia que este producto vino a quitar. Desde la 031 son ajustes.
 *
 * **Se editan con el resultado a la vista.** Una plantilla con marcas entre
 * llaves es código para quien la escribe por primera vez; al lado, el mensaje
 * ya armado con una reserva de ejemplo, no hay nada que imaginarse.
 *
 * ── Los destinatarios ───────────────────────────────────────────────────────
 *
 * `organizacion_correos` existe desde la 020 y no tenía pantalla. Se agrupan
 * **por propósito y no por organización**, porque la pregunta real es «¿a
 * dónde sale el manifiesto?» y no «¿qué correos tiene la Capitanía?». El
 * manifiesto va de primero: es el que exige la norma.
 */

const PROPOSITOS = [
  {
    codigo: 'manifiesto',
    etiqueta: 'Manifiesto',
    porque: 'La lista nominal que la Capitanía exige antes de zarpar. Sale del servidor, no del iPad.',
  },
  {
    codigo: 'facturacion',
    etiqueta: 'Facturación',
    porque: 'A dónde se le mandan las cuentas a una agencia.',
  },
  {
    codigo: 'general',
    etiqueta: 'General',
    porque: 'Todo lo demás.',
  },
]

const MENSAJES = [
  {
    clave: 'mensaje_invitacion',
    titulo: 'Al crear la reserva',
    porque: 'Lleva al check-in: los nombres, el almuerzo y la firma. Es el que más se manda.',
  },
  {
    clave: 'mensaje_pase',
    titulo: 'Después del cierre',
    porque: 'Ya no hay check-in que hacer. Lleva el pase para el muelle.',
  },
]

/** Con qué se arma la vista previa. No es una reserva real: es una de mentira. */
const EJEMPLO = {
  nombre: 'Familia Rodríguez Torres',
  fecha: formatDate(hoyLocal()),
  enlace: 'https://majagua.co/r/xxxxxxxx',
}

export default function Mensajes() {
  const [ajustes, setAjustes] = useState({})
  const [correos, setCorreos] = useState([])
  const [organizaciones, setOrganizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [a, c, o] = await Promise.all([
      supabase.from('ajustes').select('clave, valor'),
      supabase.from('organizacion_correos').select('*').order('correo'),
      supabase.from('organizaciones').select('id, nombre').order('nombre'),
    ])
    if (a.error) { setError(a.error.message); setCargando(false); return }
    setError(null)
    setAjustes(Object.fromEntries((a.data || []).map(x => [x.clave, x.valor])))
    setCorreos(c.data || [])
    setOrganizaciones(o.data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (cargando) {
    return <div className="max-w-3xl mx-auto px-4 py-6"><Esqueleto filas={5} /></div>
  }
  if (error) {
    return <div className="max-w-3xl mx-auto px-4 py-6"><EstadoError error={error} onReintentar={cargar} /></div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-5">
      <PageHeader
        title="Destinatarios y mensajes"
        subtitle="Lo que el cliente recibe y a dónde salen los correos del hotel. Se edita aquí, no en el código."
      />

      {MENSAJES.map(m => (
        <Plantilla
          key={m.clave}
          {...m}
          valor={ajustes[m.clave] ?? PLANTILLA_RESPALDO[m.clave] ?? ''}
          onGuardado={cargar}
        />
      ))}

      <Destinatarios
        correos={correos}
        organizaciones={organizaciones}
        onCambio={cargar}
      />
    </div>
  )
}

// ─── Un mensaje ───────────────────────────────────────────────────────────────

function Plantilla({ clave, titulo, porque, valor, onGuardado }) {
  const [texto, setTexto] = useState(valor)
  const [guardando, setGuardando] = useState(false)
  const cambiado = texto !== valor

  async function guardar() {
    if (!texto.trim()) { toast.error('Un mensaje vacío no se puede mandar.'); return }
    setGuardando(true)
    // `upsert` porque el ajuste puede no existir todavía: la 031 lo siembra,
    // pero una base que no la haya corrido tiene que poder guardar igual.
    const { error } = await supabase.from('ajustes')
      .upsert({ clave, valor: texto }, { onConflict: 'clave' })
    setGuardando(false)
    if (error) { toast.error('No se pudo guardar. ' + error.message); return }
    toast.success('Mensaje guardado')
    onGuardado()
  }

  const faltaEnlace = !texto.includes('{enlace}')

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <MessageCircle size={17} className="text-blue-700 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-tinta">{titulo}</h2>
          <p className="text-[13px] text-tinta-2">{porque}</p>
        </div>
      </div>

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={7}
        className="w-full rounded-xl border border-linea bg-white px-3 py-2.5 text-[15px] text-tinta
                   focus:outline-none focus:border-blue-600 resize-y"
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {MARCAS.map(m => (
          <span key={m.marca} className="text-[13px] text-tinta-2">
            <code className="font-bold text-tinta">{m.marca}</code> {m.que}
          </span>
        ))}
      </div>

      {faltaEnlace && (
        <p className="text-[14px] text-peligro-600 bg-peligro-50 rounded-xl px-3 py-2">
          Sin <code className="font-bold">{'{enlace}'}</code> el cliente no recibe su enlace: el
          mensaje llega y no lleva a ninguna parte.
        </p>
      )}

      {/* Con el resultado a la vista: una plantilla con llaves es código para
          quien la ve por primera vez. */}
      <div className="bg-fondo rounded-xl px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-tinta-2 mb-1.5">
          Así le llega
        </p>
        <p className="text-[15px] text-tinta whitespace-pre-wrap">
          {llenarPlantilla(texto, EJEMPLO)}
        </p>
      </div>

      {cambiado && (
        <div className="flex items-center gap-2 aparecer">
          <Button onClick={guardar} loading={guardando}>Guardar</Button>
          <button
            onClick={() => setTexto(valor)}
            className="min-h-[44px] px-3 text-[15px] font-bold text-tinta-2 hover:text-tinta"
          >
            Descartar
          </button>
        </div>
      )}
    </Card>
  )
}

// ─── Los correos ──────────────────────────────────────────────────────────────

function Destinatarios({ correos, organizaciones, onCambio }) {
  const [nuevo, setNuevo] = useState({ organizacion_id: '', correo: '', proposito: 'manifiesto' })
  const [guardando, setGuardando] = useState(false)

  const nombreDe = new Map(organizaciones.map(o => [o.id, o.nombre]))

  async function agregar() {
    if (!nuevo.organizacion_id) { toast.error('Falta de quién es el correo.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nuevo.correo.trim())) {
      toast.error('Ese correo no se ve bien escrito.'); return
    }
    setGuardando(true)
    const { error } = await supabase.from('organizacion_correos').insert({
      organizacion_id: nuevo.organizacion_id,
      correo: nuevo.correo.trim().toLowerCase(),
      proposito: nuevo.proposito,
    })
    setGuardando(false)
    if (error) {
      toast.error(
        error.message.includes('unico') || error.code === '23505'
          ? 'Ese correo ya está para esa organización y ese propósito.'
          : 'No se pudo agregar. ' + error.message
      )
      return
    }
    setNuevo({ organizacion_id: '', correo: '', proposito: nuevo.proposito })
    toast.success('Destinatario agregado')
    onCambio()
  }

  async function quitar(id) {
    const { error } = await supabase.from('organizacion_correos').delete().eq('id', id)
    if (error) { toast.error('No se pudo quitar. ' + error.message); return }
    toast.success('Destinatario quitado')
    onCambio()
  }

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <Mail size={17} className="text-blue-700 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-tinta">A dónde salen los correos</h2>
          <p className="text-[13px] text-tinta-2">
            El envío lo hace el servidor, nunca el aparato: el iPad del muelle no tiene correo y
            a menudo no tiene señal.
          </p>
        </div>
      </div>

      {PROPOSITOS.map(p => {
        const suyos = correos.filter(c => c.proposito === p.codigo)
        return (
          <section key={p.codigo}>
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-tinta-2">
              {p.etiqueta}
            </h3>
            <p className="text-[13px] text-tinta-2 mb-1.5">{p.porque}</p>

            {suyos.length === 0 ? (
              <p className={classNames(
                'text-[15px] rounded-xl px-3 py-2',
                // Sin correo de manifiesto no se le puede avisar a la Capitanía,
                // y eso sí detiene un zarpe. Los otros dos vacíos no son un
                // problema: son un dato.
                p.codigo === 'manifiesto'
                  ? 'text-coral-700 bg-coral-50'
                  : 'text-tinta-2'
              )}>
                {p.codigo === 'manifiesto'
                  ? 'Todavía no hay a quién mandarle el manifiesto.'
                  : 'Sin correos.'}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-linea">
                {suyos.map(c => (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-tinta break-all">{c.correo}</span>
                      <span className="block text-[13px] text-tinta-2">
                        {nombreDe.get(c.organizacion_id) || 'de una organización que ya no está'}
                      </span>
                    </span>
                    <button
                      onClick={() => quitar(c.id)}
                      aria-label={`Quitar ${c.correo}`}
                      className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-tinta-2 hover:text-peligro-500 hover:bg-peligro-50"
                    >
                      <Trash2 size={17} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <div className="border-t border-linea pt-4 flex flex-col gap-3">
        <p className="flex items-center gap-2 text-[14px] font-bold text-tinta">
          <Send size={15} className="text-tinta-2" /> Agregar un destinatario
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="De quién es"
            value={nuevo.organizacion_id}
            onChange={v => setNuevo(n => ({ ...n, organizacion_id: v }))}
            placeholder="— Organización —"
            options={organizaciones.map(o => ({ value: o.id, label: o.nombre }))}
          />
          <Select
            label="Para qué"
            value={nuevo.proposito}
            onChange={v => setNuevo(n => ({ ...n, proposito: v }))}
            options={PROPOSITOS.map(p => ({ value: p.codigo, label: p.etiqueta }))}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <Input
            label="Correo"
            type="email"
            value={nuevo.correo}
            onChange={e => setNuevo(n => ({ ...n, correo: e.target.value }))}
          />
          <Button variant="secondary" onClick={agregar} loading={guardando}>
            <Plus size={15} /> Agregar
          </Button>
        </div>
      </div>
    </Card>
  )
}
