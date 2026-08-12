import { useCallback, useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { classNames } from '../lib/utils'
import { FICHAS } from '../lib/fichasCatalogo'
import { Ficha, DondeSeUsa, Esqueleto, EstadoError } from '../components/patrones'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import DatePicker from '../components/ui/DatePicker'

/**
 * La ficha de una lancha, un piloto, un empleado o una temporada.
 *
 * Una sola pantalla para los cuatro, porque son la misma forma: unos campos,
 * un estado que dice su consecuencia, y «dónde se usa». Lo que cambia entre
 * ellos vive en `lib/fichasCatalogo.js`; lo que no cambia está aquí.
 *
 * El plan tiene la suya aparte: además administra platos, y eso no se parece
 * a nada de esto.
 *
 * ── Lo que esto le agrega a la ventana que había ────────────────────────────
 *
 * Antes cada uno se editaba en un modal con los mismos campos. Lo nuevo no son
 * los campos: es **saber a cuántas reservas les importa antes de desactivar**,
 * y tener una dirección que se pueda compartir y buscar.
 */
export default function FichaCatalogo() {
  // `/equipo/:tipo/:id` trae el tipo en la dirección; `/config/temporadas/:id`
  // no lo necesita, porque la sección ya lo dice.
  const { tipo = 'temporadas', id } = useParams()
  const config = FICHAS[tipo]

  const [fila, setFila] = useState(null)
  const [borrador, setBorrador] = useState(null)
  const [uso, setUso] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!config) return
    setCargando(true)
    const { data, error: err } = await supabase
      .from(config.tabla).select('*').eq('id', id).maybeSingle()

    if (err) { setError(err.message); setCargando(false); return }
    if (!data) { setError(`Esa ${config.singular} ya no existe.`); setCargando(false); return }

    setError(null)
    setFila(data)
    setBorrador(data)
    setCargando(false)

    // El conteo va aparte y sin bloquear: la ficha se lee mientras llega.
    setUso(await config.uso(id, data))
  }, [config, id])

  useEffect(() => { cargar() }, [cargar])

  // Una dirección inventada no se queda en pantalla en blanco.
  if (!config) return <Navigate to="/config" replace />

  if (cargando) {
    return <div className="marco py-6"><Esqueleto filas={4} /></div>
  }
  if (error) {
    return (
      <div className="marco py-6">
        <EstadoError error={error} onReintentar={cargar} />
      </div>
    )
  }

  const hayCambios = JSON.stringify(fila) !== JSON.stringify(borrador)
  const activo = config.campoActivo ? borrador[config.campoActivo] !== false : null

  function editar(clave, valor) {
    setBorrador(b => ({ ...b, [clave]: valor }))
  }

  async function guardar() {
    const campos = {}
    for (const c of config.campos) {
      const v = borrador[c.clave]
      campos[c.clave] = c.numero
        ? (v === '' || v == null ? null : Number(v))
        : (typeof v === 'string' ? v.trim() || null : v ?? null)
    }
    if (!campos.nombre) { toast.error('Falta el nombre.'); return }
    if (config.campoActivo) campos[config.campoActivo] = activo
    if (config.tabla === 'temporadas') campos.tipo = borrador.tipo

    if (config.tabla === 'temporadas' && campos.fecha_fin < campos.fecha_inicio) {
      toast.error('La temporada termina antes de empezar.')
      return
    }

    setGuardando(true)
    const { error: err } = await supabase.from(config.tabla).update(campos).eq('id', id)
    setGuardando(false)
    if (err) { toast.error('No se pudo guardar. ' + err.message); return }
    toast.success('Guardado')
    await cargar()
  }

  return (
    <Ficha
      volverA={config.volverA}
      volverEtiqueta={config.volverEtiqueta}
      titulo={config.titulo(borrador)}
      subtitulo={config.subtitulo(borrador)}
      insignia={config.campoActivo && (
        <span className={classNames(
          'px-2.5 py-1 rounded-lg text-[13px] font-bold',
          activo ? 'bg-verde-50 text-verde-600' : 'bg-fondo text-tinta-2'
        )}>
          {activo ? config.estado.siEs : config.estado.siNoEs}
        </span>
      )}
      hayCambios={hayCambios}
      guardando={guardando}
      onGuardar={guardar}
      onDescartar={() => setBorrador(fila)}
      riel={
        <>
          {config.campoActivo && (
            <Estado
              activo={activo}
              textos={config.estado}
              onCambiar={v => editar(config.campoActivo, v)}
            />
          )}
          <DondeSeUsa cargando={!uso} lineas={uso || []} />
        </>
      }
    >
      <Card className="p-5 flex flex-col gap-4">
        <h2 className="text-[15px] font-bold text-tinta">Qué es</h2>

        {config.campos.map(c => (
          <div key={c.clave}>
            {c.fecha ? (
              <DatePicker
                label={c.etiqueta}
                value={borrador[c.clave] || ''}
                onChange={v => editar(c.clave, v)}
              />
            ) : (
              <Input
                label={c.etiqueta}
                inputMode={c.numero ? 'numeric' : undefined}
                value={String(borrador[c.clave] ?? '')}
                onChange={e => editar(
                  c.clave,
                  c.numero ? e.target.value.replace(/[^\d]/g, '') : e.target.value
                )}
              />
            )}
            {c.ayuda && <p className="text-[13px] text-tinta-2 mt-1">{c.ayuda}</p>}
          </div>
        ))}

        {config.tabla === 'temporadas' && (
          <div>
            <Select
              label="Tipo"
              value={borrador.tipo || 'baja'}
              onChange={v => editar('tipo', v)}
              options={[{ value: 'baja', label: 'Baja' }, { value: 'alta', label: 'Alta' }]}
            />
            <p className="text-[13px] text-tinta-2 mt-1">
              Decide cuál de los dos precios del plan se congela en la reserva.
            </p>
          </div>
        )}
      </Card>
    </Ficha>
  )
}

/** El estado dice su consecuencia, no su nombre. */
function Estado({ activo, textos, onCambiar }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(22,24,44,.05)]">
      <h2 className="text-[12px] font-bold uppercase tracking-wider text-tinta-2 mb-2">Estado</h2>

      <button
        type="button"
        onClick={() => onCambiar(!activo)}
        aria-pressed={activo}
        className={classNames(
          'w-full text-left rounded-xl px-3 py-3 ring-1 transition-colors',
          activo ? 'bg-verde-50 ring-verde-500' : 'bg-fondo ring-transparent hover:ring-linea'
        )}
      >
        <span className="block text-[15px] font-bold text-tinta">
          {activo ? textos.siEs : textos.siNoEs}
        </span>
        <span className="block text-[13px] text-tinta-2 mt-0.5">
          {activo ? textos.explicaSi : textos.explicaNo}
        </span>
      </button>

      <p className="text-[13px] text-tinta-2 mt-2">
        Se desactivan, nunca se borran: el histórico tiene que seguir apuntando a algo.
      </p>
    </div>
  )
}
