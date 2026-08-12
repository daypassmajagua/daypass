import { classNames } from '../../lib/utils'

/**
 * Una casilla que se marca.
 *
 * No existía como primitivo, así que había **dos `Casilla` distintas y con el
 * mismo nombre** —una en Config y otra en Turnos— que no eran la misma cosa ni
 * se parecían. Dos componentes homónimos en un proyecto es una colisión
 * esperando a que alguien importe el que no era.
 *
 * La etiqueta entera es el objetivo táctil, no solo el cuadrito: en un iPad
 * apuntarle a 20 px es apuntarle a nada. De ahí el `min-h` de 44 y el `<label>`
 * envolviendo, que además da el vínculo accesible sin necesidad de `id`.
 *
 * `porque` es la línea que explica la consecuencia. Marcar algo casi siempre
 * cambia lo que otra persona ve después, y esa frase es la diferencia entre una
 * casilla que se entiende y una que se marca a ver qué pasa.
 */
export default function Casilla({
  etiqueta,
  porque,
  valor,
  onChange,
  disabled = false,
  className = '',
}) {
  return (
    <label
      className={classNames(
        'flex items-start gap-2.5 min-h-[44px] py-1.5 text-[15px] text-tinta',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      <input
        type="checkbox"
        checked={!!valor}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0"
      />
      <span className="flex flex-col gap-0.5">
        <span>{etiqueta}</span>
        {porque && <span className="text-[13px] text-tinta-2">{porque}</span>}
      </span>
    </label>
  )
}
