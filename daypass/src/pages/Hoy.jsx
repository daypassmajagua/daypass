import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, PlusCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { useRegistros } from '../hooks/useRegistros'
import { EstadoError, Esqueleto } from '../components/patrones'
import { usePendientes } from '../hooks/usePendientes'
import { useDiaOperativo, useRegistrosEnVivo } from '../hooks/useDiaOperativo'
import { aFechaLocal, fraseFecha, hoyLocal } from '../lib/utils'
import Button from '../components/ui/Button'
import FranjaDia from '../components/layout/FranjaDia'
import FraseDelDia from '../components/hoy/FraseDelDia'
import Pendientes from '../components/hoy/Pendientes'
import SelectorDia from '../components/hoy/SelectorDia'
import HoyDelPeriodo from '../components/hoy/HoyDelPeriodo'
import { usePerfil } from '../hooks/usePerfil'

/**
 * "Hoy": la pantalla que organiza el día.
 *
 * A las 7 a.m. la asesora no necesita indicadores: necesita saber qué le
 * falta. Los números y las gráficas viven en Informes, que es donde la
 * dirección los busca. Aquí solo queda lo accionable.
 *
 * ── Un sustantivo, dos formas ───────────────────────────────────────────────
 *
 * «Hoy» quiere decir cosas distintas según quién entra, y por eso no son dos
 * entradas de menú: **`/panorama` habría sido el nombre que le pone el
 * software a una pantalla**, no algo que exista en la operación.
 *
 *   · quien opera el día  → esto: la frase, los pendientes, la lista
 *   · gerencia            → el periodo: la meta, el día contra el promedio,
 *                           la cartera vencida
 *
 * **La directora se queda con la forma operativa**, aunque el plan las juntaba
 * a las dos. Ella abre la app para operar —su menú es el completo, cierra
 * días y mueve reservas— y darle un tablero de indicadores como primera
 * pantalla la dejaría a dos clics del día que dirige. El resumen del negocio
 * lo tiene a un toque, en Informes.
 */
export default function Hoy() {
  const { rol } = usePerfil()

  // Gerencia mira el negocio; el resto opera el día.
  if (rol === 'gerencia') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <FranjaDia />
        <HoyDelPeriodo />
      </div>
    )
  }

  return <HoyDeLaOperacion />
}

function HoyDeLaOperacion() {
  const navigate = useNavigate()
  const { fechaActiva, setFechaActiva } = useAppStore()
  const { registros, loading, error, refetch } = useRegistros(fechaActiva)
  const { dia, enPlaneacion } = useDiaOperativo(fechaActiva)

  useRegistrosEnVivo(fechaActiva, refetch)

  // Las cortesías no llevan folio ni pago: el catálogo lo dice.
  const [tiposIngreso, setTiposIngreso] = useState([])
  useEffect(() => {
    supabase.from('tipos_ingreso').select('*').then(({ data }) => setTiposIngreso(data || []))
  }, [])

  const { lista, resumen } = usePendientes(registros, { enPlaneacion, tiposIngreso })

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <FranjaDia />

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-7">
        <SelectorDia fecha={fechaActiva} onChange={setFechaActiva} estadoManana={estadoManana} />
        <div className="flex items-center gap-2 flex-wrap">
          {/* Para hoy el verbo lo ofrece la franja, arriba. Este botón se
              queda para los otros días: cerrar el tentativo de mañana es un
              flujo real, y la franja solo habla del día de hoy. */}
          {enPlaneacion && registros.length > 0 && fechaActiva !== hoyLocal() && (
            <Button variant="secondary" onClick={() => navigate('/cerrar')}>
              <Lock size={16} />
              Cerrar {fraseFecha(fechaActiva).toLowerCase()}
            </Button>
          )}
          <Button onClick={() => navigate('/nuevo')}>
            <PlusCircle size={16} />
            Nueva reserva
          </Button>
        </div>
      </div>

      {loading ? (
        <Esqueleto filas={4} />
      ) : error ? (
        <EstadoError error={error} onReintentar={refetch} />
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

    </div>
  )
}
