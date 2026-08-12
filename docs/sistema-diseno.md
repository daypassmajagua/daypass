# DayPASS — Arquitectura del sistema de diseño

Cómo estructurar la base visual para que la plataforma crezca sin degradarse. No es sobre cómo se
ve una pantalla: es sobre qué hace que todas las pantallas se vean como el mismo producto.

---

## 1. El diagnóstico

Hoy hay dos capas: **tokens** (colores, Manrope, escala) y **primitivos** (`ui/Button`,
`ui/Input`, `ui/Card`, `ui/Select`, `ui/DatePicker`…). Están bien resueltas.

Falta la capa del medio, y su ausencia ya cobró: `Config.jsx` e `Informes.jsx` tienen **~99 clases
`gray-*` y 20 colores hex escritos a mano**. No pasó por descuido — pasó porque cuando alguien
arma una pantalla nueva y no existe un patrón para "listado con filtros", lo inventa. Y cada
invención se aleja un poco más.

```
Tokens        colores · tipografía · espaciado · modos          — existe
Primitivos    Button · Input · Card · Badge · Select · Modal    — existe
Patrones      — ESTA FALTA
Páginas       Hoy · Reserva · Cerrar · Embarque · Isla…         — existen
```

**Un patrón es una página a medio armar.** No es un botón: es "cómo se ve un listado del día",
"cómo se ve un bloque de pendientes", "cómo se ve una sección de formulario". Con esa capa, una
pantalla nueva se compone; sin ella, se improvisa.

---

## 2. Los tres modos, como contexto y no como CSS suelto

Oficina, muelle e isla no son tamaños de pantalla: son **situaciones de uso**. Conviene que vivan
en un `ModoProvider` del que dependan densidad, tipografía base y tamaño de objetivos.

| | Oficina | Muelle | Isla |
|---|---|---|---|
| Dispositivo | Computador | iPad horizontal | Tablet o celular |
| Postura | Sentada, con tiempo | De pie, una mano, sol | De paso, mirando |
| Base tipográfica | 16 px | 18 px | 20 px |
| Altura de fila | 44 px | 64 px | 56 px |
| Navegación | Completa | **Ninguna** | Mínima |
| Dinero en pantalla | Sí | **Nunca** | **Nunca** |
| Densidad | Alta | Baja | Media |

**El modo se marca por dispositivo, no por usuario ni por sesión.** El iPad del muelle se
configura una vez y abre siempre así; desde un computador el modo muelle no existe. Salir del modo
muelle pide confirmación.

Y la razón de fondo por la que el muelle no muestra dinero no es de permisos: **es que la pantalla
la ven el pasajero, el guía y la fila.** Discreción física, no control de acceso.

---

## 3. El shell

Una sola estructura para todas las pantallas de oficina, para que nadie invente layout:

```
┌─────────────────────────────────────────────┐
│ FranjaDia   estado del día · quién · dónde  │  ← siempre, nunca se esconde
├─────────────────────────────────────────────┤
│ Navbar      solo lo que el rol puede usar   │
├─────────────────────────────────────────────┤
│ PageHeader  título · acción principal       │
│                                             │
│ Contenido   .marco  ·  .marco-lectura       │
│                                             │
└─────────────────────────────────────────────┘
```

**El ancho vive en dos clases y en ningún otro sitio.** Decía «máximo 1200,
centrado» y ninguna pantalla lo cumplía: había **seis anchos distintos** —768,
896, 1024, 1152 y 1280— repartidos entre veinte pantallas, y «Hoy» usaba dos
según si estaba cargando o ya tenía datos. En un monitor de 1920, Reservas
dejaba 640 px vacíos y Hoy 1024: más de la mitad de la pantalla sin usar.

- **`.marco`** (1800) — lo que se opera: listas, tablas, tableros, catálogos.
  Aquí el ancho **sí** es mejor: una tabla de diez columnas apretada se lee en
  zigzag, y el día de la coordinadora pasa en esa tabla.
- **`.marco-lectura`** (60rem) — lo que se llena y lo que se lee: el formulario
  de la reserva, los mensajes, la bitácora. Aquí el ancho **empeora**: una
  línea de 1800 px hace perder el renglón al volver, y un campo de 1800 px no
  se llena más rápido.

Y una consecuencia que solo se vio al mirarlo: **lo que se estira hay que
recomponerlo, no solo ensancharlo.** Los pendientes de «Hoy» quedaron con el
problema a la izquierda y su botón a metro y medio a la derecha; pasaron a dos
columnas, que aprovecha el ancho y devuelve cada pendiente a un golpe de vista.

La franja del día es la firma del sistema: dice siempre en qué fecha estás, en qué estado está el
día y si hay algo sin guardar. Es lo que hace que nadie se pierda.

En modo muelle el shell se reduce a la franja y el contenido. Sin navbar, sin header.

---

## 4. Los patrones que hay que crear

Ocho. Con estos ocho se arma cualquier pantalla del sistema, incluidas Config e Informes.

**`ListaDelDia`** — el patrón más usado. Filas con estado, acción secundaria en línea, y su propio
vacío. Lo usan el listado del día, folios, llegadas y embarque.

**`TarjetaPendiente`** — lo que ya funciona en "Hoy": qué falta, por qué importa, y el botón que
lo resuelve. Reutilizable en el cierre, en la isla y en el panorama de la directora.

**`BloqueDato`** — un número grande con su etiqueta y su comparación. Es la unidad de Informes, de
Panorama y de Resultados. Con números tabulares, siempre.

**`SeccionFormulario`** — título, descripción breve y campos. Con esto, Reserva y Config dejan de
verse distintas.

**`FiltroBarra`** — filtros como fichas seleccionables, no como fila de selects. Informes tiene
ocho filtros y hoy se ven como un panel de administración.

**`EstadoVacio`** — ilustración de línea, frase que invita y el botón ahí mismo. Obligatorio en
toda pantalla que liste algo.

**`ConfirmarAccion`** — la regla ya decidida: destructivo se deshace con toast de 8 segundos;
solo el cierre del día confirma antes. Un patrón, no una decisión por pantalla.

**`InsigniaEstado`** — el estado de una reserva o de un día, siempre con el mismo color y la misma
palabra, en tablas, gráficas y documentos impresos. Ya existen los mapas; falta el componente
único que los use.

---

## 5. Los tres estados obligatorios

Toda pantalla que traiga datos tiene tres estados, y hoy normalmente solo se diseña uno.

**Cargando** — nunca un spinner desnudo. Esqueleto con la forma del contenido y, si tarda, una
línea que diga qué está pasando.

**Vacío** — no es un error, es una invitación: *"Todavía no hay reservas para el 15 de agosto —
Crea la primera"*, con el botón. Es donde más se nota si un producto tiene carácter o es una
plantilla.

**Error** — qué pasó y cómo arreglarlo, nunca un código. Y con salida: reintentar o volver.

Regla práctica: **una pantalla no está terminada hasta que sus tres estados existen.**

---

## 6. Navegación declarativa por rol

Con ocho roles llegando, el Navbar y el `ProtectedRoute` no pueden tener cada uno su propia lista.
Una sola fuente de verdad:

```js
// navegacion.js — un solo archivo manda
{
  asesora: {
    home: '/',
    ver: ['/', '/dia', '/cerrar', '/embarque', '/folios', '/equipo', '/informes'],
  },
  admin_isla:      { home: '/isla',      ver: ['/isla', '/cocina'] },
  directora:       { home: '/panorama',  ver: [...] },
  ...
}
```

De ahí salen el menú, la redirección al entrar y la protección de rutas. **Lo que un rol no puede
usar no aparece** — nada en gris. Y el `home` es lo que hace que cada persona abra la app y vea su
trabajo, no un menú donde adivinar.

Esto es diseño, no solo código: define la primera impresión de cada usuario.

---

## 7. La página de estilo viva

Una ruta `/estilo`, visible solo para `super_admin`, que muestre en un lugar todos los tokens,
todos los primitivos y todos los patrones, en los tres modos.

Suena a lujo y es lo contrario: **es lo que impide que vuelva a pasar lo de los 99 `gray-*`.**
Cuando alguien va a armar una pantalla nueva, entra ahí, ve que el patrón existe y lo usa. Sin esa
página, no sabe qué hay y lo inventa.

Y sirve de referencia cuando entre alguien nuevo al equipo: en vez de leer código para saber qué
hay, lo ve.

---

## 8. Reglas que no se rompen

1. **Ningún color fuera de los tokens.** Nada de `gray-*` ni de hex sueltos, ni siquiera dentro de
   Recharts — las series usan la paleta arena del sistema.
2. **Los estados tienen color fijo** en toda la app: tentativa gris · confirmada azul · en la isla
   celeste · completada verde · no llegó coral · cancelada rojo. Daniela aprende el código una vez.
3. **Coral solo pendiente y tardío. Verde solo cerrado y guardado. Rojo solo error real.** Si todo
   grita, nada grita.
4. **Números tabulares siempre.** Pax, precios y contadores son el contenido principal de esta app
   y tienen que alinearse en columna.
5. **Nada de dropdowns ni datepickers nativos.** `ui/Select`, `ui/DatePicker`, `ui/DateNav`.
6. **El lenguaje es de la operación**: reserva, "guardando cambios", "Hoy". Nunca registro, sync,
   submit, dashboard, settings.
7. **Cada pantalla declara su modo.** Ninguna asume oficina por defecto.

---

## 9. Cómo aplicarlo sin rehacer todo

**Paso 1 — Extraer, no inventar.** Los ocho patrones ya existen a medias dentro de Hoy, Reserva,
Cerrar y Embarque, que son las pantallas que sí pasaron por diseño. Sacarlos de ahí a
`components/patrones/` es refactor, no diseño nuevo.

**Paso 2 — Config con los patrones extraídos.** Es la pantalla más simple de las dos pendientes y
sirve de prueba: si los ocho patrones alcanzan para armarla sin inventar nada, están bien
definidos.

**Paso 3 — Informes.** Es un solo componente de 690 líneas; se parte en `FiltroBarra`,
`BloqueDato` y las gráficas con paleta de tokens.

**Paso 4 — La página de estilo**, ya con todo extraído. Toma poco y es lo que sostiene el sistema
de ahí en adelante.

**Paso 5 — Modos como contexto**, aplicado a las pantallas de isla y muelle que ya existen.

Los pasos 1 y 2 son una sesión. El 3 es una sesión y media. Vale la pena hacerlos **antes** de la
fase de roles, porque las pantallas nuevas de esa fase (Panorama, Resultados, Llegadas) van a
nacer usando los patrones en vez de inventar tres layouts más.
