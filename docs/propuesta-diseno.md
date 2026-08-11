# Propuesta de diseño — DayPASS como instrumento de trabajo

Para discutir antes de construir nada. Cada decisión viene con su razón operativa; las tres de
las que estoy menos seguro están al final, con lo que descarté y por qué.

**Segunda versión** (10 de agosto), después de tres cosas nuevas: la arquitectura de navegación
por sustantivos, la búsqueda global como forma principal de moverse, y los perfiles con su
historia. Lo que cambió está abajo; lo que no aparece en esa lista sigue vigente tal cual.

---

## 0 · Qué cambió respecto a la primera versión

De las tres novedades, **la de navegación invalida cosas que ya había decidido** y una de ellas
la había defendido con ganas. Lo digo sin rodeos:

### Queda obsoleto

**El §9 entero — «cinco visibles y una puerta».** Había propuesto una barra con cuatro o cinco
entradas y un botón *Todo* que abría un panel en tres columnas (Operación · Negocio · Ajustes).
**Se cae completo.** Tu estructura es mejor por una razón que no había visto: yo agrupaba por
*cuándo se usa*, que es un criterio del software; tú agrupas por *qué es*, que es un criterio del
negocio. «Lanchas y pilotos» se entiende sin explicación; «Ajustes» hay que abrirlo para saber qué
tiene. Un panel de tres columnas sigue siendo un menú de dieciséis cosas, solo que plegado.

**`/panorama` como ruta y entrada de menú propia.** La defendí como el hallazgo del documento y
ya no existe como tal. En un menú de sustantivos, «Panorama» no es un sustantivo del negocio: es
el nombre que le pone el software a una pantalla. **Lo que sobrevive es el contenido**, y se
convierte en lo que «Hoy» muestra para gerencia y la directora. Un solo sustantivo, tres formas
según quién entra — que además es más coherente con el `home` por rol que ya existe.

**«Un solo patrón nuevo, `ContadorVivo`».** Ahora son **tres**: se suman `LineaDeTiempo` (§11) y
`Buscador` (§10). Los perfiles y la búsqueda no se componen con lo que hay.

**Tres pantallas que construí esta semana pierden su entrada de menú.** No se borran —el trabajo
sigue sirviendo— pero cambian de sitio:

| Pantalla | A dónde va |
|---|---|
| `/clientes` | Deja de ser una lista con buscador: **es el perfil de persona**, y se llega buscando (§10–11) |
| `/metas` | Adentro de **Informes** — son rendimiento, no una sección aparte |
| `/reportes` | Adentro de **⚙ Configuración**, que es donde vive lo ocasional |
| `/historial` | Absorbido por **Reservas**: es la misma lista con otro rango de fechas |
| `/cocina` | Adentro de **Isla**: la isla tiene dos preguntas, a qué cuenta va esto y cuántos platos |
| `/equipo`, `/usuarios`, `/config` | **⚙ Configuración**, en sus secciones |

### Se mantiene sin cambio

Todo el §3.1 (AHORA y `ContadorVivo`), el §3.2 (los retoques de Hoy), el §4 completo (el modo
muelle y el escaneo), el §5 (animación en CSS) y el §8 (qué se toma de las referencias). Nada de
lo nuevo los toca.

### Una frontera que quedó cerrada: el folio no es un perfil

Había propuesto un cuarto perfil para el folio, con sus consumos. **Los consumos no se van a
vincular a la plataforma**, así que salen del alcance por completo — no como un pendiente, sino
como una decisión.

Y sin consumos, la pregunta honesta es qué queda: a qué reserva pertenece y quiénes están dentro.
Eso **ya es la reserva**. Un perfil de folio sería la misma pantalla con otro título.

Así que el folio no tiene perfil. **El folio es un puntero, no un objeto**: un número que le dice
a la isla a qué cuenta cargarle el almuerzo a esta gente. Su trabajo entero es ese, y ya lo hace
la pantalla de isla, que existe para responder *¿a qué cuenta va esto?*.

Lo que sí conserva son dos cosas, y la segunda tiene consecuencias:

1. **Ser buscable.** Quien tenga un folio en la mano lo escribe y cae en su reserva. Buscar por
   folio es una forma de encontrar una reserva, no de abrir un folio.
2. **Quedar registrado en la actividad** de la persona, el grupo y la agencia. No como pantalla:
   **como hecho en la historia**. El día que alguien pregunte por esa cuenta, el número está donde
   se va a buscar — en la visita de esa persona, no en un sitio aparte que haya que recordar.

> **Y esto vuelve obligatorio un arreglo que había marcado como opcional.** `registros.folio_zeus`
> es un texto suelto: se sabe **que** hay folio, no **cuándo** se puso ni **quién** lo puso
> (§11.2, hueco 1). Mientras el folio era solo un dato de pantalla, eso se aguantaba. Si tiene que
> ser un evento con fecha y autor en tres historias distintas, hay que anotarlo — tres líneas del
> mismo molde de la 024, que ya anota tarifas, ajustes y cierres. **Sin eso, el evento del folio
> aparecería sin hora y sin nombre justo en el producto donde acabamos de sellar la autoría de
> todo.**

Son cuatro perfiles menos uno: **persona, agencia y reserva**.

### Un dato de contexto que conviene corregir

Pides el menú de **ocho roles**. Son ocho valores en el enum pero **siete asignables**:
`recepcion` está retirado desde la migración 017 y la base rechaza asignarlo. Y sobre `mesero`
sigue abierta tu decisión de retirarlo (está en `docs/plan-diseno.md` §2.1), así que abajo va con
su menú y con la nota de qué pasa si se va.

---

## 1 · Mi lectura del problema

Acepto la tesis y la llevo un paso más allá: esto no es una app con tres tamaños de letra, son
**tres instrumentos distintos que comparten datos**. La libreta de la jefa de operaciones
(oficina), el tablero de embarque (muelle) y el letrero de cocina (isla). Lo que los une no es el
layout: es que dicen las cosas con las mismas palabras y los mismos colores.

**Lo que el encargo pide y ya existe.** Los ocho patrones están extraídos en
`components/patrones/` —más dos que el plan no pedía: `Esqueleto` y `EstadoError`—, el
`ProveedorModo` existe y escala la tipografía por aparato, el lector QR existe con doble
decodificador (BarcodeDetector donde hay, jsQR en el iPad), y los tres estados están en las 13
pantallas. Eso no se rehace: se termina de conectar.

**Lo que de verdad falta**, contado del código y no de memoria:

1. **El modo no llega a las dos pantallas que lo definen.** Embarque e Isla se dimensionaron a
   mano (`text-[18px]`, `min-h-[64px]`) antes de que el modo existiera. Cambiar el aparato a
   isla no las mueve.
2. **No hay capa de respuesta.** El sistema confirma con toasts —lenguaje de oficina— en las dos
   pantallas donde nadie mira la esquina superior derecha. El lector QR **se cierra al primer
   código** y el veredicto sale afuera, en un toast: la fila se detiene entre pase y pase.
3. **El dato AHORA no existe.** Nadie sabe cuántas personas hay en la isla en este momento.
4. **Dos de los diez patrones tienen cero usos** (`BloqueDato`, `InsigniaEstado`) y las cuatro
   tablas viejas de oficina (ListadoDia, Historial, Folios, Informes) no usan ninguno.
5. **No existe la vista del periodo ni `/estilo`**, aunque el sistema de diseño las nombra. (La
   del periodo pasa a ser lo que «Hoy» muestra para gerencia y la directora — §3.3.)

**Cuatro cosas que el encargo no vio y cambian decisiones:**

- **El iPad no vibra.** `navigator.vibrate` no existe en Safari de iPadOS. "Multisensorial" en
  este producto significa **color + sonido**; la vibración no se descarta por criterio, se
  descarta por plataforma.
- **El sonido en iOS nace bloqueado** hasta un gesto del usuario. Se desbloquea con el toque que
  abre el lector — un gesto que ya existe, no uno nuevo.
- **"En la isla ahora" ya es derivable sin tocar el esquema**: embarcados de ida menos
  desembarcados de regreso, todo en `embarques`, que ya baja a la copia local. La decisión no es
  de datos, es dónde calcular y cómo mostrar frescura.
- **Informes le está mintiendo a gerencia.** Suma `total_calculado` (Informes.jsx:168,183,196),
  que da un número para cortesías, alojamiento y proveedores — plata que no existe. Es la misma
  trampa que la cartera corrigió con `valor_a_cobrar()`. El tablero del periodo nace corregido, y
  arreglar Informes entra al plan.

---

## 2 · Los patrones: diez que existen y tres nuevos

Ya existen. Esto es su contrato (de las firmas actuales) y su estado de adopción:

| Patrón | API | Quién lo usa hoy |
|---|---|---|
| `ListaDelDia` | `{ items, children(item,i), clave, cargando, error, onReintentar, vacio, buscando, encabezado, separadas }` — trae sus tres estados adentro | Config, Usuarios |
| `TarjetaPendiente` | `{ pendiente }` — qué falta, por qué importa, botón que lo resuelve | Pendientes (Hoy) |
| `BloqueDato` | `{ etiqueta, valor, unidad, detalle, comparacion:{texto,delta}, tono: normal·pendiente·cerrado, tamano: md·lg }` | **nadie** |
| `SeccionFormulario` | `{ numero, titulo, porque, children }` | Config |
| `FiltroBarra` | `{ grupos:[{id,etiqueta,valor,opciones,onCambiar}], onLimpiar }` — fichas, no selects | Config |
| `EstadoVacio` | `{ icono, titulo, detalle, accion:{etiqueta,a·onClick}, buscando }` | Pendientes |
| `ConfirmarAccion` | `{ abierto, titulo, children, etiquetaConfirmar, variante, cargando, onConfirmar, onCancelar }` | Config, Usuarios |
| `InsigniaEstado` | `{ estado, tamano }` — color+palabra fijos del estado | **nadie** (las tablas usan `Badge` directo) |
| `Esqueleto` | `{ filas }` | las 13 pantallas |
| `EstadoError` | `{ error, onReintentar }` | las 13 pantallas |

**El trabajo no es crearlos: es que las pantallas viejas los adopten.**

**Tres patrones nuevos** — eran uno en la primera versión; la búsqueda y los perfiles trajeron
dos más, y ninguno se puede componer con lo que hay:

| Nuevo | Qué es | Dónde |
|---|---|---|
| `ContadorVivo` | el número que cambia solo (§3.1) | isla · muelle · franja · Hoy de gerencia |
| `LineaDeTiempo` | `{ eventos:[{cuando,tipo,texto,quien,motivo,destacado}], agruparPor: 'dia'·'mes'·'anio', desde }` (§11.1) | los tres perfiles |
| `Buscador` | `{ grupos:[{id,titulo,buscar(texto),fila}], abierto, onCerrar }` (§10) | el encabezado, en toda la app de oficina |

`LineaDeTiempo` recibe eventos **ya normalizados** y no sabe de dónde salieron. Es lo que permite
construirla hoy con lo que existe y enchufarle fuentes después sin rediseñarla.

---

## 3 · Los tres horizontes

### 3.1 · AHORA — isla y muelle

**El dato nuevo: "En la isla ahora · 34".** Se calcula **en el aparato**, con los mismos eventos
derivados que ya usa el muelle (`check_in`/`walk_in` de ida − `desembarque` de regreso), alimentado
por Realtime y por la copia local cuando no hay señal. No es una vista SQL a propósito: el número
se necesita en la isla sin señal, exactamente donde el servidor no está. Cuando la copia tiene
edad, el número lo dice: *"hace 12 min"* — un número viejo que se sabe viejo es información; uno
viejo que parece fresco es una mentira.

**Cómo se ve un número que cambia solo sin parecer un error** (el patrón `ContadorVivo`):

- **Nunca cambia de posición ni de tamaño.** Lo que se mueve de lugar parece roto.
- El cambio es un **tic de contador mecánico**: el dígito viejo sube 4px y se desvanece mientras
  el nuevo entra — 140ms. Es el gesto que la gente ya asocia con "esto cuenta en vivo".
- Un **destello de fondo** `mar-50` que decae en 700ms dice "acaba de pasar" a la visión
  periférica, sin exigir mirada. Mar y no coral ni verde: esos colores tienen significado fijo y
  un destello con ellos mentiría.
- Cambios en ráfaga se **agrupan** (300ms): cuando bajan veinte personas, el número salta una
  vez, no veinte.
- Con `prefers-reduced-motion`: solo el destello, sin desplazamiento.

Dónde vive: encabezado de `/isla` (el dato principal de esa pantalla), la franja del día en
oficina cuando el día está en operación, y el «Hoy» de gerencia. En el muelle el AHORA ya existe —el
contador embarcados/esperados y el "faltan N" del regreso— y se queda; solo gana el tic.

### 3.2 · HOY — la asesora

La estructura actual de `/` es correcta y no se rehace: la frase del día, los pendientes
accionables, la lista. Tres retoques con ojos nuevos:

1. **La acción del momento vive en la franja del día.** La franja ya cambia de color por estado;
   ahora también ofrece el verbo que toca: *planeando* desde media tarde → **Cerrar el día**;
   *tentativo cerrado* en la mañana → **Embarque**; *en operación* → **Regreso**. Daniela no
   navega a su siguiente tarea: la franja se la acerca. No es magia temporal — es el estado del
   día, que ya gobierna la franja, gobernando también el botón.
2. **Los pendientes se ordenan por lo que detiene el zarpe**, no por tipo: sin pago informa,
   sin nombres detiene un manifiesto.
3. **Hoy respeta el modo del aparato**: si el iPad está en modo muelle o isla, los números de
   plata no se pintan (`useMuestraDinero`, que existe y nadie consume). La pantalla la ve la fila.

### 3.3 · EL PERIODO — directora y gerencia

> **Cambió en la segunda versión.** Era una ruta nueva, `/panorama`, con su entrada de menú. En un
> menú de sustantivos del negocio eso no cabe: «Panorama» es el nombre que le pone el software a
> una pantalla, no algo que exista en la operación. **El contenido sobrevive entero y se convierte
> en lo que «Hoy» muestra para gerencia y la directora.** Un solo sustantivo con tres formas según
> quién entra, que además es lo que el `home` por rol ya hacía.

Pensado para el celular primero — la directora lo abre tres veces al día en la mano, no en un
monitor.

De arriba a abajo:

1. **La franja del día** — también a ellas les importa a qué hora salió la lancha, quién está en
   turno y cuántos hay en la isla ahora. Misma franja, sin rediseño.
2. **Un `BloqueDato` dominante y tres de apoyo** — no cuatro iguales.

   > **Corregido después de mirar una referencia.** Había propuesto los cuatro del mismo tamaño,
   > que es el error del tablero de call center que revisamos: sus cuatro indicadores pesan igual
   > y por eso ninguno es la respuesta. Contradecía lo que este mismo documento defiende —*una
   > cosa por pantalla*—. `BloqueDato` ya trae `tamano: md·lg`, así que la jerarquía es
   > composición, no API nueva.

   **La meta** en `lg`, a todo el ancho: para gerencia la pregunta es una sola y es esa. Verde
   solo si ya se cumplió. Debajo, en `md`: **Hoy** (pax contra el promedio) · **El periodo**
   (ingresos con `valor_a_cobrar()`, nunca `total_calculado`) · **Cartera vencida** (>90 días;
   coral solo si hay).
3. **Pendientes de negocio** como `TarjetaPendiente`, solo si existen: *"quedan 30 tiquetes y
   mañana van 87"*, *"2 reservas de agencia sin nombres y zarpan mañana"*.
4. **Dos enlaces profundos**: Informes y Cartera — los dos sustantivos que sí están en su menú.
   (Metas dejó de ser un tercero: vive dentro de Informes.) Este «Hoy» responde; el análisis vive
   donde ya vivía.

Una cosa por pantalla: la de este «Hoy» es *"¿tengo que llamar a alguien hoy?"*. Si los cuatro
bloques están quietos, la respuesta es no, y eso se ve en dos segundos.

---

## 4 · El modo muelle, como si fuera lo único que existe

La pantalla ya tiene la estructura correcta (sin navegación, sin dinero, filas de 64px, paleta
`sol` de alto contraste). Lo que decido encima:

**Confirmar sin mirar.** Tres canales, en este orden y con esta jerarquía:
1. **El color de la fila cambia en 0ms.** Estado primero, adorno después, siempre.
2. **El contador grande hace tic.** Es lo que la visión periférica capta con el pulgar todavía en
   la pantalla.
3. **Un tic sonoro de 60ms.** El canal de respaldo para cuando ni siquiera hay visión periférica.

**La mano que tiembla.** No hay diálogos de confirmación en el muelle — noventa segundos por
lancha no los aguantan. El error se corrige, no se previene: deshacer de 8 segundos (ya existe) y
objetivos de fila completa con 8px de separación. `touch-action: manipulation` ya mata el
doble-tap zoom.

**El sol.** Los estados del muelle se dicen con **relleno completo de fila**, nunca con matices:
verde de fila entera para embarcado (verde = hecho y guardado, coherente con la regla), alarma
para los faltantes del regreso. Un matiz al 20% de opacidad no existe a mediodía en La Bodeguita.

**El cierre siempre a la vista.** El botón de cerrar el zarpe vive fijo abajo con lo que le falta
al manifiesto en palabras (*"sin piloto · 3 sin nombre"* — la lógica ya existe, se ancla). Nunca
un cierre sorpresa: se ve venir desde el primer embarque.

**Pendiente técnico que este plan asume:** pasar Embarque e Isla a unidades relativas para que
respondan al modo (la deuda D3.1 ya reconocida).

### El escaneo, en detalle

Hoy el lector se cierra al primer código y el veredicto sale en un toast, afuera. Eso se rehace:

- **Escaneo continuo.** El lector no se cierra al leer: muestra el veredicto y sigue mirando. El
  mismo token tiene un silencio de 1.5s para no re-dispararse; el siguiente pase entra de
  inmediato. Es una fila avanzando, no un trámite por persona.
- **El veredicto es una franja inferior grande dentro del lector**, con cuatro estados:

| Veredicto | Color | Sonido | Texto |
|---|---|---|---|
| **Válido** | verde, franja llena | beep agudo corto (880Hz·80ms) | El nombre del grupo, GRANDE — el pasajero ve su nombre y la fila se calma |
| **Ya embarcado** | aviso | doble beep medio | *"Ya subió · 8:14"* — información, no regaño |
| **Otra fecha** | alarma | tono grave 300ms | *"Es del 15 de agosto"* + botón Buscar por nombre |
| **No encontrado** | sol-tinta | tono grave | *"No es de hoy. Búscalo por el nombre."* |

- **Los sonidos se sintetizan** con WebAudio — dos frecuencias, tres patrones, cero archivos,
  funciona offline. Se desbloquean con el gesto de abrir el lector. **Interruptor de silencio**
  en el lector, persistente por aparato: hay muelles ruidosos y hay madrugadas.
- **Vibración: no.** No existe en iPadOS. Si algún día hay un Android en el muelle, es una línea.
- **"Buscar por nombre" fijo abajo del lector, siempre** — hoy solo aparece cuando la cámara
  falla. El QR va a fallar con el pase arrugado y el sol de frente, y ese fallo no puede costar
  más que un toque.
- Al cerrar el lector tras un válido, el grupo queda filtrado y resaltado (ya pasa hoy). El QR
  dice quién es, no cuántos suben: embarcar sigue siendo un toque de la persona del muelle, por
  regla.

---

## 5 · Animación: CSS puro, cero kilobytes

**Con qué:** transitions y keyframes de CSS, ~60 líneas en `index.css`. **Descarto** framer-motion
y toda librería: son 30+ KB gzip que el iPad del muelle re-descarga con cada actualización en la
señal de La Bodeguita, para animaciones que este producto no necesita. Descarto también FLIP para
listas: las listas de DayPASS no se reordenan en vivo — llegan filas y cambian estados, que es
más simple y más barato.

**El catálogo completo, cada una con su trabajo:**

| Nombre | Qué hace | Dónde | Duración |
|---|---|---|---|
| `destello` | fondo `brand-50` → transparente: "esto acaba de llegar por Realtime" | filas nuevas en listas de oficina | 800ms |
| `tic` | el dígito viejo sube y se desvanece, el nuevo entra | ContadorVivo | 140ms |
| `eco` | onda tenue **después** del cambio de color de una fila | confirmación en muelle | 300ms |
| `aparecer` | entrada desde 8px abajo con fade | modales y tarjetas | 160ms |

**Regla dura, sin excepciones:** en el muelle el estado cambia en 0ms y la animación es eco, no
prólogo. Ninguna confirmación espera a su animación. `prefers-reduced-motion` ya apaga todo
globalmente y se queda así.

---

## 6 · Las tres decisiones de las que estoy menos seguro

1. **Sonido en el muelle.** Descarté vibración (no existe en la plataforma) y descarté
   solo-visual (falla justo cuando no se puede mirar). El riesgo real: el muelle es ruidoso y el
   altavoz del iPad apunta donde no es. Por eso el sonido nunca es el único canal, y por eso el
   interruptor. Si en la práctica no se oye, se apaga sin tocar nada más.

2. **"En la isla ahora" calculado en el aparato**, no en una vista del servidor. Descarté la
   vista SQL —canónica y siempre fresca— porque el número se necesita donde no hay señal. El
   riesgo es el drift con una copia vieja; la mitigación es que el número declara su edad y se
   recalcula al drenar la cola. Si el drift resulta inaceptable en la práctica, la vista SQL se
   agrega después como fuente para la oficina sin tocar la isla.

3. **La búsqueda como forma principal de moverse — en un celular.** `Ctrl+K` es un patrón de
   computador y de gente que usa la app ocho horas; funciona para Daniela. Pero la directora abre
   esto en el celular tres veces al día, y ahí no hay atajo: hay una barra ocupando el encabezado
   permanentemente, en la pantalla más pequeña y para alguien que entra a mirar, no a buscar.
   Descarté esconderla tras un icono —un buscador que hay que encontrar deja de ser la forma de
   moverse— y descarté no ponerla en táctil —entonces el menú corto se queda sin su otra mitad—.
   Lo que no sé es si en un celular la barra estorba más de lo que sirve. **Se resuelve mirando,
   no discutiendo**: entra en el repaso en teléfono real que ya está pendiente.

> **Qué salió de esta lista.** `/panorama` estaba aquí en la primera versión y ya no: dejó de ser
> una duda porque dejó de ser una elección. Al absorberse en «Hoy» no hay pantalla nueva que
> justificar ni ruta que mantener.

---

## 7 · Orden de construcción (después del visto bueno)

> **El orden cambió.** La navegación pasó del puesto 7 al 2, y arrastró con ella a la búsqueda y
> los perfiles. La razón: **cinco de los pasos que venían después mueven pantallas de sitio**, y
> hacerlo antes de reorganizar el menú significa moverlas dos veces. Reordenar primero también
> deja ver enseguida si la estructura nueva aguanta.

1. ✅ **La capa de respuesta** — sonidos WebAudio + las 4 animaciones + `ContadorVivo`. *(hecho)*
2. ✅ **El lector QR continuo** con los cuatro veredictos. Va aquí porque estrena la capa anterior
   y no depende de nada de lo demás. *(hecho)*
3. ✅ **La navegación nueva** (§9) — siete sustantivos, Configuración con secciones, y los siete
   menús por rol. Es el paso que reacomoda las pantallas que ya existen; después de esto nada
   vuelve a cambiar de sitio. *(hecho)*
> **La ficha se adelantó a la búsqueda, y no por gusto.** Buscar «Gold» tiene que llevar a algún
> lado, y ese lado es la ficha del plan. Construir el buscador antes sería construir una puerta
> antes que el cuarto. Además el patrón `Ficha` + `LineaDeTiempo` sirve para los seis casos —
> persona, agencia, reserva, plan, lancha, empleado— así que se hace una vez y se usa seis.

4. ✅ **`Ficha` y `LineaDeTiempo`** (§10.5, §11) — el patrón, estrenado en el plan: dos columnas,
   dirección propia, barra de guardado que aparece sola, «dónde se usa» y su historia. *(hecho)*
   Tres cosas aparecieron al construirlo y quedan anotadas:
   - **Los platos no tenían pantalla.** `opciones_plato` existe desde la 007 y solo se podía
     tocar por SQL — la regla 9 vivía en la base y en ninguna interfaz. Van en la ficha del plan
     y no en una sección aparte: el plato pertenece al plan, y la estructura tiene que decirlo.
   - **La historia de tarifas tampoco.** La 024 anota `cambiar_tarifa` con el antes y el después
     de los cuatro precios; nadie lo mostraba. Ahora se lee como frases, no como JSON.
   - **`puedeVer` no sabía de fichas.** Daba falso para `/config/planes/:id` porque comparaba la
     ruta completa. Ahora una ficha hereda el permiso de su sección — quien puede ver planes
     puede ver un plan.
5. ✅ **La búsqueda global** (§10) — ya con dónde aterrizar. Encuentra personas, reservas,
   agencias, lanchas y empleados. *(hecho)* Tres cosas que cambiaron al construirla:
   - **Sin funciones nuevas en la base.** Personas ya tenía la suya; los otros tres grupos son
     `select` con `or`, que PostgREST resuelve respetando la RLS de cada tabla. Tres funciones
     nuevas serían tres puertas que hay que acordarse de cerrar en cada migración (la lección de
     la 012), a cambio de nada.
   - **Buscar por documento no funcionaba** — ni aquí ni en Clientes, desde la 020. Se digita
     «CC 1023456789» y `buscar_personas` comparaba *empieza por*, así que buscar el número no
     encontraba a nadie. Lo arregla la **029**.
   - **`/clientes/:id` ya es una dirección.** La ficha de una persona vivía en el estado de la
     pantalla; sin dirección, la búsqueda no tenía dónde aterrizar. Sigue siendo una ventana —el
     paso 6 la vuelve página— pero la dirección ya es la definitiva.
   - Los planes no entraron: se busca lo que se busca a diario, y un plan se elige en un
     desplegable al crear la reserva, no se busca. Si hace falta, es una línea.
6. ✅ **Los perfiles** (§11) — persona y reserva; agencia después. *(hecho)*

   > **Decisión del dueño: en computador, un panel que se despliega al lado.** Y no contradice
   > lo que se decidió con la ficha del plan: lo que se descartó no fue el panel, fue **el modal
   > sin dirección**. Este vive en `/clientes/:id`. La dirección es lo que lo hace un sitio; el
   > panel es lo que lo hace barato de abrir y de cerrar.

   - **`PanelLateral`**, el patrón. Entra desde la derecha en 180ms, deja la lista viva detrás y
     marca la fila abierta. Por debajo de `lg` ocupa la pantalla completa: un panel de 480px en
     un teléfono de 390 no es un panel, es una página con menos sitio. El foco entra al abrir y
     **vuelve a la fila que se tocó** al cerrar, que es lo que permite recorrer una lista con el
     teclado.
   - **El perfil de una persona** responde en su orden la pregunta que lo abre —*«esta señora que
     está llamando, ¿ya vino?»*—: cómo hablarle primero (teléfono y WhatsApp, tocables), después
     si es de casa, y al final su historia. Arriba el tiempo va relativo —«hace cuatro meses»— y
     la fecha exacta vive en la línea de tiempo, que es donde se necesita precisa.
   - **La reserva no se lleva panel, se lleva su historia.** Ya tiene página propia; abrirle un
     perfil al lado sería mantener dos sitios que muestran lo mismo. Lo que faltaba era lo que la
     base guarda desde la 003 en `cambios_estado` y nadie mostraba: cada cambio con su hora, su
     origen y quién. **Lo manual va destacado y lo del sistema no** — es la regla 3 dicha en la
     pantalla.
   - Y una que apareció al mirar: **una reserva que ya estaba en la isla mostraba
     «— Seleccionar —» en Estado**, porque el desplegable solo ofrece los dos manuales. Decía que
     no tenía estado, y el primer clic la habría sacado de la isla desde un formulario. Ahora,
     cuando el estado lo puso la operación, se muestra como dato y se dice quién lo mueve.
7. **El resto del CMS** — lancha, empleado y temporada con la misma ficha, y las tres secciones
   que faltan: **turnos primero**, porque sin ellos la Fase 6 no arranca.
8. **En la isla ahora** (isla + franja + su prueba con eventos derivados).
9. **El modo llega a Embarque e Isla** (unidades relativas — el paso más delicado: son las
   pantallas del día a día).
10. **Hoy, en sus tres formas** — la de Daniela retocada y la de gerencia/directora (§3.3).
11. **`/estilo`** — tokens, primitivos y patrones en los tres modos, solo super_admin.
12. **Las tablas viejas adoptan los patrones** — Reservas (ya con Historial adentro) y Folios con
    `ListaDelDia` e `InsigniaEstado`; Informes se parte, absorbe Metas y **se corrige
    `total_calculado` → `valor_a_cobrar()`**.

Cada paso con la verificación de siempre: pruebas en verde, humo y roles completos, eslint
estable.

---

## 8 · Referencias: qué se toma y qué no

De un tablero de analítica de call center (PulseMind), revisado el 10 de agosto.

**Se toma:**

- **Un solo acento, usado una vez por vista.** Ahí el azul aparece en tres sitios y todo lo demás
  renuncia al color. Es la prueba de que la regla de colores fijos funciona: cuando solo una cosa
  tiene color, esa cosa *es* la respuesta.
- **La gráfica apagada con una sola barra encendida.** Lo más transferible de la referencia, y va
  a Informes: hoy pintamos diez series con diez colores y ninguna manda. Una en color, el resto
  en gris de línea.
- **La ficha de comparación al lado del número**, no dentro de la misma línea. Confirma el prop
  `comparacion` de `BloqueDato`.
- **La proporción número/etiqueta de 5 a 1.** Veníamos en 2 a 1 y por eso los tableros se leen
  como tablas. El número es el contenido; la etiqueta es mueble.

**No se toma, y conviene dejar escrito por qué:**

- **Es un diseño de monitor.** Gris claro sobre blanco, filetes de un píxel, etiquetas de 12 px:
  todo eso muere a 60 cm bajo el sol. La referencia no tiene nada que decirle al muelle.
- **Tipografía delgada en tamaño grande.** Preciosa en Retina, invisible a pleno sol. Manrope 700
  no es preferencia estética: es condición de trabajo.
- **El panel lateral permanente.** Es la firma del panel de administración genérico —el fracaso
  declarado— y contradice los tres modos: el muelle y la isla no tienen navegación ninguna.
- **El saludo del encabezado.** Cero información por píxel. Daniela no necesita que la saluden.
- **Los grises.** Ese diseño está construido sobre `gray-*`; nosotros acabamos de sacar 155 del
  código y nuestro `tinta-2` es más cálido y oscuro a propósito.

---

## 9 · La navegación: sustantivos del negocio

El menú de la directora tiene **dieciséis entradas** —lo confirma la prueba de roles— y por eso
solo cabe desde 1536 px. Pero el número era el síntoma. El problema es qué lista: hoy mezcla
sustantivos del negocio («Folios», «Cartera») con funciones del software («Configuración»,
«Usuarios», «Reportes»), y las pone al mismo nivel.

### El menú, y una sola puerta abajo

```
Hoy · Reservas · Embarque · Isla · Folios · Cartera · Informes
─────────────────────────────────────────────────────────────
⚙ Configuración
```

**Siete sustantivos y un engranaje.** El engranaje va separado —abajo, solo, con línea de por
medio— porque no es un octavo destino: es otra clase de sitio. Lo diario arriba; lo ocasional,
adentro.

Dentro de Configuración, en secciones:

`Lanchas y pilotos` · `Empleados` · `Agencias y organizaciones` · `Planes, platos y tarifas` ·
`Temporadas` · `Turnos y guardias` · `Destinatarios y mensajes` · `Usuarios` ·
`Ajustes de la operación` · `Actividad`

**La salvedad de Daniela manda sobre la ubicación.** Lanchas, pilotos y empleados viven en
Configuración porque se tocan de vez en cuando, **no porque sean de otro**. Son suyos, con acceso
pleno y sin pedirle permiso a nadie — es la regla 21 y la migración 019 ya la hace cumplir en la
base. Estar guardado no es estar restringido, y la pantalla tiene que dejarlo claro: en su
Configuración esas tres secciones van de primeras.

### El menú exacto de cada rol

Siete asignables. `recepcion` está retirado (017) y no aparece.

| Rol | Menú | ⚙ Configuración |
|---|---|---|
| **super_admin** (AISA) | Hoy · Reservas · Embarque · Isla · Folios · Cartera · Informes | todas las secciones |
| **directora** | Hoy · Reservas · Embarque · Isla · Folios · Cartera · Informes | todas |
| **asesora** (Daniela) | Hoy · Reservas · Embarque · Isla · Folios · Cartera · Informes | Lanchas y pilotos · Empleados · Agencias · Turnos y guardias · Ajustes de la operación · Actividad |
| **gerencia** | Hoy · Cartera · Informes | Planes y tarifas · Temporadas · Turnos y guardias · Usuarios · Actividad |
| **asesora_comercial** | Hoy · Reservas · Embarque | Agencias |
| **admin_isla** | Hoy · Isla | — |
| **mesero** | Isla | — |

Las razones de los recortes, que es lo que importa:

- **Gerencia no ve Reservas, Embarque, Isla ni Folios.** Mira el negocio; no lo opera. Darle la
  operación diaria sería llenarle la pantalla de cosas que no va a tocar — y su «Hoy» ya trae el
  resumen del día. Sí ve tarifas y temporadas: ahí se decide la plata.
- **La asesora comercial no ve Folios ni Cartera.** Vende y puede cubrir muelle. Cobrar y
  facturar no es suyo. Sí ve Agencias en Configuración: al vender aparece la agencia que aún no
  existe, y mandarla a pedir que se la creen es exactamente el paso que este producto viene a
  quitar.
- **La isla no ve «Reservas».** Su pregunta es *quién está* y *cuántos platos*, no *qué se
  vendió*. Su «Hoy» le dice cuántos vienen y a qué hora.
- **El mesero sigue con una sola pantalla.** Si se retira (tu decisión pendiente), quien atiende
  mesas pasa a `admin_isla` y gana «Hoy» — dos entradas en vez de ninguna. Sigo pensando que
  conviene que su `home` siga siendo `/isla` sin barra, para no perder lo que hace usable esa
  pantalla.

### Lo que esto le hace a `navegacion.js`

Sigue siendo la fuente única de verdad, pero cambia de forma: de una lista plana de rutas a
**dos listas — el menú y las secciones de Configuración**. Y `RUTAS` pierde entradas, porque
Historial, Clientes, Metas, Reportes, Cocina, Equipo y Usuarios dejan de ser destinos de primer
nivel.

De Shopify se toma **la estructura, no el color**: el sistema visual v2 se mantiene tal cual —
barra oscura, paleta de tokens, la píldora sólida del activo que ya había propuesto.

---

## 10 · La búsqueda: escribir en vez de navegar

Con siete sustantivos arriba, **la búsqueda deja de ser un accesorio y pasa a ser la otra mitad de
la navegación**. Un menú corto solo funciona si lo que no está en el menú se alcanza escribiendo.

**Dónde vive.** `Ctrl+K` en computador, y en el encabezado permanente en táctil —donde no hay
teclado que memorizar—. En el muelle y la isla **no aparece**: esas pantallas tienen su propia
búsqueda por nombre sobre la copia local, que funciona sin señal, y meterles una barra global
sería devolverles el marco de oficina que se les quitó a propósito.

**Qué encuentra**, agrupado por tipo y en este orden:

| Grupo | Qué se escribe | Qué se ve en el resultado |
|---|---|---|
| **Personas** | nombre o documento | nombre · documento · cuántas veces vino |
| **Reservas** | titular, grupo, **folio** o fecha | titular · fecha · estado · pax · folio |
| **Agencias y organizaciones** | nombre o NIT | nombre · tipo · saldo si debe |
| **Lanchas y empleados** | nombre | nombre · si está activo |

**El folio no es un grupo aparte: es una forma de encontrar una reserva.** Quien lo tiene en la
mano lo escribe y cae en la reserva, que es lo que quería. Un grupo «Folios» con resultados que
abren la misma pantalla que el grupo «Reservas» sería el mismo destino ofrecido dos veces.

**Cómo se comporta.** Desde tres caracteres, con 250 ms de respiro entre teclas. Cada grupo
consulta por su lado y en paralelo: así uno lento no detiene a los demás, y cada uno respeta su
propia RLS sin que haya que inventar una consulta gigante que las mezcle. `Enter` abre el primer
resultado; las flechas recorren; `Esc` cierra sin dejar rastro.

**Lo que ya existe:** `buscar_personas()` (migración 020) hace exactamente esto para personas,
con el documento normalizado. Los otros cuatro grupos son funciones nuevas del mismo molde.

**Y el resultado no es un enlace a una lista filtrada: abre el perfil.** Ahí es donde esto deja
de ser una comodidad y se vuelve la forma de moverse.

---

## 10.5 · El CMS: dónde sí hace falta profundidad, y dónde no

*«Siento que le falta dinamismo y profundidad. El CMS está muy pobre.»* Tienes razón, y al ir a
mirar por qué, el diagnóstico es más específico que «falta pulir».

### Qué está pobre, exactamente

Un catálogo hoy es **una lista plana y un modal**. Eso es todo. Y de ahí salen cinco carencias
concretas:

1. **Ningún registro tiene ficha.** Un plan se edita en una ventana emergente y se cierra. No hay
   dónde ver *ese* plan: qué platos tiene, cuántas reservas lo usan, cuánto ha facturado, quién le
   cambió el precio en marzo.
2. **La historia existe y no se ve.** Desde la 024 la base guarda quién cambió cada tarifa, cada
   ajuste y cada cierre — con fecha, nombre y el valor anterior. **Está toda ahí y no hay una sola
   pantalla que la muestre.** Es la carencia que más rabia da, porque el trabajo duro ya está.
3. **Ningún registro dice dónde se usa.** Desactivar un plan es un botón sin consecuencia visible.
   ¿Lo están usando cuarenta reservas del mes que viene? Nadie lo sabe hasta que algo falla.
4. **Los platos no tienen pantalla.** `opciones_plato` existe desde la 007 y es la regla 9 —*plato
   ≠ plan*— y **no se administra desde ninguna parte**. Hoy solo se pueden cambiar por SQL.
5. **Tres secciones prometidas no existen**: turnos y guardias, destinatarios y mensajes, y
   actividad. Las tres tienen su tabla llena y ninguna tiene dónde verse. La de guardias además
   **bloquea la Fase 6**: las notificaciones se enrutan al turno, no a la persona.

### Lo que propongo: el CMS son perfiles, no formularios

La respuesta no es agregarle funciones a los formularios. Es que **cada registro del catálogo sea
una ficha, igual que una persona o una agencia** (§11). Mismo patrón, misma `LineaDeTiempo`, mismo
encabezado con el estado y lo que falta. Un plan es una entidad del negocio con historia, no una
fila de una tabla.

```
Plan «Day Tour Gold»
├─ Datos          nombre, nivel, si incluye transporte, sus cuatro precios
├─ Platos         los de este plan, aquí y no en otro lado (regla 9)
├─ Dónde se usa   47 reservas · 12 este mes · última el 9 de agosto
└─ Historia       «Rafael subió el precio de adulto alta de 380.000 a 398.889 · 3 jul»
```

Eso mismo, con su propio contenido, para lancha, piloto, empleado, agencia y temporada. Es
**profundidad de contexto**: la que convierte un catálogo en algo que se consulta y no solo se
edita.

Y una consecuencia que me gusta: **el CMS y los perfiles dejan de ser dos trabajos.** `Ficha` +
`LineaDeTiempo` sirven para persona, agencia, reserva, plan, lancha y empleado. Un patrón, seis
usos.

### Lo que NO voy a hacer, y aquí te discuto

«Como un gran SaaS» tiene una lectura que sería un error seguir. Un admin de Shopify o de Stripe
trae acciones masivas, paginación, columnas configurables, importación por CSV, filtros guardados.
**Nada de eso sirve aquí y todo estorba**, por una razón que está en las reglas del proyecto:

> *«Volumen real: 20–35 pax en un día típico… **Diseña para claridad y velocidad de uso, no para
> escala.**»*

Hay **seis lanchas**, unos pocos pilotos, una docena de planes. Paginar doce planes es agregar un
control que nunca se usa; una casilla de selección múltiple sobre seis lanchas es ruido con forma
de función. Y el peor: importar catálogos por CSV, que suena a robustez y en la práctica es una vía
para meter datos sucios sin las validaciones que la base sí hace.

**Robusto aquí no significa «más controles». Significa que cada dato diga de dónde viene, quién lo
tocó y qué se rompe si lo cambio.** Un SaaS grande necesita herramientas de volumen porque tiene
volumen; nosotros necesitamos herramientas de consecuencia porque cada dato mueve una lancha.

Lo que sí tomo de un SaaS grande, porque sirve a cualquier escala: **buscar dentro de cada lista**
(útil desde diez elementos), **la ficha por registro**, **el rastro de cambios** y **«dónde se
usa» antes de desactivar algo**.

### Qué se toma de Shopify, en concreto

Ya tomamos su estructura de navegación (§9). Para el CMS, lo que sirve es su **modelo de
profundidad**, que son cinco movidas específicas:

**1. Ficha con dirección propia, nunca un modal.** Shopify jamás edita un producto en una ventana
emergente: abre `/products/:id`, una página entera que se puede compartir y volver a abrir. Eso es
lo que hoy nos falta y es lo que más cambia la sensación de «producto pobre» a «producto serio».
Y tiene una consecuencia práctica: **la búsqueda necesita dónde aterrizar**. Sin ficha con
dirección, buscar «Gold» no puede llevar a ninguna parte.

**2. Dos columnas: lo que la cosa ES, y en qué estado está.** La columna principal lleva el
contenido editable; el riel derecho lleva el estado, la clasificación y las consecuencias. Para un
plan: a la izquierda nombre, nivel, precios y **sus platos**; a la derecha si está activo, a qué
temporada aplica y **dónde se usa**.

**3. La barra de guardado que aparece sola.** Cuando hay cambios sin guardar, Shopify baja una
barra arriba: *cambios sin guardar · Descartar · Guardar*. Es exactamente el mismo principio que
acabamos de aplicar al indicador de sincronización —**el silencio es el estado sano, la barra
aparece cuando hay algo que decir**— y confirma que ese cambio iba en la dirección correcta.

Y trae una decisión de fondo: **una tarifa no se guarda sola.** Casi todo en DayPASS guarda al
instante, y está bien: marcar un embarque tiene que ser un toque. Pero cambiar un precio merece un
acto deliberado, con su descarte a la mano.

**4. El estado dice su consecuencia, no su nombre.** Shopify no dice «Draft»: dice *este producto
está oculto de todos los canales de venta*. Nuestro interruptor activo/inactivo hoy no dice nada.
Debería decir: *no se puede elegir en reservas nuevas; las 47 que ya lo usan no cambian*.

**5. Cada fila de la lista dice algo.** Una fila de producto en Shopify trae imagen, título,
estado, inventario y tipo. Las nuestras traen nombre y una línea. Un plan puede decir: nivel,
precio de temporada alta, y cuántas reservas lo usan. Eso es densidad con sentido, que es lo
contrario de una lista pobre.

**Lo que sigue sin entrar** —y esto no cambia con la referencia— son las herramientas de volumen:
acciones masivas, paginación, importar por CSV, vistas de filtro guardadas. Shopify las tiene
porque una tienda maneja diez mil productos; nosotros manejamos seis lanchas. Tomar su profundidad
sin tomar su volumen es lo que hace que la referencia sirva en vez de disfrazar.

### Las tres secciones que faltan

- **Turnos y guardias.** La tabla y sus permisos existen desde la 015 —la isla la asigna la
  dirección; embarque y recibimiento se los reparten las asesoras— y no hay pantalla. Un
  calendario del mes, un toque por día. **Va antes que las otras dos**: sin turnos no hay a quién
  notificar, y eso es la Fase 6 entera.
- **Destinatarios y mensajes.** `organizacion_correos` existe desde la 020. Es donde el manifiesto
  sabe a qué correo de la Capitanía sale.
- **Actividad.** La bitácora completa, filtrable por acción y por persona. Es la vista general de
  lo que las fichas muestran por registro.

---

## 11 · Los perfiles: una historia, no una ficha

Tres perfiles —persona, agencia y reserva— con una regla común: **arriba va el estado y lo que
falta; abajo, la historia.**
Quien abre un perfil casi nunca quiere leerlo entero — quiere saber en qué va, y solo baja cuando
algo no cuadra.

### 11.1 · La línea de tiempo, en detalle

Es el patrón nuevo `LineaDeTiempo` y gobierna los tres perfiles.

**Qué se ve primero.** No el primer evento: **el estado actual como encabezado**, en una frase.
*«En la isla desde las 8:34»*. Debajo, si falta algo, un `TarjetaPendiente` en coral. Y solo
entonces empiezan los eventos.

Una línea de tiempo que arranca por «Reserva creada el 3 de agosto» obliga a leer doce filas para
llegar a lo único que se preguntó al abrirla.

**En qué orden.** **Lo más reciente arriba.** La pregunta que trae a alguien a un perfil es casi
siempre *qué pasó ahora* o *por qué está así*, y la respuesta está al final de la historia, no al
principio.

**Cómo se agrupa lo viejo.**

- **Una reserva** cabe entera: son diez o veinte eventos. Se agrupan **por día**, con la fecha
  como encabezado y los eventos del día debajo. Sin plegar nada: plegar veinte filas es esconder
  lo que no estorba.
- **Una persona** con cuatro años son cien visitas. Se agrupan **por año**, con el año en curso
  abierto y los anteriores plegados, cada uno con su resumen en el encabezado: *«2025 — 7 visitas
  · $4.2 M»*. Se abre el año que interese.
- **Una agencia** igual, pero por mes dentro del año.

**Qué se destaca, y qué no.** Solo dos cosas rompen el gris de la lista:

1. **Lo que alguien hizo a mano** — un cambio de estado manual, una cortesía autorizada, un pago
   anulado. Son las excepciones auditadas de la regla 3, y son justamente por las que alguien
   abre un perfil a preguntar. Van con el motivo que se escribió, en línea.
2. **Lo que pasó después del cierre** — el `cambio_tardio`, en coral. La cocina y la isla ya
   habían trabajado con la versión anterior.

Todo lo demás —creada, nombres, firma, embarque, regreso— es la historia normal y se ve como
historia normal. **Si todo se destaca, nada se destaca**, que es la regla 3 del sistema visual
aplicada a una lista.

**Cada evento dice quién.** Hora · qué pasó · quién lo hizo. Es la regla 24 y la migración 024
acaba de hacerla real.

**Y aquí hay una consecuencia incómoda que hay que diseñar, no esconder.** La firma de autoría
existe **desde la 024 en adelante**. Todo lo anterior tiene autor nulo, y no se puede inventar.
La línea de tiempo lo dice con una separación explícita —*«De aquí para atrás no se guardaba
quién»*— en vez de mostrar decenas de eventos con el autor en blanco, que parecería un error del
sistema. Un vacío explicado es información; uno silencioso es un defecto.

### 11.2 · De dónde sale cada evento, y qué falta

**Ya existe hoy** (la capa 1, construible sin esperar nada):

| Evento | Fuente |
|---|---|
| Creada | `registros.created_at` + `generada_por` |
| Nombres cargados | `pasajeros.created_at` |
| Check-in | `registros.check_in_at` |
| Firma | `firmas.firmado_at` + `firmante_nombre` |
| Cambio de estado | `cambios_estado` — con `motivo` y `origen` |
| Embarque y desembarque | `embarques.ocurrido_at` + `registrado_por` |
| Pago y anulación | `pagos` (023) + `bitacora` |
| Cambio tras el cierre | `registros.cambio_tardio_at` + motivo |
| Acciones sensibles | `bitacora` (024) |
| **Folio asignado** | `registros.folio_zeus` — **el número sí; la hora y el autor, cuando se anote** |

**Tres huecos que encontré al diseñar esto**, y ninguno es grave pero conviene saberlos:

1. **El folio no tiene cuándo ni quién.** `registros.folio_zeus` es un texto suelto. **Deja de ser
   opcional** (§0): si el folio tiene que aparecer como evento en la historia de la persona, el
   grupo y la agencia, necesita fecha y autor. Se arregla anotándolo en la bitácora cuando cambia
   —tres líneas del mismo molde de la 024— y es lo único de esta propuesta que exige migración.
2. **El enlace abierto no tiene cuándo.** `marcar_token_abierto` cambia el estado del token pero
   no guarda la hora. Saber que el cliente abrió su enlace a las 9 de la noche es justo el dato
   que dice si vale la pena llamarlo.
Los consumos no aparecen en esta lista porque **no entran**: se decidió no vincularlos (§0). La
línea de tiempo de una reserva termina en el regreso, no en la cuenta.

### 11.3 · Los tres perfiles

**Persona.** Encabezado: nombre, documento, contacto tocable, y las etiquetas —recurrente,
viaja con niños, del exterior—. Después, en un bloque aparte y antes de la historia: **restricción
alimentaria y plato habitual**, porque es lo que alguien de la isla viene a buscar y no puede
estar al final. Luego las visitas por año: **fecha · plan · agencia · folio · valor**. Y los
vínculos.

El folio va en la fila de la visita —no en una sección aparte— porque así es como se busca: nadie
pregunta «¿cuáles folios tuvo esta señora?», preguntan «la vez que vino en julio, ¿a qué cuenta
fue?».

**Agencia u organización.** Encabezado: nombre, tipo, contactos, y **si debe, cuánto y desde
cuándo** — en coral si pasa de 90 días. Después: pax y reservas por mes, ticket promedio, mix de
planes, tasa de no-show y **cumplimiento del pre-registro** —qué porcentaje de sus reservas llegó
con los nombres cargados antes del zarpe—. Esa última es la métrica que convierte una queja
recurrente en una conversación con datos. Sus reservas listadas llevan su folio, igual que en el
perfil de persona. Al final, convenios y tarifas vigentes con su historia.

**Reserva.** El perfil que más se va a abrir. Estado arriba, lo que falta, y la línea de tiempo
completa.

**El folio no tiene perfil** (§0): es un puntero a la cuenta de Zeus, y su trabajo —decirle a la
isla a qué cuenta cargar— ya lo hace la pantalla de isla. Se busca, y lleva a su reserva.

### 11.4 · Por capas, sin rediseñar después

El modelo completo de personas y organizaciones llega en el bloque 3 del plan v6 — que **ya está
construido** (migraciones 020 y 025): `personas`, `organizaciones`, `vinculos`, `etiquetas`,
`ficha_persona()`. Así que la capa 1 no es un remedo: es casi todo.

Lo que llega después se enchufa sin rediseñar porque `LineaDeTiempo` recibe **una lista de eventos
ya normalizada** —`{ cuando, tipo, texto, quien, motivo, destacado }`— y no sabe de dónde salieron.
Agregar el folio con hora o el enlace abierto es agregar una fuente, no tocar la pantalla.
