# Auditoría de usabilidad — las cuatro pantallas de oficina

Heurísticas de Krug y Nielsen sobre las pantallas que **nunca pasaron por el sistema de diseño**:
Reservas, Folios, Cartera e Informes. Son las cuatro que quedaron fuera del plan de diseño a
propósito —«riesgo sin ganancia», dije— y esa decisión ya no aplica: ahora el encargo es este.

## Puntaje

| Pantalla | Antes | Ahora | Lo que falta para 10 |
|---|---|---|---|
| **Reservas** | 5/10 | **8/10** | Los encabezados repetidos por lancha y las 162 clases fuera del sistema |
| **Folios** | 6/10 | 6/10 | El título no coincide con el menú; «2A 2N» sin explicar |
| **Cartera** | 8/10 | 8/10 | Nada grave. Once objetivos por debajo de 44 px |
| **Informes** | 5/10 | 5/10 | Ocho filtros en fila, 149 clases fuera del sistema, tarjetas de colores ajenos |

---

## Reservas — de 5 a 8

Es donde Daniela vive, y tenía los peores números: **76 objetivos de menos de 44 px** y **doce
desplegables abiertos** a la vez.

### 1 · El estado era un control, no un dato — severidad 3

Cada fila traía un desplegable abierto. Con doce reservas, doce controles activos compitiendo en
una pantalla que se abre para **leer** el día.

Y hay algo peor que el ruido. La regla 3 dice que **los estados los dispara la operación y el
cambio manual es la excepción auditada**: el muelle marca quién subió, el regreso quién bajó. Con
un desplegable por fila, la excepción era lo más fácil de hacer sin querer — un roce en el iPad y
una reserva pasaba a «no llegó».

**Ahora** el estado se muestra como lo que es, y tocarlo abre el selector. Es un clic más y está
bien: *lo que cansa no es hacer clic, es dudar* (Krug, ley 2). Un clic deliberado sobre algo que
dice «Confirmada» no cuesta nada; doce desplegables sí.

Doce controles → **uno**, y solo cuando se pide.

### 2 · `IMP.` con `EXE` — severidad 2

Una columna abreviada con valores abreviados: `SÍ · NO · EXE`. Para leer esa casilla había que
acordarse de dos cosas antes de llegar al dato. Y quien lo cobra es el muelle, con la fila
esperando.

**Ahora**: «Impuesto», y «Lo paga · No lo paga · Exento». *Clear names beat clever names.*

### 3 · Dos columnas de colores compitiendo — severidad 2, **apareció al arreglar lo anterior**

Con la abreviatura resuelta, el impuesto quedó como píldora verde/roja **al lado** de la columna de
estado, que también son píldoras de color. Dos filas de color juntas y el ojo no sabe cuál mirar.

Y el rojo mentía: en este sistema **rojo es error real y sobrecupo**. Que a alguien no se le cobre
el impuesto no es un error, es lo acordado — y ese rojo le robaba peso al coral de «No llegó», que
sí pide algo.

**Ahora** el impuesto es texto. Solo «Exento» se distingue, en gris: es la excepción.

> Vale la pena anotar cómo apareció: **no estaba en el código, estaba en el resultado.** Salió de
> mirar la captura después del primer arreglo. Ninguna lectura del archivo lo habría encontrado.

### 4 · Editar y eliminar, pegados y del mismo gris — severidad 3

Dos iconos de 26 px, sin separación, del mismo color. **El destructivo se veía igual que el
corriente y cabían los dos bajo un dedo.** En un iPad eso es borrar una reserva por error.

**Ahora**: 44 px cada uno, con aire entre ellos, y el de eliminar solo se tiñe de peligro al
tocarlo. Objetivos por debajo de 44 px: **76 → 40**.

---

## Lo que queda, por pantalla

### Reservas — para llegar a 10
- **El encabezado de la tabla se repite por cada lancha** (cuatro veces en un día normal). Es la
  misma fila de nueve títulos, cuatro veces.
- **162 usos de `gray-*`**, fuera de los tokens del sistema. No es cosmético: son grises que no
  responden al modo del aparato ni a los tokens, así que esta pantalla no cambia con el iPad.

### Folios — 6/10
- **Falla el trunk test**: el menú dice «Folios» y el título dice «Listado para Folios Zeus». El
  título de una página tiene que coincidir con el enlace que se tocó.
- **`2A 2N`** sin explicar, y **`Imp: …`** abreviado (ya corregido a «Impuesto»).
- El título se parte en dos líneas y empuja el botón a una segunda fila desalineada.

### Cartera — 8/10
La mejor de las cuatro: cero clases fuera del sistema, jerarquía clara. Solo once objetivos
pequeños.

### Informes — 5/10
- **Ocho filtros en fila** — es lo que hace que parezca panel de administración y no herramienta.
  El patrón `FiltroBarra` existe justo para esto y esta pantalla no lo usa.
- **149 usos de `gray-*`** y una paleta propia (`#0d9488`, `#c2703f`…) que no sale de los tokens.
- 800 líneas en un solo componente.

---

## Lo que NO se tocó, y por qué

**Informes no se rehízo.** Es el trabajo más grande de los cuatro y arrastra la partición del
componente, que ya decidimos dejar aparte. Meterlo aquí sería mezclar un cambio de forma con uno de
estructura y hacer imposible revisar cualquiera de los dos.

**El «0/2» en coral y el «Sin folio» en ámbar se quedan** aunque aparezcan en casi toda fila. No es
ruido: es el estado real del día a las siete de la mañana, y esta pantalla existe para eso.
