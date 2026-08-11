import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Search, Volume2, VolumeX } from 'lucide-react'
import { classNames } from '../../lib/utils'
import { desbloquearSonido, tocar, estaSilenciado, alternarSilencio } from '../../lib/sonido'

/**
 * El lector de pases del muelle.
 *
 * Es comodidad, no requisito: la regla dice que el QR NUNCA es obligatorio
 * para embarcar. Si la cámara no abre, si el cliente no trajo el pase o si
 * simplemente no funciona, la búsqueda por nombre sigue ahí y el muelle no se
 * detiene. Por eso todo camino de error termina en "búscalo por nombre", nunca
 * en una pantalla trabada.
 *
 * ── Por qué no se cierra al leer ────────────────────────────────────────────
 *
 * Antes sí: leía un código, se cerraba, y el veredicto salía afuera en un
 * toast. Eso convierte una fila que avanza en un trámite por persona — abrir,
 * apuntar, cerrar, leer el aviso, volver a abrir — cuarenta veces, con la
 * lancha esperando.
 *
 * Ahora **se queda abierto y sigue mirando**. El veredicto aparece dentro, en
 * grande, y el siguiente pase entra de inmediato. El mismo código no se
 * re-dispara durante segundo y medio, que es lo que tarda una persona en
 * apartar la mano.
 *
 * ── Los cuatro veredictos, y por qué estos cuatro ───────────────────────────
 *
 * Se distinguen solo los que se pueden saber **sin señal**, que es como
 * trabaja el muelle. El pase se resuelve contra la copia local del día:
 *
 *   · **válido** — está en esta lancha
 *   · **ya subió** — se leyó dos veces, o ya estaba marcado
 *   · **otra lancha** — es de hoy, pero de la otra lancha. Con dos lanchas
 *     saliendo del mismo muelle esto pasa todos los días
 *   · **no es de hoy** — no está en la copia del día
 *
 * El plan hablaba de «otra fecha» y decía la fecha exacta. Eso exige
 * preguntarle al servidor, y en La Bodeguita a las 8:20 puede no haber a quién
 * preguntarle. «No es de hoy» es lo que sí se sabe siempre, y lleva a la misma
 * acción: buscarlo por nombre.
 *
 * Decodifica con BarcodeDetector donde exista —es del sistema y gasta menos
 * batería— y con jsQR donde no. Safari de iPadOS no trae BarcodeDetector, y
 * el iPad es justamente el aparato del muelle, así que el camino de jsQR no es
 * el raro: es el normal. jsQR se trae al abrir el lector, no antes.
 */

const LADO = 640

/** Cuánto se ignora el mismo código antes de volver a leerlo. */
const SILENCIO_MISMO_PASE = 1500

/** Cuánto se queda el veredicto en pantalla antes de apagarse solo. */
const DURA_VEREDICTO = 4000

const VEREDICTOS = {
  ok: {
    caja: 'bg-verde-500 text-white',
    sonido: 'ok',
  },
  repetido: {
    caja: 'bg-aviso-50 text-aviso-700 ring-2 ring-aviso-300',
    sonido: 'repetido',
  },
  otra_lancha: {
    caja: 'bg-alarma-50 text-alarma-900 ring-2 ring-alarma-300',
    sonido: 'error',
  },
  no_encontrado: {
    caja: 'bg-sol-tinta text-white',
    sonido: 'error',
  },
}

export default function LectorQR({ onLeer, onCerrar, onBuscarPorNombre }) {
  const video = useRef(null)
  const lienzo = useRef(null)
  const parar = useRef(false)
  const ultimo = useRef({ texto: null, en: 0 })

  const [error, setError] = useState(null)
  const [listo, setListo] = useState(false)
  const [veredicto, setVeredicto] = useState(null)
  const [silencio, setSilencio] = useState(estaSilenciado)

  /**
   * Lo que pasa con un código leído.
   *
   * Vive en una ref que se refresca en cada render —el patrón de «la función
   * más reciente»— para que el bucle de la cámara nunca se reinicie. Si
   * dependiera de `onLeer` en las dependencias del efecto, cada render de la
   * pantalla de arriba apagaría y volvería a encender la cámara: medio segundo
   * de negro por cada toque, con la fila esperando.
   *
   * Se asigna dentro de un efecto y no en el cuerpo: escribir una ref durante
   * el render es de las cosas que funcionan hasta que React decide repetir un
   * render, y entonces dejan de funcionar sin avisar.
   */
  const alDecodificar = useRef(null)

  useEffect(() => {
    alDecodificar.current = async texto => {
      const ahora = Date.now()
      // El mismo pase delante de la cámara no vale dos veces seguidas: la
      // gente no aparta la mano al instante.
      if (ultimo.current.texto === texto && ahora - ultimo.current.en < SILENCIO_MISMO_PASE) return
      ultimo.current = { texto, en: ahora }

      const v = await onLeer(texto)
      if (!v || parar.current) return

      setVeredicto({ ...v, en: ahora })
      tocar(VEREDICTOS[v.tipo]?.sonido || 'error')
    }
  })

  // El veredicto se apaga solo. La cámara nunca deja de mirar.
  useEffect(() => {
    if (!veredicto) return
    const t = setTimeout(() => setVeredicto(null), DURA_VEREDICTO)
    return () => clearTimeout(t)
  }, [veredicto])

  const cambiarSilencio = useCallback(() => setSilencio(alternarSilencio()), [])

  useEffect(() => {
    parar.current = false
    let stream = null
    let detector = null

    // El audio de iOS nace suspendido hasta un gesto. Abrir el lector ES el
    // gesto: no hace falta inventar un permiso aparte.
    desbloquearSonido()

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

      // Solo se trae el decodificador si de verdad hace falta: donde hay
      // BarcodeDetector —Android, Chrome— jsQR no se descarga nunca.
      let jsQR = null
      if (!detector) {
        try { jsQR = (await import('jsqr')).default }
        catch {
          setError('No se pudo cargar el lector.')
          return
        }
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

        if (texto) await alDecodificar.current(texto)
        // Siga o no siga habiendo código, el bucle continúa: la fila avanza.
        if (!parar.current) requestAnimationFrame(mirar)
      }
      requestAnimationFrame(mirar)
    }

    arrancar()
    return () => {
      parar.current = true
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const apariencia = veredicto ? VEREDICTOS[veredicto.tipo] : null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <p className="text-white text-[19px] font-bold">Apunta al pase</p>
        <div className="flex items-center gap-1">
          <button
            onClick={cambiarSilencio}
            className="w-14 h-14 flex items-center justify-center rounded-2xl text-white"
            aria-label={silencio ? 'Activar el sonido' : 'Silenciar'}
            aria-pressed={silencio}
          >
            {silencio ? <VolumeX size={26} /> : <Volume2 size={26} />}
          </button>
          <button
            onClick={onCerrar}
            className="w-14 h-14 flex items-center justify-center rounded-2xl text-white"
            aria-label="Cerrar el lector"
          >
            <X size={30} />
          </button>
        </div>
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

        {/* El veredicto, dentro del lector y en grande. El nombre va del
            tamaño que se lee desde el otro lado del mesón: quien está en la
            fila ve el suyo y sabe que ya pasó. */}
        {veredicto && apariencia && (
          <div
            className={classNames(
              'absolute left-0 right-0 bottom-0 px-5 py-4 aparecer',
              apariencia.caja
            )}
            role="status"
            aria-live="assertive"
          >
            <p className="text-[28px] font-bold leading-tight text-balance">
              {veredicto.titulo}
            </p>
            {veredicto.detalle && (
              <p className="text-[18px] opacity-90 mt-0.5">{veredicto.detalle}</p>
            )}
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-white text-[21px] font-bold">{error}</p>
            <p className="text-white/80 text-[17px]">
              No importa: búscalo por el nombre, como siempre.
            </p>
          </div>
        )}
      </div>

      {/* Siempre visible, no solo cuando la cámara falla. El QR va a fallar
          —el pase arrugado, el sol de frente, la pantalla del celular sucia—
          y ese fallo no puede costar más de un toque. */}
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 flex flex-col gap-2">
        <button
          onClick={onBuscarPorNombre || onCerrar}
          className="w-full rounded-2xl bg-white text-sol-tinta text-[19px] font-bold min-h-[64px] flex items-center justify-center gap-2"
        >
          <Search size={22} />
          Buscar por nombre
        </button>
        <p className="text-white/70 text-[15px] text-center">
          El pase no es obligatorio para embarcar.
        </p>
      </div>
    </div>
  )
}
