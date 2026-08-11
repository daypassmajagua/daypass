import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EstadoError, Esqueleto, FiltroBarra, LineaDeTiempo } from '../components/patrones'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { FILTROS_ACCION, fraseDe, esSensible } from '../lib/bitacora'

/**
 * Actividad: quién hizo qué, en todo el sistema.
 *
 * ── Qué es y qué no es ──────────────────────────────────────────────────────
 *
 * Es la vista general de lo que las fichas muestran por registro. La ficha de
 * un plan cuenta la historia de ese plan; esto cuenta la del hotel, y sirve
 * para la pregunta que no tiene registro donde empezar: *«¿quién cambió algo
 * el martes?»*.
 *
 * **No es un registro de todo lo que pasa.** Consultar no genera bitácora
 * (regla 24) y las reservas llevan su propia historia en `cambios_estado`.
 * Aquí van las acciones sensibles: tarifas, ajustes, cierres, inventario de
 * tiquetes y pagos anulados. Una bitácora que lo anota todo no se lee.
 *
 * ── Por qué los filtros son fichas y no desplegables ────────────────────────
 *
 * Con fichas se ve qué está filtrado sin abrir nada. Es el patrón
 * `FiltroBarra`, que existía desde que se extrajeron los diez y solo lo usaba
 * Config.
 *
 * ── Aquí no hay corte de firma, y por eso no se anuncia ─────────────────────
 *
 * La línea de tiempo sabe explicar el vacío de autor de antes de la 024, pero
 * **la bitácora nunca lo tuvo**: `nombre` es NOT NULL desde la 015 y
 * `nombre_de_quien_actua()` siempre devuelve algo —el perfil, el correo, o
 * «alguien»—. Anunciar aquí un corte que no existe sería inventarle una
 * laguna a un dato completo. El corte sí es real en `cambios_estado`, y ahí
 * es donde se dice.
 */

/** Cuántas se traen de una. Más no se lee; menos obliga a pedir enseguida. */
const POR_TANDA = 60

export default function Actividad() {
  const [filas, setFilas] = useState([])
  const [gente, setGente] = useState([])
  const [accion, setAccion] = useState('')
  const [quien, setQuien] = useState('')
  const [cuantas, setCuantas] = useState(POR_TANDA)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [hayMas, setHayMas] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)

    let consulta = supabase.from('bitacora').select('*')
      .order('ocurrido_at', { ascending: false })
      .limit(cuantas + 1)

    if (accion) consulta = consulta.eq('accion', accion)
    // Por nombre y no por `user_id`: el nombre está congelado en la fila, así
    // que sigue siendo cierto aunque la persona se haya ido del equipo.
    if (quien) consulta = consulta.eq('nombre', quien)

    const { data, error: err } = await consulta
    if (err) { setError(err.message); setCargando(false); return }

    setError(null)
    setHayMas((data || []).length > cuantas)
    setFilas((data || []).slice(0, cuantas))
    setCargando(false)
  }, [accion, quien, cuantas])

  useEffect(() => { cargar() }, [cargar])

  // Quiénes aparecen, para poder filtrar por persona. Sale de la bitácora y no
  // de `perfiles` a propósito: la lista tiene que incluir a quien ya no está.
  useEffect(() => {
    let vigente = true
    supabase.from('bitacora').select('nombre').limit(500).then(({ data }) => {
      if (!vigente) return
      setGente([...new Set((data || []).map(f => f.nombre).filter(Boolean))].sort())
    })
    return () => { vigente = false }
  }, [])

  const grupos = [
    {
      id: 'accion',
      etiqueta: 'Qué',
      valor: accion,
      opciones: FILTROS_ACCION.map(f => ({ valor: f.valor, etiqueta: f.etiqueta })),
      onCambiar: v => { setAccion(v); setCuantas(POR_TANDA) },
    },
  ]

  if (gente.length > 1) {
    grupos.push({
      id: 'quien',
      etiqueta: 'Quién',
      valor: quien,
      opciones: gente.map(n => ({ valor: n, etiqueta: n })),
      onCambiar: v => { setQuien(v); setCuantas(POR_TANDA) },
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader
        title="Actividad"
        subtitle="Quién hizo qué. Consultar no deja rastro; cambiar una tarifa, sí."
      />

      <FiltroBarra
        grupos={grupos}
        onLimpiar={() => { setAccion(''); setQuien(''); setCuantas(POR_TANDA) }}
        className="mb-5"
      />

      {cargando && !filas.length ? (
        <Esqueleto filas={6} />
      ) : error ? (
        <EstadoError error={error} onReintentar={cargar} />
      ) : (
        <Card className="p-5">
          <LineaDeTiempo
            agruparPor="dia"
            eventos={filas.map(b => ({
              cuando: b.ocurrido_at,
              texto: fraseDe(b),
              quien: b.nombre,
              destacado: esSensible(b.accion),
            }))}
            vacio={{
              titulo: accion || quien ? 'Nada con ese filtro' : 'Todavía no hay actividad',
              detalle: accion || quien
                ? 'Prueba quitando el filtro: puede que eso todavía no haya pasado.'
                : 'Aquí van las tarifas, los ajustes, los cierres y los pagos anulados, con su hora y su nombre.',
            }}
          />

          {hayMas && (
            <div className="pt-4 mt-1 border-t border-linea">
              <Button
                variant="secondary"
                onClick={() => setCuantas(c => c + POR_TANDA)}
                loading={cargando}
              >
                Ver más atrás
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
