import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import jsQR from 'jsqr'

/**
 * El lector de pases del muelle.
 *
 * Es comodidad, no requisito: la regla dice que el QR NUNCA es obligatorio
 * para embarcar. Si la cámara no abre, si el cliente no trajo el pase o si
 * simplemente no funciona, la búsqueda por nombre sigue ahí y el muelle no se
 * detiene. Por eso todo camino de error termina en "ciérralo y busca por
 * nombre", nunca en una pantalla trabada.
 *
 * Decodifica con BarcodeDetector donde exista —es del sistema y gasta menos
 * batería— y con jsQR donde no. Safari de iPadOS no trae BarcodeDetector, y
 * el iPad es justamente el aparato del muelle, así que el camino de jsQR no es
 * el raro: es el normal.
 */

const LADO = 640

export default function LectorQR({ onLeer, onCerrar }) {
  const video = useRef(null)
  const lienzo = useRef(null)
  const parar = useRef(false)
  const [error, setError] = useState(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    parar.current = false
    let stream = null
    let detector = null

    async function arrancar() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        })
      } catch (e) {
        setError(e?.name === 'NotAllowedError'
          ? 'No diste permiso para usar la cámara.'
          : 'No se pudo abrir la cámara.')
        return
      }
      if (parar.current) { stream.getTracks().forEach(t => t.stop()); return }

      const v = video.current
      if (!v) return
      v.srcObject = stream
      await v.play().catch(() => {})
      setListo(true)

      if ('BarcodeDetector' in window) {
        try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }) }
        catch { detector = null }
      }

      const ctx = lienzo.current?.getContext('2d', { willReadFrequently: true })

      const mirar = async () => {
        if (parar.current || !video.current) return
        let texto = null

        try {
          if (detector) {
            const encontrados = await detector.detect(video.current)
            texto = encontrados[0]?.rawValue || null
          } else if (ctx && video.current.videoWidth) {
            const { videoWidth: w, videoHeight: h } = video.current
            const lado = Math.min(w, h)
            // Se mira solo el centro: es donde la gente pone el código, y
            // recortar hace el decodificado bastante más rápido.
            ctx.drawImage(video.current, (w - lado) / 2, (h - lado) / 2, lado, lado, 0, 0, LADO, LADO)
            const datos = ctx.getImageData(0, 0, LADO, LADO)
            texto = jsQR(datos.data, datos.width, datos.height, {
              inversionAttempts: 'dontInvert',
            })?.data || null
          }
        } catch { /* un cuadro malo no es un error: se mira el siguiente */ }

        if (texto) { onLeer(texto); return }
        requestAnimationFrame(mirar)
      }
      requestAnimationFrame(mirar)
    }

    arrancar()
    return () => {
      parar.current = true
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [onLeer])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <p className="text-white text-[19px] font-bold">Apunta al pase</p>
        <button
          onClick={onCerrar}
          className="w-14 h-14 flex items-center justify-center rounded-2xl text-white"
          aria-label="Cerrar el lector"
        >
          <X size={30} />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={video}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={lienzo} width={LADO} height={LADO} className="hidden" />

        {/* La mira: le dice a la gente dónde poner el código. */}
        {listo && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[62vmin] h-[62vmin] rounded-3xl ring-4 ring-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,.45)]" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-white text-[21px] font-bold">{error}</p>
            <p className="text-white/80 text-[17px]">
              No importa: cierra esto y búscalo por el nombre, como siempre.
            </p>
            <button
              onClick={onCerrar}
              className="rounded-2xl bg-white text-sol-tinta text-[18px] font-bold px-8 min-h-[64px]"
            >
              Buscar por nombre
            </button>
          </div>
        )}
      </div>

      <p className="px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)] text-white/80 text-[16px] text-center">
        El pase no es obligatorio para embarcar. Si no lo trae, búscalo por el nombre.
      </p>
    </div>
  )
}
