import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/**
 * El canvas de firma.
 *
 * Se usa con el dedo en un teléfono, así que captura por puntero —no por
 * ratón— y bloquea el desplazamiento de la página mientras se traza. Guarda
 * el resultado como PNG en base64: es lo que va al hash y a Storage.
 */
export default function Firma({ onCambio, etiquetaLimpiar }) {
  const canvasRef = useRef(null)
  const dibujando = useRef(false)
  const [tieneTrazo, setTieneTrazo] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Nitidez en pantallas de alta densidad: sin esto la firma sale borrosa.
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#16182c'
  }, [])

  function posicion(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function empezar(e) {
    e.preventDefault()
    dibujando.current = true
    canvasRef.current.setPointerCapture(e.pointerId)
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = posicion(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function mover(e) {
    if (!dibujando.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = posicion(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!tieneTrazo) setTieneTrazo(true)
  }

  function terminar(e) {
    if (!dibujando.current) return
    dibujando.current = false
    try { canvasRef.current.releasePointerCapture(e.pointerId) } catch { /* ya se soltó */ }
    onCambio?.(canvasRef.current.toDataURL('image/png'))
  }

  function limpiar() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setTieneTrazo(false)
    onCambio?.(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-2xl bg-white ring-2 ring-linea overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          onPointerCancel={terminar}
          className="w-full h-44 block touch-none cursor-crosshair"
        />
        {!tieneTrazo && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="border-b-2 border-dashed border-linea w-2/3 pb-1" />
          </span>
        )}
      </div>

      {tieneTrazo && (
        <button
          type="button"
          onClick={limpiar}
          className="self-start inline-flex items-center gap-1.5 text-sm font-bold text-tinta-2 min-h-[44px] px-2"
        >
          <Eraser size={16} />
          {etiquetaLimpiar}
        </button>
      )}
    </div>
  )
}
