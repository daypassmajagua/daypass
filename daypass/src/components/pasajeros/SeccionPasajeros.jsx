import { useMemo, useState } from 'react'
import { ClipboardPaste, Plus, Trash2, TriangleAlert, Users, X } from 'lucide-react'
import { parsePasajeros, resumenPasajeros } from '../../lib/parsePasajeros'
import { classNames } from '../../lib/utils'
import Button from '../ui/Button'
import Select from '../ui/Select'

const CATEGORIAS = [
  { value: 'adulto', label: 'Adulto' },
  { value: 'nino', label: 'Niño' },
  { value: 'infante', label: 'Infante' },
  { value: 'cortesia', label: 'Cortesía' },
]

const TIPOS_DOC = [
  { value: '', label: '—' },
  { value: 'cc', label: 'CC' },
  { value: 'ce', label: 'CE' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'ti', label: 'TI' },
  { value: 'rc', label: 'RC' },
]

const filaVacia = () => ({
  nombre: '', tipo_documento: null, documento: '', pais_id: null,
  categoria: 'adulto', opcion_plato_id: null,
  restriccion_alimentaria: '', _dudosa: false,
})

/**
 * Los nombres de los pasajeros. Nada aquí bloquea: en la operación real los
 * listados llegan tarde, así que la reserva vive sin nombres y el faltante
 * queda visible en el contador.
 */
export default function SeccionPasajeros({ plan, pasajeros, onChange, paises = [], opcionesPlato = [] }) {
  // El plato solo se pregunta si el plan tiene opciones (Diamond no tiene).
  const conPlato = opcionesPlato.length > 0
  const opcionesDePlato = useMemo(
    () => [{ value: '', label: '— Plato —' }, ...opcionesPlato.map(o => ({ value: o.id, label: o.nombre_es }))],
    [opcionesPlato]
  )
  const [pegando, setPegando] = useState(false)
  const [texto, setTexto] = useState('')

  const resumen = useMemo(() => resumenPasajeros(plan, pasajeros), [plan, pasajeros])
  const dudosas = pasajeros.filter(p => p._dudosa).length

  const opcionesPais = useMemo(
    () => [{ value: '', label: '— País —' }, ...paises.map(p => ({ value: p.id, label: p.nombre }))],
    [paises]
  )

  function editar(i, campo, valor) {
    const copia = [...pasajeros]
    copia[i] = { ...copia[i], [campo]: valor }
    if (campo === 'nombre' && valor.trim()) copia[i]._dudosa = false
    onChange(copia)
  }

  function quitar(i) {
    onChange(pasajeros.filter((_, j) => j !== i))
  }

  function agregarFila() {
    onChange([...pasajeros, filaVacia()])
  }

  function interpretar() {
    const filas = parsePasajeros(texto, paises)
    if (!filas.length) return
    onChange([...pasajeros, ...filas])
    setTexto('')
    setPegando(false)
  }

  const previa = useMemo(
    () => (texto.trim() ? parsePasajeros(texto, paises) : []),
    [texto, paises]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Contador: siempre visible, nunca bloquea */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[15px] tabular">
          <Users size={16} className="text-tinta-2" />
          <span className="text-tinta-2">Plan:</span>
          <b>{resumen.plan}</b>
          <span className="text-linea">·</span>
          <span className="text-tinta-2">Con nombre:</span>
          <b>{resumen.conNombre}</b>
          {resumen.faltan > 0 && (
            <>
              <span className="text-linea">·</span>
              <span className="text-coral-600 font-bold">Faltan {resumen.faltan}</span>
            </>
          )}
          {resumen.sobran > 0 && (
            <>
              <span className="text-linea">·</span>
              <span className="text-coral-600 font-bold">
                {resumen.sobran} de más que el plan
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button type="button" variant="secondary" size="sm" onClick={() => setPegando(true)}>
            <ClipboardPaste size={14} />
            Pegar lista
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={agregarFila}>
            <Plus size={14} />
            Agregar uno
          </Button>
        </div>
      </div>

      {/* Pegar la lista de la agencia */}
      {pegando && (
        <div className="rounded-2xl bg-blue-50 p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[15px]">Pega aquí la lista que te mandó la agencia</p>
              <p className="text-sm text-tinta-2">
                Sirve como venga: de Excel, de WhatsApp o de un correo. Una persona por línea.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setPegando(false); setTexto('') }}
              className="icono-tactil w-11 h-11 flex items-center justify-center shrink-0 rounded-xl text-tinta-2 hover:bg-white"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>

          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={7}
            autoFocus
            placeholder={'Carolina Martínez\tCC 45789123\tColombia\nJuan Pablo Gómez\t1020304050\n...'}
            className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:border-blue-600"
          />

          {previa.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[15px] font-bold">
                Detectamos {previa.length} {previa.length === 1 ? 'persona' : 'personas'}
              </p>
              {previa.some(p => p._dudosa) && (
                <span className="inline-flex items-center gap-1.5 text-sm text-coral-600 font-semibold">
                  <TriangleAlert size={14} />
                  {previa.filter(p => p._dudosa).length} sin entender del todo — las puedes corregir abajo
                </span>
              )}
              <Button type="button" size="sm" onClick={interpretar} className="ml-auto">
                Agregar {previa.length} a la lista
              </Button>
            </div>
          )}
        </div>
      )}

      {/* La lista */}
      {pasajeros.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-linea py-8 px-4 text-center">
          <p className="text-tinta-2">
            Todavía no hay nombres para esta reserva.
          </p>
          <p className="text-sm text-tinta-2 mt-1">
            Puedes guardarla así y agregarlos cuando la agencia te los mande.
          </p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setPegando(true)}>
            <ClipboardPaste size={14} />
            Pegar lista
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dudosas > 0 && (
            <p className="inline-flex items-center gap-1.5 text-sm text-coral-600 font-semibold">
              <TriangleAlert size={14} />
              {dudosas} {dudosas === 1 ? 'línea marcada' : 'líneas marcadas'}: revisa el nombre antes de guardar
            </p>
          )}

          {/* Encabezado solo cuando la fila cabe en una línea (desde 1280px). */}
          <div className={classNames(
            'hidden xl:grid gap-2 px-3 text-[12px] font-bold uppercase tracking-wider text-tinta-2',
            conPlato
              ? 'grid-cols-[1.5fr_6rem_1fr_1fr_1fr_1.1fr_1.1fr_auto]'
              : 'grid-cols-[1.6fr_7rem_1fr_1.1fr_1fr_1.2fr_auto]'
          )}>
            <span>Nombre</span><span>Tipo</span><span>Documento</span>
            <span>País</span><span>Categoría</span>
            {conPlato && <span>Plato</span>}
            <span>Restricción</span><span className="w-11" />
          </div>

          {pasajeros.map((p, i) => (
            <div
              key={i}
              className={classNames(
                // iPad: dos columnas apiladas con etiqueta. Escritorio: una fila.
                'grid grid-cols-1 sm:grid-cols-2 gap-2 items-center rounded-2xl px-3 py-3 xl:py-2',
                conPlato
                  ? 'xl:grid-cols-[1.5fr_6rem_1fr_1fr_1fr_1.1fr_1.1fr_auto]'
                  : 'xl:grid-cols-[1.6fr_7rem_1fr_1.1fr_1fr_1.2fr_auto]',
                p._dudosa ? 'bg-coral-50' : 'bg-white'
              )}
            >
              <div className="sm:col-span-2 xl:col-span-1">
                <label className="xl:hidden block text-[12px] font-bold uppercase tracking-wider text-tinta-2 mb-1">
                  Nombre
                </label>
                <input
                  value={p.nombre}
                  onChange={e => editar(i, 'nombre', e.target.value)}
                  placeholder="Nombre completo"
                  className={classNames(
                    'w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-sm bg-white focus:outline-none focus:border-blue-600',
                    p._dudosa ? 'border-coral-400' : 'border-linea'
                  )}
                />
              </div>

              <Select
                label="Tipo" labelOculta
                value={p.tipo_documento || ''}
                onChange={v => editar(i, 'tipo_documento', v || null)}
                options={TIPOS_DOC}
              />

              <div>
                <label className="xl:hidden block text-[12px] font-bold uppercase tracking-wider text-tinta-2 mb-1">
                  Documento
                </label>
                <input
                  value={p.documento || ''}
                  onChange={e => editar(i, 'documento', e.target.value)}
                  placeholder="Documento"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-linea px-3 py-2.5 min-h-[44px] text-sm bg-white tabular focus:outline-none focus:border-blue-600"
                />
              </div>

              <Select
                label="País" labelOculta
                value={p.pais_id || ''}
                onChange={v => editar(i, 'pais_id', v || null)}
                options={opcionesPais}
              />
              <Select
                label="Categoría" labelOculta
                value={p.categoria}
                onChange={v => editar(i, 'categoria', v)}
                options={CATEGORIAS}
              />

              {conPlato && (
                <Select
                  label="Plato" labelOculta
                  value={p.opcion_plato_id || ''}
                  onChange={v => editar(i, 'opcion_plato_id', v || null)}
                  options={opcionesDePlato}
                />
              )}

              <div>
                <label className="xl:hidden block text-[12px] font-bold uppercase tracking-wider text-tinta-2 mb-1">
                  Restricción
                </label>
                <input
                  value={p.restriccion_alimentaria || ''}
                  onChange={e => editar(i, 'restriccion_alimentaria', e.target.value)}
                  placeholder="Ej: sin gluten"
                  className="w-full rounded-xl border border-linea px-3 py-2.5 min-h-[44px] text-sm bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="button"
                onClick={() => quitar(i)}
                className="icono-tactil w-11 h-11 flex items-center justify-center rounded-xl text-tinta-2 bg-fondo xl:bg-transparent justify-self-end sm:col-span-2 xl:col-span-1 sm:justify-self-start xl:justify-self-end"
                aria-label={`Quitar a ${p.nombre || 'esta persona'}`}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={agregarFila}
            className="self-start inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline px-3 py-1.5"
          >
            <Plus size={14} />
            Agregar otra persona
          </button>
        </div>
      )}
    </div>
  )
}
