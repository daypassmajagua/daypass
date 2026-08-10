# Propuesta de diseño — DayPASS como instrumento de trabajo

Para discutir antes de construir nada. Cada decisión viene con su razón operativa; las tres de
las que estoy menos seguro están al final, con lo que descarté y por qué.

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
5. **Ni `/panorama` ni `/estilo` existen**, aunque el sistema de diseño los nombra.

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

## 2 · Los diez patrones, con su API real

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

**El trabajo no es crearlos: es que las pantallas viejas los adopten** (§7, paso 8). Propongo
**un patrón nuevo, el único**: `ContadorVivo` — el número que cambia solo (§3.1). No existe nada
parecido y lo van a usar isla, muelle, franja y panorama.

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
oficina cuando el día está en operación, y `/panorama`. En el muelle el AHORA ya existe —el
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

**Ruta nueva `/panorama`, home de las dos.** El sistema de diseño ya la nombraba; nunca se
construyó y ambas caen hoy en Informes: 800 líneas y ocho filtros para responder *"¿vamos bien?"*.
Pensada para el celular primero — la directora la abre tres veces al día en la mano, no en un
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
4. **Tres enlaces profundos**: Informes · Metas · Cartera. El panorama responde; el análisis vive
   donde ya vivía.

Una cosa por pantalla: la de panorama es *"¿tengo que llamar a alguien hoy?"*. Si los cuatro
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
   agrega después como fuente para oficina/panorama sin tocar la isla.

3. **`/panorama` como ruta nueva y home de directora y gerencia.** Descarté enriquecer Informes:
   800 líneas que además suman mal la plata, y un home tiene que abrir liviano en un celular. El
   riesgo es mantener una pantalla más; la mitigación es que se compone solo de patrones
   existentes (FranjaDia + BloqueDato + TarjetaPendiente) — y si los patrones no alcanzan para
   armarla, eso también me habrá dicho algo que necesito saber del sistema.

---

## 7 · Orden de construcción (después del visto bueno)

1. **La capa de respuesta** — sonidos WebAudio + las 4 animaciones + `ContadorVivo`. Pequeña y
   desbloquea todo lo demás.
2. **El lector QR continuo** con los cuatro veredictos.
3. **En la isla ahora** (isla + franja + su prueba con eventos derivados).
4. **El modo llega a Embarque e Isla** (unidades relativas — el paso más delicado: son las
   pantallas del día a día).
5. **`/panorama`** con los patrones.
6. **Hoy retocado** — acción en la franja, orden de pendientes, dinero por modo.
7. **La barra a cinco entradas** (§9) — el panel «Todo» agrupado por frecuencia, la píldora del
   activo, y la búsqueda global. Va aquí y no antes porque `/panorama` cambia a dónde entran la
   directora y gerencia, y no tiene sentido reorganizar el menú dos veces.
8. **`/estilo`** — tokens, primitivos y patrones en los tres modos, solo super_admin.
9. **Las tablas viejas adoptan los patrones** — ListadoDia, Historial, Folios con `ListaDelDia` e
   `InsigniaEstado`; Informes se parte y **se corrige `total_calculado` → `valor_a_cobrar()`**.

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

## 9 · La barra superior, y el problema que esconde

Revisando un segundo tablero (una app de fitness) apareció lo que de verdad hay que arreglar, y
no es el estilo de la barra: **es cuántas entradas tiene.**

Su barra lleva **seis**. La nuestra, para la directora, lleva **dieciséis** — lo confirma la
prueba de roles: *directora → 16 secciones*. Por eso el menú completo solo cabe desde 1536 px y
por debajo se esconde en un cajón táctil. En seis sesiones agregamos Cartera, Clientes, Metas y
Reportes, y el menú creció una entrada por cada una, en línea recta.

**No es un problema de barra: es de arquitectura de información.**

### La decisión: cinco visibles, una puerta

La barra lleva **el día**: `Hoy · El día · Nueva reserva · Embarque` (o `Isla`, según el modo del
aparato). Un botón **Todo** abre un panel con lo demás agrupado en tres columnas —**Operación ·
Negocio · Ajustes**— por *cuándo se usa*, no por *qué es*.

El criterio que lo gobierna: **lo que se toca todos los días está a un toque; lo que se toca cada
mes está a dos.** Hoy Configuración y Nueva reserva pesan igual en la barra, y una se usa cuarenta
veces al día y la otra cuatro veces al año.

Esto **no toca `navegacion.js` como fuente de verdad** — cada rol sigue viendo solo lo suyo. Lo
que se agrega es una capa de frecuencia sobre esa lista: qué sube a la barra y qué vive detrás de
la puerta.

### Lo que se toma de esa referencia

- **La píldora sólida del activo.** El suyo es un bloque de color; el nuestro es blanco al 20 %
  sobre navy, más tímido de lo que debería. Saber dónde estás no debería costar una segunda
  mirada.
- **El grupo de la derecha: buscar · avisos · avatar.** Reserva el sitio de las notificaciones,
  que llegan en la Fase 6.
- **Búsqueda global**, que hoy no existe. Para encontrar una reserva hay que ir a Historial y
  filtrar; Daniela con el teléfono en la oreja necesita escribir «Herrera» desde donde esté. Es
  función nueva, no adorno, y entra al orden de construcción.

### Lo que no

- **El saludo y el banner promocional.** Ocupan el tercio superior sin decir nada. En una
  herramienta de trabajo ese es el espacio más caro de la pantalla.
- **Las tarjetas en pasteles decorativos.** Nuestros colores tienen significado fijo: si una
  tarjeta es lavanda porque sí, el día que algo esté pendiente el coral ya no grita.
- **Las minigráficas bajo cada indicador.** Una curva de siete días bajo «personas hoy» no cambia
  ninguna decisión a las 7 de la noche.
- **La barra clara.** La nuestra sigue oscura: separa el marco del contenido y hace evidente que
  en modo muelle **no hay barra**. Esa ausencia tiene que sentirse como decisión, no como pérdida.

Cada paso con la verificación de siempre: 162+ pruebas, humo 13/13, roles 6/6, eslint estable.
