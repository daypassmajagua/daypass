import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Lock, PlusCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { usePendientes } from '../hooks/usePendientes'
import {
  useDiaOperativo, useRegistrosEnVivo, cerrarTentativo,
} from '../hooks/useDiaOperativo'
import { aFechaLocal, fraseFecha, hoyLocal, plural } from '../lib/utils'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import FranjaDia from '../components/layout/FranjaDia'
import FraseDelDia from '../components/hoy/FraseDelDia'
import Pendientes from '../components/hoy/Pendientes'
import SelectorDia from '../components/hoy/SelectorDia'

/**
 * "Hoy": la pantalla que organiza el día.
 *
 * A las 7 a.m. la asesora no necesita indicadores: necesita saber qué le
 * falta. Los números y las gráficas viven en Informes, que es donde la
 * dirección los busca. Aquí solo queda lo accionable.
 */
export default function Hoy() {
  const navigate = useNavigate()
  const { fechaActiva, setFechaActiva } = useAppStore()
  const { registros, loading, refetch } = useRegistros(fechaActiva)
  const { dia, enPlaneacion } = useDiaOperativo(fechaActiva)

  useRegistrosEnVivo(fechaActiva, refetch)

  const { lista, resumen } = usePendientes(registros, { enPlaneacion })

  const [confirmandoCierre, setConfirmandoCierre] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  // El estado de mañana se muestra en su pestaña aunque estemos viendo hoy.
  const [estadoManana, setEstadoManana] = useState(null)
  useEffect(() => {
    const [y, m, d] = hoyLocal().split('-').map(Number)
    const manana = aFechaLocal(new Date(y, m - 1, d + 1))
    let vigente = true
    supabase
      .from('dias_operativos')
      .select('estado')
      .eq('fecha', manana)
      .maybeSingle()
      .then(({ data }) => { if (vigente) setEstadoManana(data?.estado || null) })
    return () => { vigente = false }
  }, [dia])

  const vivas = useMemo(
    () => registros.filter(r => !['cancelada', 'noshow'].includes(r.estado)),
    [registros]
  )
  const pax = useMemo(() => vivas.reduce((s, r) => s + r.adultos + r.ninos, 0), [vivas])
  const lanchas = useMemo(
    () => new Set(vivas.map(r => r.lancha_id).filter(Boolean)).size,
    [vivas]
  )
  const tentativas = useMemo(
    () => registros.filter(r => r.estado === 'tentativa'),
    [registros]
  )

  async function confirmarCierre() {
    setCerrando(true)
    const { error } = await cerrarTentativo(fechaActiva)
    setCerrando(false)
    setConfirmandoCierre(false)
    if (error) {
      toast.error('No se pudo cerrar el tentativo. ' + error.message)
    } else {
      toast.success('Tentativo cerrado. Las reservas tentativas quedaron confirmadas.')
      await refetch()
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <FranjaDia />

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-7">
        <SelectorDia fecha={fechaActiva} onChange={setFechaActiva} estadoManana={estadoManana} />
        <div className="flex items-center gap-2 flex-wrap">
          {enPlaneacion && registros.length > 0 && (
            <Button variant="secondary" onClick={() => setConfirmandoCierre(true)}>
              <Lock size={16} />
              Cerrar el tentativo
            </Button>
          )}
          <Button onClick={() => navigate('/nuevo')}>
            <PlusCircle size={16} />
            Nueva reserva
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-tinta-2 py-10">Cargando el día...</p>
      ) : (
        <>
          {/* Zona 1 — el día en una frase */}
          <div className="mb-7">
            <FraseDelDia
              fecha={fechaActiva}
              pax={pax}
              lanchas={lanchas}
              resumen={resumen}
              dia={dia}
              hayReservas={registros.length > 0}
            />
          </div>

          {/* Zona 2 — lo que falta, como lista de tareas */}
          {registros.length > 0 && (
            <>
              <h2 className="text-[12px] font-bold uppercase tracking-[.12em] text-tinta-2 mb-3">
                Lo que falta
              </h2>
              <Pendientes lista={lista} fecha={fechaActiva} />
            </>
          )}
        </>
      )}

      {/* Cerrar el tentativo sí confirma: dispara cocina y folios. */}
      <Modal
        open={confirmandoCierre}
        onClose={() => setConfirmandoCierre(false)}
        title="Cerrar el tentativo"
      >
        <p className="text-[15px] text-tinta">
          Vas a cerrar el tentativo de{' '}
          <b className="lowercase">{fraseFecha(fechaActiva)}</b>.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-tinta-2">
          <li>· {plural(tentativas.length, 'reserva tentativa pasa', 'reservas tentativas pasan')} a confirmada.</li>
          <li>· A partir de ahí, cualquier cambio queda marcado como tardío.</li>
          <li>· La cocina y la isla trabajan sobre esta versión.</li>
        </ul>
        {lista.length > 0 && (
          <p className="mt-3 text-sm text-coral-700 bg-coral-50 rounded-xl px-3 py-2">
            Quedan {plural(lista.length, 'pendiente', 'pendientes')} sin resolver.
            Puedes cerrar igual: la idea es que cierres con los ojos abiertos, no que te bloquee.
          </p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setConfirmandoCierre(false)}>
            Todavía no
          </Button>
          <Button onClick={confirmarCierre} loading={cerrando}>
            <Lock size={16} />
            Cerrar el tentativo
          </Button>
        </div>
      </Modal>
    </div>
  )
}
