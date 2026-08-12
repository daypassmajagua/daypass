import { classNames } from '../../lib/utils'

/**
 * Un botón que es solo un ícono.
 *
 * Hay **44 en la app** y estaban escritos a mano uno por uno: doce maneras
 * distintas de pintar la × de cerrar, cuatro del par editar/eliminar, y
 * diecinueve alturas táctiles entre 32 y 80 px. Ninguna de esas diferencias
 * significaba nada — eran el resultado de que cada pantalla resolviera lo
 * mismo por su cuenta.
 *
 * ── Por qué `etiqueta` es obligatoria ───────────────────────────────────────
 *
 * Un ícono sin texto **no dice nada** a quien usa lector de pantalla, y ocho de
 * los cuarenta y cuatro no tenían ni `aria-label` ni `title`: el ✓ que guarda
 * un folio, el lápiz que edita una reserva en el historial, el ojo de la
 * contraseña. Se anunciaban como «botón», a secas.
 *
 * Por eso no es una prop opcional con un valor por defecto amable: **el
 * componente avisa en desarrollo si falta**. Un aviso al escribirlo cuesta un
 * minuto; descubrirlo en una auditoría costó esta sección entera.
 *
 * `title` sale de la etiqueta salvo que se pida otro: el que apunta con el
 * mouse y el que oye la pantalla merecen la misma frase.
 *
 * ── Los tamaños son del modo, no del gusto ──────────────────────────────────
 *
 * Tres, y salen de dónde se toca la pantalla: 44 px en oficina —el mínimo que
 * el propio CSS ya exige en `pointer: coarse`—, 48 en el muelle y 56 sobre la
 * cámara del lector, donde el dedo va con prisa y el sol de frente. En `rem`
 * para que crezcan con el modo del aparato.
 */

const tonos = {
  // Lo corriente: cerrar, editar, navegar.
  neutro: 'text-tinta-2 hover:text-blue-700 hover:bg-blue-50',
  // Lo que borra. El color no está en reposo: aparece al tocarlo, para que no
  // compita con la acción de al lado en una fila que se recorre de un vistazo.
  peligro: 'text-tinta-2 hover:text-peligro-500 hover:bg-peligro-50',
  // Sobre fondo oscuro o sobre la cámara: hereda el color de quien lo contiene.
  claro: 'text-current hover:bg-white/15',
}

const tamanos = {
  md: 'w-11 h-11',        // 44px — oficina
  sol: 'w-12 h-12',       // 48px — muelle e isla
  camara: 'w-14 h-14',    // 56px — encima del lector
}

export default function BotonIcono({
  children,
  etiqueta,
  titulo,
  tono = 'neutro',
  tamano = 'md',
  className = '',
  as: Como = 'button',
  ...props
}) {
  if (import.meta.env.DEV && !etiqueta) {
    console.error(
      'BotonIcono sin `etiqueta`: un ícono solo se anuncia como «botón» y quien ' +
      'usa lector de pantalla no puede saber qué hace.'
    )
  }

  return (
    <Como
      aria-label={etiqueta}
      title={titulo ?? etiqueta}
      className={classNames(
        'icono-tactil inline-flex items-center justify-center rounded-xl shrink-0',
        'transition-colors active:scale-[.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        tonos[tono],
        tamanos[tamano],
        className
      )}
      {...(Como === 'button' ? { type: props.type || 'button' } : null)}
      {...props}
    >
      {children}
    </Como>
  )
}
