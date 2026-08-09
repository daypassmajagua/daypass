import { useMemo } from 'react'
import Select from './Select'

/**
 * Una hora de la operación, en cuartos.
 *
 * Faltaba: la hora de zarpe y el cierre de cocina se elegían con
 * `<input type="time">`, que en el iPad abre la rueda de iOS — lo mismo que la
 * regla 7 evita para los dropdowns, y por la misma razón: no se parece a nada
 * más de la app y en pantalla táctil es incómoda.
 *
 * **En cuartos de hora a propósito.** Las horas de esta operación son 8:30 y
 * 3:30; nadie va a poner el zarpe a las 8:37. Una lista corta de horas
 * plausibles se elige de un vistazo, mientras que un campo libre invita a
 * escribir cualquier cosa y a equivocarse por un dígito.
 *
 * Guarda y recibe `HH:MM` de 24 horas, que es lo que espera la base; muestra
 * 12 horas con a.m./p.m., que es como se habla.
 */

function aDoce(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const sufijo = h < 12 ? 'a.m.' : 'p.m.'
  const doce = h % 12 === 0 ? 12 : h % 12
  return `${doce}:${String(m).padStart(2, '0')} ${sufijo}`
}

export default function SelectorHora({
  label,
  value,
  onChange,
  desde = 5,
  hasta = 20,
  size = 'md',
  className = '',
}) {
  const opciones = useMemo(() => {
    const lista = []
    for (let h = desde; h <= hasta; h++) {
      for (const m of [0, 15, 30, 45]) {
        const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        lista.push({ value: v, label: aDoce(v) })
      }
    }
    return lista
  }, [desde, hasta])

  // Una hora guardada fuera de los cuartos —o fuera del rango— no se pierde ni
  // se redondea en silencio: se agrega a la lista para que se vea tal cual.
  const normalizada = (value || '').slice(0, 5)
  const todas = normalizada && !opciones.some(o => o.value === normalizada)
    ? [{ value: normalizada, label: aDoce(normalizada) }, ...opciones]
    : opciones

  return (
    <Select
      label={label}
      value={normalizada}
      onChange={onChange}
      options={todas}
      size={size}
      className={className}
    />
  )
}
