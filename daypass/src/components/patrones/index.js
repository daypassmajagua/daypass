/**
 * Los patrones: la capa que faltaba entre los primitivos y las páginas.
 *
 *   Tokens        colores · tipografía · espaciado        index.css
 *   Primitivos    Button · Input · Card · Select…         components/ui/
 *   Patrones      ESTA CAPA                               components/patrones/
 *   Páginas       Hoy · Reserva · Cerrar · Embarque…      pages/
 *
 * Un patrón es **una página a medio armar**. No es un botón: es "cómo se ve un
 * listado del día", "cómo se ve un bloque de pendientes". Sin esta capa, quien
 * arma una pantalla nueva y no encuentra el patrón lo inventa — y cada
 * invención se aleja un poco más. Fue lo que pasó con Config e Informes, que
 * juntas acumularon 99 clases `gray-*` y 20 colores escritos a mano.
 *
 * No son diseño nuevo: salen de Hoy, Reserva y Cerrar, que son las pantallas
 * que sí pasaron por diseño. Esto es sacarlos de ahí para que se puedan
 * reutilizar.
 *
 * Embarque e Isla **no** se tocaron a propósito: son deliberadamente distintas
 * —sin barra, filas de 64 px, alto contraste para el sol— y homogeneizarlas
 * con patrones pensados para oficina sería empeorarlas. Se adaptan cuando el
 * modo sea explícito en cada una.
 */

export { default as ListaDelDia } from './ListaDelDia'
export { default as TarjetaPendiente } from './TarjetaPendiente'
export { default as BloqueDato } from './BloqueDato'
export { default as SeccionFormulario } from './SeccionFormulario'
export { default as FiltroBarra } from './FiltroBarra'
export { default as EstadoVacio } from './EstadoVacio'
export { default as ConfirmarAccion } from './ConfirmarAccion'
export { default as InsigniaEstado } from './InsigniaEstado'

// Los tres estados obligatorios de toda pantalla que traiga datos.
export { default as Esqueleto, Barra } from './Esqueleto'
export { default as EstadoError } from './EstadoError'

// El único patrón que no salió de una pantalla existente: no había nada
// parecido porque no había ningún dato que cambiara solo. Lo estrena «en la
// isla ahora» y lo van a usar la franja del día y el panorama.
export { default as ContadorVivo } from './ContadorVivo'

// Un registro deja de ser una fila y pasa a ser una página con historia. Los
// dos van juntos: la ficha es dónde vive un registro, la línea de tiempo es lo
// que le ha pasado. Los estrena el plan y los heredan persona, agencia,
// reserva, lancha y empleado.
export { default as Ficha, DondeSeUsa } from './Ficha'
export { default as LineaDeTiempo } from './LineaDeTiempo'

// El perfil que se abre al lado sin soltar la lista. Es hermano de `Ficha`,
// no su reemplazo: la ficha es para lo que se va a editar —un plan, una
// tarifa—, el panel para lo que se va a consultar y cerrar.
export { default as PanelLateral } from './PanelLateral'
