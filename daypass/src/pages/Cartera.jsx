import { Fragment, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Wallet, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateShort, classNames, hoyLocal, plural } from '../lib/utils'
import { TRAMOS } from '../lib/cartera'
import { EstadoError, Esqueleto } from '../components/patrones'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'

/**
 * Quién debe cuánto, y desde cuándo.
 *
 * Esto vivía en la cabeza de Daniela y en una columna del Excel que decía
 * `cxc`. La pregunta que responde es una sola y muy concreta: *a quién hay que
 * llamar esta semana*. Por eso lo primero que se ve es la agencia con la deuda
 * más vieja, no el total del mes.
 *
 * **No es contabilidad.** La factura y el folio viven en Zeus; esto es el libro
 * de control de la operación. Si algún día no cuadra con Zeus, manda Zeus.
 */

const MEDIOS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'datafono', label: 'Datáfono' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'anticipo', label: 'Anticipo' },
  { value: 'otro', label: 'Otro' },
]

export default function Cartera() {
  const [cartera, setCartera] = useState([])
  const [saldos, setSaldos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const [cobrando, setCobrando] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [c, s] = await Promise.all([
      supabase.from('cartera_por_organizacion').select('*'),
      supabase.from('saldos_reserva').select('*'),
    ])
    if (c.error) setError(c.error.message)
    else {
      setError(null)
      setCartera(c.data || [])
      setSaldos((s.data || []).filter(x => x.saldo > 0 && x.fecha <= hoyLocal()))
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const total = cartera.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const vencido = cartera.reduce((sum, o) => sum + Number(o.mas_de_90 || 0), 0)

  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHeader
        title="Cartera"
        subtitle="Quién quedó debiendo, y desde cuándo"
      />

      {cargando ? (
        <Esqueleto filas={4} />
      ) : error ? (
        <EstadoError error={error} onReintentar={cargar} />
      ) : !cartera.length ? (
        <Card className="p-12 text-center">
          <Wallet size={32} className="mx-auto text-tinta-2/50 mb-3" aria-hidden="true" />
          <p className="text-tinta-2 text-[17px]">No hay nada por cobrar.</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <Card className="p-4 flex-1 min-w-[12rem]">
              <p className="text-[13px] text-tinta-2">Por cobrar</p>
              <p className="text-[26px] font-bold text-tinta tabular">{formatCurrency(total)}</p>
            </Card>
            {vencido > 0 && (
              <Card className="p-4 flex-1 min-w-[12rem] ring-2 ring-coral-500">
                <p className="text-[13px] text-coral-600 font-bold">Con más de 90 días</p>
                <p className="text-[26px] font-bold text-coral-600 tabular">
                  {formatCurrency(vencido)}
                </p>
              </Card>
            )}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-fondo text-left text-tinta-2">
                    <th className="px-4 py-3 font-bold">Agencia</th>
                    {TRAMOS.map(t => (
                      <th key={t.clave} className="px-3 py-3 font-bold text-right whitespace-nowrap">
                        {t.etiqueta}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-bold text-right">Total</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {cartera.map(o => {
                    const detalle = saldos.filter(s =>
                      (s.agencia_id || s.agencia_nombre || 'sin-organizacion') ===
                      (o.organizacion_id === 'sin-organizacion' ? 'sin-organizacion' : o.organizacion_id))
                    const abierto = abierta === o.organizacion_id
                    return (
                      // La clave va en el fragmento, que es lo que devuelve el
                      // map: ponerla en el <tr> de adentro deja al fragmento sin
                      // clave y React repinta la tabla entera al desplegar una.
                      <Fragment key={o.organizacion_id}>
                        <tr className={classNames(o.mas_de_90 > 0 && 'bg-coral-50/40')}>
                          <td className="px-4 py-3">
                            <p className="font-bold text-tinta">{o.organizacion}</p>
                            <p className="text-[12px] text-tinta-2">
                              {plural(o.reservas, 'reserva', 'reservas')} · la más vieja
                              hace {plural(o.mas_viejo, 'día', 'días')}
                            </p>
                          </td>
                          {TRAMOS.map(t => (
                            <td key={t.clave} className={classNames(
                              'px-3 py-3 text-right tabular',
                              t.clave === 'mas_de_90' && Number(o[t.clave]) > 0
                                ? 'text-coral-600 font-bold' : 'text-tinta-2'
                            )}>
                              {Number(o[t.clave]) > 0 ? formatCurrency(o[t.clave]) : '—'}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right font-bold text-tinta tabular">
                            {formatCurrency(o.total)}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              onClick={() => setAbierta(abierto ? null : o.organizacion_id)}
                              className="p-1.5 rounded-lg text-tinta-2 hover:bg-fondo"
                              aria-label={abierto ? 'Cerrar el detalle' : 'Ver las reservas'}
                            >
                              <ChevronDown size={18}
                                className={classNames('transition-transform', abierto && 'rotate-180')} />
                            </button>
                          </td>
                        </tr>

                        {abierto && detalle.map(s => (
                          <tr key={s.registro_id} className="bg-fondo/60">
                            <td className="px-4 py-2.5 pl-8" colSpan={2}>
                              <span className="text-tinta">
                                {s.nombre_grupo || s.nombre_pasajero}
                              </span>
                              <span className="text-tinta-2"> · {formatDateShort(s.fecha)}</span>
                            </td>
                            <td className="px-3 py-2.5 text-tinta-2" colSpan={2}>
                              {s.pagado > 0 && `abonó ${formatCurrency(s.pagado)} de ${formatCurrency(s.a_cobrar)}`}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-tinta tabular">
                              {formatCurrency(s.saldo)}
                            </td>
                            <td className="px-2 py-2.5">
                              <button
                                onClick={() => setCobrando(s)}
                                className="text-[13px] font-bold text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 whitespace-nowrap"
                              >
                                Registrar pago
                              </button>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[13px] text-tinta-2 mt-3">
            La antigüedad se cuenta desde el día del pasadía, que es cuando nace
            la deuda. La factura vive en Zeus: esto es el control de la operación.
          </p>
        </>
      )}

      {cobrando && (
        <RegistrarPago
          saldo={cobrando}
          onCerrar={() => setCobrando(null)}
          onGuardado={async () => { setCobrando(null); await cargar() }}
        />
      )}
    </div>
  )
}

function RegistrarPago({ saldo, onCerrar, onGuardado }) {
  // Viene puesto con lo que falta: lo corriente es que paguen el saldo
  // completo, y escribirlo otra vez es un error esperando pasar.
  const [valor, setValor] = useState(String(saldo.saldo))
  const [medio, setMedio] = useState('transferencia')
  const [soporte, setSoporte] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const monto = Number(valor)
    if (!monto || monto <= 0) { toast.error('El valor tiene que ser mayor que cero.'); return }

    setGuardando(true)
    const { error } = await supabase.from('pagos').insert({
      registro_id: saldo.registro_id,
      fecha: hoyLocal(),
      valor: monto,
      medio,
      soporte: soporte.trim() || null,
    })
    setGuardando(false)

    if (error) { toast.error('No se pudo guardar el pago. ' + error.message); return }
    toast.success(`Pago de ${formatCurrency(monto)} registrado`)
    onGuardado()
  }

  return (
    <Modal open onClose={onCerrar} title={`Pago de ${saldo.nombre_grupo || saldo.nombre_pasajero}`}>
      <div className="flex flex-col gap-4">
        <p className="text-[15px] text-tinta-2">
          Debe {formatCurrency(saldo.saldo)} del pasadía del {formatDateShort(saldo.fecha)}.
        </p>

        <Input
          label="Valor"
          inputMode="numeric"
          value={valor}
          onChange={e => setValor(e.target.value.replace(/[^\d]/g, ''))}
        />

        <Select label="Cómo pagó" value={medio} onChange={setMedio} options={MEDIOS} />

        <Input
          label="Soporte (opcional)"
          placeholder="Número de comprobante o referencia"
          value={soporte}
          onChange={e => setSoporte(e.target.value)}
        />

        <p className="text-[13px] text-tinta-2">
          Queda como <b>registrado</b>. Cuando se vea en la cuenta se marca como
          verificado — una transferencia que nadie confirmó no es plata todavía.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} loading={guardando}>Registrar</Button>
        </div>
      </div>
    </Modal>
  )
}
