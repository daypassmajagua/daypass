# DayPASS — Rediseño integral de UX/UI: auditoría, diagnóstico y plan

**11 de agosto de 2026.** Un solo documento, nueve fases. En esta tarea no se modificó código de
producto; todo hallazgo vive aquí. La única excepción permitida era instalar `motion` si la fase 9
lo justificaba — **no lo justifica** (§F9), así que tampoco se instaló nada.

Cómo leerlo: la fase 0 son datos sin opinión; la fase 1 los convierte en hallazgos con severidad;
todo lo que se propone de la fase 2 en adelante cita el hallazgo que lo justifica (`H-nn`). Si algo
no tiene un `H-nn` detrás, no está aquí.

## Lo que el encargo dice y el repo contradice

El encargo se escribió sobre un estado anterior del proyecto. Antes de auditar, lo que manda es lo
que existe:

| El encargo dice | El repo tiene | Qué se hizo |
|---|---|---|
| `docs/daypass-sistema-diseno-arquitectura.md` | [docs/sistema-diseno.md](sistema-diseno.md) | Se leyó el real |
| `docs/daypass-plan-v6-ejecucion.md` | [docs/plan-v6.md](plan-v6.md) | Se leyó el real; esta tarea corresponde a su bloque 1, que ya se ejecutó en gran parte (los 12 pasos de [propuesta-diseno.md](propuesta-diseno.md)) — este documento audita el resultado y planea lo que sigue |
| 16 rutas | **30 destinos reales** en 26 archivos de página (App.jsx:101-407) | Se auditaron las 30 |
| 61 pruebas de Vitest | **273** en verde | El criterio se actualiza: 273 siguen pasando |
| 8 roles | **7 asignables** — `recepcion` retirado en la migración 017 | Los tableros de la fase 5 lo reflejan |
| Skills `graphic-designer` y `frontend-design` | `graphic-designer` no está instalada | Fase 3 con `front-end-design` + `refactoring-ui` (mismo terreno: color, jerarquía, densidad, tipografía) |
| «Los 8 patrones» | **14 patrones** en `components/patrones/` (se sumaron Esqueleto, EstadoError, ContadorVivo, Ficha, LineaDeTiempo, PanelLateral) | Se audita la adopción de los 14 |

Una discrepancia más importa que las demás: **el rediseño de navegación que la fase 2 pide ya se
hizo** — siete sustantivos y un engranaje, menús por rol, búsqueda global, fichas con dirección
(propuesta-diseno.md §9–11, pasos 3–7 ejecutados). La fase 2 de este documento no lo rehace: audita
lo construido y arregla lo que la auditoría encontró roto.

---

# FASE 0 — Auditoría: los números, sin opinión

Cuatro inventarios levantados del código el 11 de agosto. Las cifras de esta sección son la línea
base contra la que se mide todo lo demás.

## 0.1 Rutas

- **30 destinos reales** (32 `<Route>` menos la redirección `/dia` y el comodín), 26 archivos de
  página, 33 URLs si se cuentan las secciones de `/config/:seccion`.
- **2 rutas sin shell**: `/embarque` e `/isla` (muelle e isla, a propósito). 2 públicas: `/login`,
  `/r/:token`.
- Navegación por rol desde `lib/navegacion.js` (fuente única): super_admin/directora/asesora ven
  los 7 sustantivos; gerencia 3; asesora_comercial 3; admin_isla 2; **mesero 0** (ver H-01).
- Solo **3 componentes** consultan el modo del aparato (`ListadoDia`, `Estilo`, `BotonReportar`).
  Embarque e Isla escalan por la raíz (`html[data-modo]`, paso 9 de la propuesta) — correcto — pero
  ninguna otra pantalla declara nada.
- Pantallas con más carga secundaria: `/informes` (~7 acciones + 10 gráficas), `/reservas` (~10),
  `/embarque` (~9), `/editar/:id` (~9), `/cerrar` (~7).

## 0.2 Botones

| Métrica | Valor |
|---|---|
| Variantes definidas en `ui/Button` | 18 (6 variantes × 3 tamaños); **9 en uso, 1 variante muerta** (`pendiente`), `success` con 1 solo uso |
| Usos de `<Button>` | 79 |
| Botones ad-hoc (`<button>` con clases propias) | **127** — el **62 %** de los botones no pasa por el sistema |
| Familias visuales distintas en pantalla | **33** |
| Alturas táctiles distintas | 3 del sistema + **19 ad-hoc** (32 a 80 px) |
| Botones solo-ícono | 44, de los cuales **8 sin `aria-label` ni `title`** |
| Implementaciones distintas del botón «cerrar» (×) | **12** |
| Implementaciones del par editar/eliminar | **4** |
| Etiquetas de más de 3 palabras | 11 |
| Sobrescritura de color vía `className` | 1 (`Folios.jsx:116`, esmeralda — una décima variante de facto) |

Duplicados de vocabulario: **9 formas de decir «guardar»**, 7 de «cancelar», 3 de «limpiar
filtros», 6 de «imprimir», 5 de «activar/desactivar». Cadena de menús más profunda: Navbar →
Configuración → sección → pestañas de catálogo (**4 niveles**).

## 0.3 Componentes

- 53 componentes: 10 primitivos `ui/`, 14 patrones, 10 de layout, 19 de dominio.
- **Adopción de patrones**: `Esqueleto` y `EstadoError` en casi todo; `ListaDelDia` solo en Config
  y Usuarios; `BloqueDato` solo en `HoyDelPeriodo`; `FiltroBarra` solo en Actividad;
  `EstadoVacio` directo en **0 páginas** (solo indirecto vía ListaDelDia/LineaDeTiempo).
- **Copiado en vez de reutilizado**: el encabezado de tabla (23 repeticiones de la misma cadena en
  3 páginas + una cuarta variante), la sombra de tarjeta a mano **17 veces** existiendo `ui/Card`,
  el microencabezado uppercase en 20 sitios con 4 variantes, el vacío casero `Card p-12` **9
  veces** existiendo `EstadoVacio`, `Reserva.Seccion` copia literal de `SeccionFormulario`,
  `Informes.KpiCard` duplica `BloqueDato` (en grises), `FichaCatalogo.Estado` y
  `FichaPlan.EstadoDelPlan` byte a byte iguales, 8 píldoras de estado a mano existiendo
  `InsigniaEstado`, el input replicado a mano en 9 sitios con 4 alturas distintas.
- No existe primitivo `Checkbox` (dos `Casilla` locales, homónimas y distintas).

## 0.4 Los tres estados obligatorios (26 páginas)

| Estado | Bien | A medias | Falta |
|---|---|---|---|
| **Cargando** | 16 con `Esqueleto` | 6 con `<p>` de texto plano (CerrarDia, CheckInPublico, Embarque, Equipo, Isla, Reserva) | — |
| **Error** | 21 con `EstadoError` | CheckInPublico con aviso propio | **3 sin nada: Configuracion, Estilo y —lo grave— `Reserva.jsx`** (si la carga de catálogos falla, la pantalla queda en «Cargando lanchas, planes y tarifas…» para siempre, con solo un toast) |
| **Vacío** | 4 vía patrones | **16 caseros** | **3 ausentes**: Hoy (un día sin reservas simplemente oculta el bloque), Turnos (mes), Equipo (lanchas y países) |

## 0.5 Clics por tarea (los 8 caminos críticos, medidos en el código)

| Tarea | Pantallas | Clics | Campos | ¿Anclada? |
|---|---|---|---|---|
| 1 · Reserva de persona natural | 2 | **5** (la 2.ª de la tanda: 2 — el formulario conserva fecha, canal y vendedora) | 1 | Sí (`sticky bottom-0`) |
| 2 · Grupo de agencia | 2 | **8** (+2 por pegar la lista completa; **+2 por persona** si el plan lleva plato/categoría: 48 clics en un grupo de 24) | 3 + 1 pegado | Sí |
| 3 · Cerrar el día | 2 | **2** (+2 diálogos nativos de impresión, fuera de la app) | 0 | Sí |
| 4 · Embarcar (muelle) | 3 | 2 de montaje + **1 por persona** o **1 por grupo**; **con QR: 3 por persona** (H-05) | 0 | Sí, doble |
| 5 · Marcar el regreso | 3 | 2 + 1 por persona + 1–2 el cierre; **sin deshacer** (H-04) | 0 | Sí |
| 6 · Plato de una mesa en la isla | 1–2 | **No hay camino** (H-06) | 1 | n/a |
| 7 · Cortesía | 2 | **7** (los 5 de la tarea 1 + 2 del tipo de ingreso); no exige nada de más, pero tampoco advierte la contradicción (H-10) | 1 | Sí |
| 8 · Restaurante con lancha externa | — | **El tipo de ingreso no existe en la base** (H-02) | — | — |

Deducciones que ya funcionan y hay que proteger: fecha = mañana, tipo de ingreso = pasadía, lancha
sugerida por prioridad y cupo, precios por plan × temporada, titular sembrado como pasajero
(individual), formulario que se reinicia conservando lo repetible.

## 0.6 Deuda visual

| Métrica | Valor | Dónde se concentra |
|---|---|---|
| Clases `gray-*` (sin token) | **128** | Informes 55 · ListadoDia 24 · Historial 24 · Folios 13 · Login 6 |
| Hex fuera de `index.css` | **136** | printDoc.js 84 (hoja de impresión) · Informes 44 (paleta propia de gráficas) |
| `text-[..px]` arbitrarios | **391** en 58 archivos — no escalan con `html[data-modo]` | CheckInPublico 25 (¡el celular del cliente!) · Metas 20 · Mensajes/FichaPlan/BotonReportar 16 c/u |
| `min-h-[..px]` | 68 (6 valores distintos para «altura táctil») | — |
| Colores Tailwind ajenos | emerald 15 · amber 7 · orange 6 · red 5 · purple 4 · green 3 | Folios 30 · Informes 62 · ListadoDia 33 |
| Duraciones fuera del sistema | 2 usos de `duration-500` (no existe en el catálogo 140/160/180/300/800) | HoyDelPeriodo, ContadorVivo |
| Animaciones definidas y **sin uso** | 3 de 6: `destello`, `eco`, `tic-sale` | index.css:271-296 |

Lo que sí existe y está sano: 14 familias de color con regla semántica escrita en el propio CSS,
radios y fuente como tokens, `tabular-nums` global, `@media (pointer: coarse)` con mínimo de 44 px,
`prefers-reduced-motion` global, 6 animaciones nombradas con duración.

---

# FASE 1 — Evaluación heurística

Método: Nielsen y Krug (skill `ux-heuristics`), cada ruta evaluada **en su modo real de uso** — el
muelle como iPad al sol con la fila esperando, no como pantalla de escritorio. Severidad 0–4 ×
frecuencia (día típico / semanal / ocasional). **La tabla de abajo ordena el plan de la fase 8**;
las etapas se priorizan por ella, no por facilidad de implementación.

## La tabla maestra, ordenada por severidad × frecuencia

| ID | Hallazgo | Ruta · modo | Rol | Heurística | Qué pasa en la operación | Sev | Frec |
|---|---|---|---|---|---|---|---|
| **H-01** ✅ | **El mesero no puede abrir su propia home.** `inicioDe('mesero')` = `/isla` pero sus rutas son solo `['/cocina']`; `ProtectedRoute` lo reenvía a `/isla` → bucle. El rol está funcionalmente muerto (navegacion.js:230-235) | `/isla` · isla | mesero | Control del usuario | Quien atienda mesas con esa cuenta no entra nunca | **4** | siempre (para ese rol) |
| **H-02** | **`restaurante_externo` está en la regla 11 y no en la base.** La 007 sembró 6 códigos y ese no. El sustituto de hoy (plan sin transporte + «lancha aparte») deja `tipo_ingreso='pasadia'` → **consume cupo y tiquete cuando la regla dice N/N/S**: falsea el cupo de la lancha y el kardex | `/nuevo` · oficina | asesora | Prevención de errores | Cada reserva de restaurante resta un tiquete que no se consumió y un cupo que no se ocupó | **4** | ocasional, pero cada una daña datos |
| **H-03** | **`Reserva.jsx` no tiene estado de error.** Si la carga de catálogos falla, «Cargando lanchas, planes y tarifas…» para siempre; el error sale solo en un toast que se va | `/nuevo`, `/editar` · oficina | asesora | Visibilidad del estado | Con la señal del hotel, el formulario más usado del sistema se cuelga sin salida | **3** | día típico con red mala |
| **H-04** | **El regreso no tiene deshacer.** La ventana de 8 s está apagada en regreso (Embarque.jsx:477 `&& !esRegreso`) y un toque marca desembarque. iPad mojado + un roce = una persona «bajó» que sigue en la isla, y el conteo contra el que se alerta la pernocta queda torcido | `/embarque` · muelle | asesora, admin_isla | Prevención de errores | El dato que alimenta la alerta más grave del sistema (falta alguien) se corrompe con un roce | **3** | diaria |
| **H-05** | **El QR cuesta el triple que no usarlo.** Leer el pase no embarca (correcto por regla 14: el QR dice quién es); pero para marcar hay que cerrar el lector + tocar la fila + soltar el filtro = **3 toques contra 1** del camino manual. El instrumento estrella del muelle es el camino lento | `/embarque` · muelle | asesora | Flexibilidad y eficiencia | La asesora deja de usar el lector — y con él, la validación de fecha y duplicado | **3** | diaria |
| **H-06** | **La isla no llega al plato de nadie.** La fila ni siquiera es pulsable (`Isla.jsx:58`), Cocina muestra totales, y el rol de isla no puede abrir la reserva. La tarea crítica 6 del encargo no tiene camino | `/isla` · isla | admin_isla, mesero | Reconocer antes que recordar | «¿Qué plato eligió esta mesa?» se responde llamando a la oficina | **3** | diaria |
| **H-07** | **Configuración tiene 4 niveles de menú.** Navbar → Configuración → sección → pestañas de catálogo. El menú de primer nivel ya se arregló (7 sustantivos); la profundidad interior no. Y las pestañas no tienen URL: no se puede enlazar «Pilotos» | oficina | asesora, directora | Reconocer antes que recordar | Llegar a un piloto son 4 decisiones de navegación | **3** | diaria |
| **H-08** | **33 variantes visuales de botón; 62 % ad-hoc; 19 alturas táctiles.** Nadie puede mirar un botón y saber su peso sin pensar | todas | todos | Consistencia | Cada pantalla nueva inventa; el iPad hereda alturas de 32 px | **3** | transversal |
| **H-09** ⚠ | **El estado vacío no existe como sistema**: 16 caseros, 3 ausentes. **Corregido al ir a arreglarlo**: Hoy *sí* tenía vacío (un `<p>` casero en `FraseDelDia`), así que el hallazgo era otro y peor — ofrecía **«Crea la primera» para un día que ya pasó**, y un día ido no se puede vender: quien siga esa invitación crea la reserva en otra fecha sin notarlo | `/`, `/config/turnos`, `/equipo` | todos | Visibilidad del estado / prevención de errores | Se invita a una acción imposible; y un día pasado sin gente no es un pendiente, es un hecho | **3** | semanal |
| **H-10** | **Tres cosas se llaman «cortesía» y el formulario permite contradecirlas sin aviso**: `tipo_ingreso=cortesia`, el contador de plazas cortesía, y `forma_pago='cortesia'`. La combinación pasadía+forma cortesía ya está marcada como contradicción en `auditoria_integridad.sql` — y se puede seguir creando | `/nuevo` · oficina | asesora | Prevención de errores | Dato sucio que la regla 18 y el reporte de cortesías pagan después | **3** | semanal |
| **H-11** | **El cierre del zarpe de ida no confirma ni resume.** 1 clic y es irreversible (dispara manifiesto); solo el regreso confirma, y solo si falta gente. Nada comprueba la **cola de escrituras pendientes** al cerrar | `/embarque` · muelle | asesora | Prevención de errores | Se puede cerrar un embarque creyendo guardado lo que sigue en cola | **3** | diaria |
| **H-12** | **Folios falla el trunk test y bloquea con un candado raro**: el menú dice «Folios», el título «Listado para Folios Zeus»; «Marcar completados» se habilita solo tras imprimir, explicado en un **tooltip hover que en iPad no existe** | `/folios` · oficina | asesora | Trunk test / hover | La pantalla se aprende por prueba y error | **2** | diaria |
| **H-13** | **Informes es otro producto**: 62 clases ajenas, paleta propia de 8 hex en las gráficas, `KpiCard` duplicando `BloqueDato` en gris, 8 filtros en fila con `FilterSelect` local existiendo `FiltroBarra`, 800 líneas | `/informes` · oficina | gerencia | Consistencia / minimalismo | Parece panel de administración genérico — el fracaso declarado del proyecto | **2** | semanal |
| **H-14** | **8 botones solo-ícono sin ninguna etiqueta accesible** (entre ellos los dos RefreshCw de cabecera y el ✓ de guardar folio) | varias | todos | Reconocimiento | Íconos que hay que adivinar; lectores de pantalla mudos | **2** | diaria |
| **H-15** | **391 `text-[..px]` no escalan con el modo.** Embarque/Isla ya migraron (paso 9); el resto no. Los 25 de `CheckInPublico` son los que más pesan: es la pantalla del celular del cliente | transversal | — | Consistencia | La tipografía del check-in no responde a la configuración del teléfono | **2** | transversal |
| **H-16** | **Duplicación estructural**: sombra ×17, microencabezado ×20, vacío ×9, thead ×23, `Seccion` copiada, `Estado`/`EstadoDelPlan` gemelos, 8 píldoras a mano, input a mano ×9 con 4 alturas | transversal | — | Consistencia | Cada arreglo hay que hacerlo N veces; ya divergieron | **2** | transversal |
| **H-17** | **La capa de respuesta está a medio conectar**: `destello` (fila nueva por Realtime) y `eco` (confirmación de muelle) definidas y **sin un solo uso**; `tic-sale` tampoco. Las filas que llegan por Realtime aparecen sin aviso — justo lo que la animación existía para decir | listas de oficina, muelle | todos | Visibilidad del estado | Un cambio remoto aparece «de la nada» y reordena lo que se estaba leyendo | **2** | diaria |
| **H-18** | **CheckInPublico y Login viven fuera del sistema**: cero patrones, `Campo`/`Aviso`/`Marco` locales, amber a mano, 25 px arbitrarios | `/r/:token`, `/login` | cliente | Consistencia | La primera pantalla que ve el cliente es la menos cuidada del sistema | **2** | diaria |
| **H-19** ❌ | ~~El buscador global mide 36 px, por debajo del mínimo táctil~~ — **el hallazgo estaba mal y se corrige aquí.** `index.css` fuerza `min-height: 44px` a todo `button`, `[role=option]` y `a[href]` bajo `@media (pointer: coarse)`, y `min-height` gana sobre `height`: **en el iPad ya medía 44**. Los 36 eran de escritorio, donde el mouse apunta fino y la densidad es una virtud. Leí la clase y no la regla global que el propio sistema ya tenía | oficina | todos | — | Nada. El sistema ya lo resolvía | **0** | — |
| **H-20** | **11 etiquetas de más de 3 palabras** y 9 sinónimos de «guardar» / 7 de «cancelar» | varias | todos | Consistencia / palabras | El mismo acto se llama distinto en cada pantalla | **2** | transversal |
| **H-21** | `duration-500` ×2 fuera del catálogo de duraciones; `eco` dura 300 ms cuando la regla del muelle es ≤240 | — | — | Consistencia | — | **1** | — |
| **H-22** | `printDoc.js` con 84 hex propios (hoja de impresión completa a mano, con mojibake conocido que impide reescrituras por script) | impresos | — | Consistencia | Los impresos no heredan tokens; se acepta y se documenta | **1** | — |
| **H-23** | Variante `pendiente` de Button muerta; `success` con 1 uso; esmeralda inyectada por `className` | — | — | Minimalismo | Variantes que existen solo para confundir al siguiente | **1** | — |
| **H-24** 🆕 | **La franja dice «En planeación» para un día que ya pasó.** `planeando` es el estado por defecto de un día que nunca tuvo fila en `dias_operativos`, y la franja lo muestra tal cual — así que el 3 de julio de 2026 aparece como si todavía se estuviera planeando. Un estado que miente sobre el tiempo enseña a no leer la franja, que es la firma del sistema | `/` y toda la oficina · franja | todos | Correspondencia con el mundo real | Se lee «en planeación» sobre un día del que ya no hay nada que planear | **2** | al mirar el pasado |
| **H-25** 🆕 | **La pantalla se contradecía a sí misma en un día pasado**: el vacío decía «ningún día del pasado se puede vender» y el botón primario seguía ofreciendo `Nueva reserva` — que además arranca en **mañana**, así que habría creado la reserva en otra fecha sin avisar | `/` · oficina | asesora | Prevención de errores | Una reserva creada en el día equivocado, sin que nada lo señale | **3** | al mirar el pasado |

**El problema que el encargo pedía clasificar** —«el menú actual es demasiado grande y contiene
todo»— quedó resuelto antes de esta auditoría (7 sustantivos + engranaje, paso 3 de la propuesta) y
la prueba de roles lo confirma. Lo que sobrevive de ese problema es H-07: la profundidad *dentro*
de Configuración.

## Las cuatro heurísticas que el encargo pedía mirar con lupa

**Visibilidad del estado del sistema (la cola de Dexie).** Lo construido está bien parado: el
`IndicadorSync` calla cuando todo subió y aparece con conteo cuando hay cola, con panel de
pendientes, «Subir ahora» y descarte individual; en modo muelle crece a 52 px. Los dos huecos
reales son H-11 (nada cruza la cola con el **cierre** del zarpe — el único momento donde un
pendiente perdido es irrecuperable) y H-17 (lo que llega por Realtime no se anuncia). No hay
hallazgo de «no sé si se guardó» a nivel de fila: el embarque pinta la fila en 0 ms desde la copia
local, que es el diseño correcto.

**Prevención de errores.** Los tres irreversibles del sistema hoy: cerrar el día (2 clics, sin
confirmación — pero es **reabrible** por diseño y los pendientes no bloquean a propósito, así que
está bien); cerrar el zarpe (H-11: ida sin confirmación ninguna); cancelar por contingencia (aún no
construido, bloque 6). El par editar/eliminar de reservas ya se separó a 44 px con tinte solo al
tocar (auditoría del 11 de agosto); el regreso sin deshacer (H-04) es ahora el punto más frágil.

**Reconocer antes que recordar.** `2A 2N` en Folios sin explicar, `GRP` en púrpura fuera de
tokens, y H-06: el plato existe en la base y nadie en la isla puede verlo. El folio ya se busca
globalmente y cae en su reserva — eso está resuelto.

**Flexibilidad y eficiencia.** El contraste con la fase 0 da tres veredictos: crear reservas está
**excelente** (5 clics, la segunda de la tanda 2 — proteger); el embarque manual está excelente (1
toque/persona, 1 por grupo); y el QR es la anomalía (H-05): heurísticamente correcto —valida,
informa, filtra— pero **más lento que su alternativa**, que es la definición de un flujo que se
abandona.

---

# FASE 2 — Navegación y arquitectura de información

La estructura de primer nivel **ya está decidida y construida** (propuesta-diseno.md §9): siete
sustantivos del negocio + un engranaje, menús por rol desde `navegacion.js` como fuente única, y la
búsqueda global como la otra mitad de la navegación. Esta fase no la rehace — la audita. Cuatro
cosas salen mal paradas y una queda pendiente de decisión.

## 2.1 El menú por rol: un rol roto y una regla que confirmar

La tabla vigente (navegacion.js:152-235) es correcta para seis roles. El séptimo está muerto:

**Resuelto (H-01) — el 11 de agosto, por decisión del dueño: el rol se retira.** Se había
propuesto el arreglo de una línea (`menu: ['/isla']`), pero al ir a hacerlo el arreglo no se
sostenía: un rol de una sola pantalla, sin menú y sin nadie que lo mantenga es un rol que vuelve a
romperse. Quien atiende mesas entra como `admin_isla` y ve Hoy, Isla y Almuerzos — **más de lo que
el mesero podía ver**. La frontera con Zeus no se mueve: la comanda sigue siendo de Zeus; cambia
la cuenta con la que se consulta el pronóstico.

Lo hace la **migración 033**, con el molde de la 017, y con una trampa que hay que dejar escrita:
la restricción `perfiles_rol_vigente` de la 017 solo nombraba a `recepcion`, así que reemplazarla
pensando únicamente en `mesero` **habría reabierto `recepcion`** en silencio. La 033 nombra a los
dos y su comprobación final verifica los dos, leyendo `pg_constraint` en vez de intentar un
`insert` — comprobar un candado abriéndolo es como se cerró por error el día operativo del 9 de
agosto.

## 2.2 Configuración: de 4 niveles a 2, sin mover nada de sitio (H-07)

El problema no es cuántas secciones tiene el engranaje (diez, correctas), sino que **dentro** hay
dos niveles más y el último no tiene dirección. La solución es darle URL a lo que hoy es estado:

1. **Las pestañas de catálogo se vuelven segmento de ruta.** `/equipo/pilotos`,
   `/equipo/empleados`, `/equipo/lanchas` (hoy `/equipo` + estado local); `Config.jsx` igual donde
   tenga pestañas. La pestaña sigue viéndose como pestaña — lo que cambia es que «Pilotos» se puede
   enlazar, recargar y volver con el botón atrás. Trunk test: la URL dice dónde estás.
2. **El índice `/config` deja de ser paso obligado en escritorio.** El engranaje del Navbar se
   vuelve desplegable con las secciones del rol (un nivel: engranaje → sección). El índice
   sobrevive como página —es donde vive «Antes de operar», que Daniela necesita— pero ya no es
   peaje. En el cajón móvil, las secciones se listan directamente bajo «Configuración».

Resultado: llegar a un piloto pasa de 4 decisiones a 2 (engranaje → Pilotos).

## 2.3 Lo que el encargo pide y ya existe (se verifica, no se construye)

- **Correos de destino editables por Daniela**: `/config/mensajes` agrupa destinatarios por
  propósito (manifiesto / facturación / general) sobre `organizacion_correos` (migración 020), con
  aviso coral si falta el correo del manifiesto — lo único que puede detener un zarpe. Cumple.
- **Búsqueda global**: indexa personas (nombre/documento), reservas (titular, grupo, **folio**,
  fecha), agencias (nombre/NIT), lanchas y empleados; los resultados abren la ficha, no una lista
  filtrada. `Ctrl+K` en computador, barra permanente en táctil, **ausente en muelle e isla** a
  propósito (tienen su búsqueda local sin señal). Dos deudas: el perfil de **agencia** aún no
  existe como página (su resultado abre poco) — está en el plan como «agencia después»; y H-19: la
  barra mide 36 px en táctil — sube a 44.
- **El perfil con actividad histórica**: `Ficha` + `LineaDeTiempo` en persona y reserva,
  ejecutados; agencia pendiente (fase 8, E7).

## 2.4 Notificaciones: dónde viven (diseño para el bloque 7)

Decisión de arquitectura, para que el bloque 7 no la improvise: **no hay campana**. Una campana es
un segundo inbox que compite con la pantalla de trabajo. Los avisos viven en tres capas que ya
existen, ordenadas por urgencia:

| Capa | Qué lleva | Ejemplos |
|---|---|---|
| **Push del sistema** (fuera de la app) | Solo lo que exige actuar ya, enrutado **al turno, no a la persona** | Falta gente en el conteo de regreso · cambio de hora del regreso · «me bloqueó la operación» (soporte) |
| **La franja del día** | El estado operativo en vivo | Zarpó · salió de regreso · quién está de turno · en la isla ahora |
| **Pendientes de Hoy** | Lo que espera una acción con su botón | Nueva reserva por aprobar (solo directora) · reserva de agencia sin nombres cerca del zarpe · tiquetes insuficientes |

Nueva reserva notifica **solo a la directora** (regla del plan v6) y como pendiente, no como push:
es información que espera, no una urgencia. Si un día tiene gente confirmada y nadie en el turno,
eso ya lo marca el calendario de guardias en coral — misma señal, mismo sitio.

---

# FASE 3 — Sistema de diseño

Skills aplicadas: `refactoring-ui` (jerarquía por sistemas: escalas restringidas de espacio, tipo,
color y sombra) y `front-end-design` (que el resultado no se lea como plantilla — el criterio que
este proyecto ya persigue con su regla de «nada de panel de administración genérico»). Cada
decisión de abajo responde a un hallazgo, no a preferencia.

## 3.1 Tokens

**El sistema de color existe y es bueno**: 14 familias en `@theme` con la regla semántica escrita
en el propio CSS (coral solo pendiente/tardío · verde solo cerrado/guardado · rojo solo error real
· arena solo series de datos · sol para muelle/isla · mar para «ya está en la isla» · alarma para
falta gente). No se rediseña. Lo que falta es cerrarle las fugas y cubrir dos semánticas que el
encargo nombra:

| Semántica pedida | Resolución | Justificación |
|---|---|---|
| confirmado / pendiente / cancelado | Ya existen (`ESTADO_COLORS`: azul / gris / rojo) | — |
| **en cola sin sincronizar** | Se formaliza sobre `aviso-*` (ámbar): es «algo que revisar», la definición literal de esa familia. El `IndicadorSync` ya lo usa así; se documenta en `/estilo` como uso canónico | Un token nuevo para un significado que ya tiene familia sería una quinta forma de decir ámbar (H-16) |
| **contingencia** | Familia nueva `contingencia-*` reservada con **3 escalones** (50/500/700, violeta-gris), definida ahora en `@theme` y documentada en `/estilo`, aunque su primera pantalla llegue con el bloque 6 | Si no se reserva ahora, el bloque 6 la inventará con `purple-*` de fábrica — exactamente como Folios inventó `purple-100` para «GRP» (H-16). Violeta-gris porque no puede competir con alarma (rojo) ni coral: un día en contingencia no es un error, es un estado del negocio |
| **cortesía** | **Sin color, a propósito.** Cortesía no es un estado de la reserva: es un tipo de ingreso, y se dice con texto («Cortesía» en la fila, el contador de cocina, el reporte) | La regla 3 del sistema visual: si todo grita, nada grita. Darle color a un tipo de ingreso abriría la puerta a colorear los seis |

**Cierre de fugas (H-15, H-16, C.5):** tabla de equivalencia obligatoria para la migración de las
pantallas viejas — `gray-900→tinta`, `gray-500/600→tinta-2`, `gray-400→tinta-3`,
`gray-50→fondo`, `gray-100/200→linea`, `emerald→verde`, `amber→aviso`, `red→peligro` (o coral
según semántica), `purple («GRP»)→arena-100/700` (es una etiqueta de dato, no un estado),
`orange→coral`. Los tres `red-600` de los primitivos (`Input`, `Select`, `DatePicker`) pasan a
`peligro-500`. La paleta propia de Recharts en Informes muere: **una serie encendida en `blue-600`,
el resto en `arena-*` y `linea`** — la regla de la referencia («la gráfica apagada con una sola
barra encendida») que este proyecto ya adoptó por escrito y no aplicó.

**Tipografía.** Manrope única, en `rem` sobre la raíz que escala por modo (oficina 100 % · muelle
112.5 % · isla 125 %) — ya construido (paso 9). La escala se publica en `/estilo` y se convierte en
regla dura: **ningún `text-[..px]` nuevo**; los 391 existentes migran por oleadas (fase 8), con
CheckInPublico primero porque es la pantalla del cliente (H-18). Números siempre `tabular-nums`
(ya global). Pesos: 700 para el dato y el verbo, 400 para lo demás — Manrope fina no existe en
este producto porque a 60 cm bajo el sol no existe (decisión ya escrita en propuesta §8, se eleva
a regla del sistema).

**Espaciado, radios, elevación.** Escala de espacio restringida a la de Tailwind (4/8/16/24/32/48)
— la auditoría no encontró desviaciones graves aquí. Radios ya tokenizados (`--radius-control`
12 px, `--radius-tarjeta` 16 px). **Elevación: dos niveles y ya** — `Card` (la sombra del sistema,
que 17 sitios copian a mano y deben dejar de copiar: H-16) y flotante (modal/desplegable). Un
tercer nivel no existe: en una app de operación, lo que flota es lo que espera respuesta, y dos
cosas flotando a la vez ya es un error de diseño.

## 3.2 Movimiento

El catálogo existe (6 animaciones nombradas); el problema es que **la mitad está muerta** (H-17) y
hay dos valores fuera de sistema (H-21). Queda así:

**Dos curvas**: `ease-out` estándar (todo lo que entra) y `cubic-bezier(.32,.72,0,1)` (paneles
laterales — ya existe). **Tres duraciones**: 140 ms (tic), 180 ms (entrar: `aparecer` y
`entra-de-lado` se unifican en 180), 240 ms (eco — **baja de 300** para cumplir la regla del
encargo: en muelle nada supera 240 ms). `destello` (800 ms) queda como la excepción documentada:
no es una animación de interfaz sino un aviso de dato remoto, y su lentitud es el mensaje. Los dos
`duration-500` migran a la escala. Todo respeta `prefers-reduced-motion` (ya global); en listas
solo se anima `transform` y `opacity` (ya se cumple: las listas no se reordenan en vivo, por
diseño).

**Conectar lo muerto es más importante que crear nada nuevo:**
- `destello` → filas que llegan por Realtime en ListadoDia, Isla y Folios («esto acaba de entrar»).
- `eco` → confirmación de embarque en muelle (la fila cambia de color en 0 ms; el eco es el
  después, nunca el prólogo — regla existente que se conserva).
- `tic-sale` → la mitad que le falta al `ContadorVivo` (hoy solo entra el dígito nuevo; el viejo
  desaparece sin salir).

## 3.3 Acciones y botones (fase 3.1 del encargo)

La sección de mayor impacto. Parte de los números de la fase 0: 33 variantes visuales, 62 %
ad-hoc, 19 alturas, 12 cierres, 4 pares editar/eliminar, 9 «guardar».

### El inventario mínimo: de 33 familias a 12 piezas

Cuatro primitivos nuevos + un `Button` podado. Cada pieza gana su lugar porque absorbe familias
enteras del inventario ad-hoc:

| Pieza | Variantes | Absorbe (de las 23 familias ad-hoc) | Justifica |
|---|---|---|---|
| **`Button`** (existente, podado) | `primary · secondary · ghost · danger` × `sm · md · lg` | Familias 12, 13, 14, 15, 16 (réplicas manuales de primary/secondary en CheckInPublico, Embarque, IndicadorSync, ProtectedRoute) | H-08, H-23. **Se eliminan `pendiente`** (0 usos) **y `success`** (1 uso: «Marcar completados» pasa a `primary` — verde es color de estado, no de botón; el éxito lo dice el estado de la página, no el botón que lo dispara). La esmeralda inyectada en Folios muere con su banner (H-12) |
| **`BotonIcono`** (nuevo) | `neutro · peligro` × tamaño por modo (44 oficina · 48 sol · 56 sobre cámara) | Familias 1–5 (los 44 solo-ícono: 12 cierres, 4 pares editar/eliminar, flechas, limpiar) | H-08, H-14, H-16. **`aria-label` es prop obligatoria** — el componente lanza en desarrollo si falta. Mata de raíz los 8 sin etiqueta |
| **`Pestanas`** (nuevo) | única, con conteo opcional por pestaña | Familias 9, 10 (píldoras de Equipo/Config, segmented de Informes) | H-07 (recibe la URL como estado), H-16 |
| **`TarjetaOpcion`** (nuevo) | `md · sol` | Familia 17 (TarjetasPlan, FichasLancha, ModoDelAparato, toggles de ficha) | H-16: cuatro implementaciones del mismo gesto «elegir una tarjeta» |
| **`Casilla`** (nuevo, primitivo `ui/`) | única | Las dos `Casilla` locales homónimas (Config, Turnos) | H-16 |
| Ya existen y se quedan | `Select` (trigger+opción), `DatePicker`/`DateNav`, `Stepper`, FAB de soporte, fila de resultado (`Buscador`), enlace-texto | Familias 18–23 | Son piezas con trabajo propio; se les fija la altura por modo y dejan de declararla cada una |

Con eso las **19 alturas ad-hoc colapsan en 3 por modo** — oficina 44 · muelle 64 (fila) / 56
(control) · isla 56 — declaradas una vez en los primitivos y en `@media (pointer:coarse)`, nunca
en la pantalla. El buscador global y «Volver a lo mío» suben de 36 a 44 (H-19).

### Etiquetas: verbo + objeto, máximo tres palabras

Renombres concretos (H-20). La regla: si al quitar palabras el botón sigue diciendo qué hace, las
palabras sobraban.

| Hoy | Queda | Nota |
|---|---|---|
| `Imprimir el conteo de cocina` | `Imprimir cocina` | |
| `Imprimir el tentativo` | `Imprimir tentativo` | |
| `Copiar para WhatsApp` | `Copiar mensaje` | |
| `Volver a guardar la lista` | `Guardar de nuevo` | |
| `Programar los zarpes del día` | `Programar zarpes` | |
| `Ver toda la lancha otra vez` | `Toda la lancha` | Es un filtro que se suelta, no una acción |
| `Embarcar los 5 que faltan` | `Embarcar los 5` | **Excepción viva**: el número es el contenido |
| `Ver también los cerrados` / `Ver solo los abiertos` | `Con cerrados` / `Solo abiertos` | |
| `Guardar la reserva` / `Guardar cambios` / `Guardar el mensaje` / `Guardar la preparación` / `Registrar` / `Crear` | **`Guardar`** en todos los modales y barras; `Crear` solo cuando crea | 9 → 2 (H-20) |
| `Cancelar` vs `Descartar` | Se quedan **las dos, con significado fijo**: `Cancelar` cierra sin haber tocado nada; `Descartar` bota cambios hechos | Fusionarlas mentiría en el caso que importa |
| `Limpiar filtros` / `Limpiar todo` / `Limpiar` | **`Limpiar filtros`** única | |
| `Salir` / `Cerrar sesión` | **`Salir`** | |

Nada de botones solo-ícono salvo los universales (cerrar, buscar, flechas de fecha, ±) — todos vía
`BotonIcono` con su `aria-label`. Los dos `RefreshCw` de cabecera (Informes, Folios) **se
eliminan**: hay Realtime y `refetch` al volver; un botón de recargar es una confesión. El ✓ de
guardar folio gana etiqueta o se vuelve guardado-al-salir como ya hace el campo de Folios.

### Jerarquía y posición

- **Una sola acción primaria visible por pantalla**, siempre en el mismo sitio del modo: oficina =
  derecha del `PageHeader` (listas) o barra fija inferior (formularios largos: ya lo hacen Reserva
  y CerrarDia — se conserva); muelle = barra fija inferior, siempre (ya). Donde hoy compiten:
  Folios tiene 4 botones de cabecera con 2 primarios visuales (Imprimir esmeralda + Marcar
  completados verde) — queda **`Imprimir listado`** como primaria única, `Copiar` a secundaria,
  «Marcar completados» se va con su candado (abajo).
- **Zona de alcance en iPad horizontal**: el iPad se agarra por los bordes; los pulgares llegan a
  los tercios laterales de la mitad inferior. Por eso la barra inferior del muelle pone **la
  acción frecuente en los extremos** (Sin reserva a la izquierda, Cerrar a la derecha) y lo
  informativo (Manifiesto, contador) al centro — que es como ya está; se eleva a regla escrita
  para que ninguna pantalla nueva de muelle lo invierta.
- **Proximidad**: la acción por fila actúa sobre su fila (ya se cumple); «Embarcar los N» vive en
  el encabezado del grupo sobre el que actúa (ya). El contraejemplo a corregir es H-05: la acción
  de embarcar está en otra pantalla que el veredicto del QR que la provoca (fase 4.1).
- **Barras fijas**: ancladas en listas y formularios largos (ya en Reserva, CerrarDia, Embarque,
  Ficha). Inline solo para acciones de sección (Agregar, dentro de su tarjeta).

### Las peligrosas, separadas

| Acción | Tratamiento |
|---|---|
| **Cerrar el zarpe / el regreso** | Extremo derecho de la barra, a ancho de botón del resto de la barra pero **único azul sólido** de ella; confirmación con resumen SIEMPRE (fase 4.1, H-11), no solo cuando falta gente. Es la excepción legítima a «sin diálogos en el muelle»: ocurre 2–4 veces al día, no 85 |
| **Cerrar el día** | Se queda en 1 clic sin diálogo: es reabrible y sus pendientes informan sin bloquear — el diseño actual es correcto y se documenta como decisión, no como omisión |
| **Eliminar reserva** | Ya separada (44 px, tinte solo al tocar, modal) — se conserva |
| **Quitar acceso (Usuarios), eliminar catálogo** | `ConfirmarAccion` con `danger` (ya) |
| **Cancelar por contingencia** (bloque 6) | Nace con esta regla: nunca adyacente a una acción frecuente, siempre `ConfirmarAccion` con resumen de afectados |
| **Unir personas duplicadas** (bloque 3, pendiente de pantalla) | Ídem, con vista previa de qué se fusiona |

### Estados de cada botón

`reposo · hover (solo escritorio, ya anulado en táctil por CSS) · presionado (scale .98, ya) ·
cargando (spinner, ya) · deshabilitado (ya)` + **el sexto, propio de esta app: encolado**. Cuando
la acción escribió en la cola local y no ha subido, el botón vuelve a reposo (la operación siguió)
y **la fila afectada muestra la marca de cola** (punto ámbar `aviso-700` + «guardado aquí» en el
detalle), consistente con el IndicadorSync. Se define una vez en el sistema (`/estilo`) y ninguna
pantalla lo improvisa. El candado de Folios (H-12) se rehace con este vocabulario: «Marcar
completados» deshabilitado muestra **debajo, en texto plano**, «Imprime el listado primero» — sin
tooltip hover, que en iPad no existe.

La tabla ruta por ruta con el antes/después de cada acción está en la fase 7, que es donde el
encargo la pide junto al conteo de clics.

---

# FASE 4 — Diseño por modo y dispositivo

El modo es **del aparato, no del usuario** (`localStorage` → `html[data-modo]`), se cambia en
`/config/operacion` y salir del modo muelle pide confirmación. La raíz escala todo junto
(100 % / 112.5 % / 125 %) — construido y con prueba propia (`npm run modos`). Lo que esta fase
especifica es el contrato de cada modo, para que ninguna pantalla nueva lo negocie:

| | **Oficina** | **Muelle** | **Isla** |
|---|---|---|---|
| Shell | FranjaDia + Navbar + PageHeader + contenido (máx. 1200) | **FranjaDia + contenido. Nada más** | Franja + contenido + `NavegacionMinima` |
| Base tipográfica | 16 px | 18 px | 20 px |
| Fila / control | 44 px | 64 / 56 px | 56 px |
| Densidad | Alta — tablas, atajos, todo visible | **Una tarea. Lo demás no está «más pequeño»: no está** | Media — consulta pura |
| Dinero | Sí | **Nunca** (discreción física: la pantalla la ve la fila) | **Nunca** |
| Color | Paleta completa | **Relleno pleno de fila, jamás matices** — un 20 % de opacidad no existe a mediodía en La Bodeguita. Paleta `sol-*` de fondo | `sol-*` + `mar-*` |
| Confirmaciones | `ConfirmarAccion` para lo irreversible | **Solo el cierre del zarpe.** Todo lo demás se deshace, no se pregunta | No hay acciones que confirmar |
| Animación | Catálogo completo | Estado en 0 ms; el eco (≤240 ms) es después, nunca prólogo | Solo `tic` del contador |
| Búsqueda | Global (Ctrl+K / barra) | Local, sobre la copia sin señal | Local |
| Notificaciones | Franja + pendientes | Ninguna que no sea del zarpe en curso | Aviso de regreso |

El modo muelle **anula** filtros, métricas y navegación — es una interfaz distinta, no la misma
con menos cosas. Si un patrón del sistema no funciona al sol, la excepción se escribe en el modo
(como ya pasó con las alturas y la paleta `sol`), nunca en la pantalla.

**Deuda que esta fase hereda a la 8**: los 391 `text-[..px]` que no escalan (H-15) y las 6
pantallas con «cargando» de texto plano (0.4) — entre ellas, tres del muelle/isla.

# FASE 4.1 — Modo embarque, a fondo

`/embarque` es el momento de mayor riesgo del producto. Buena parte de lo que el encargo pide **ya
está construido y verificado** (lector continuo, veredictos, sonido, walk-in, deshacer de ida,
barra fija); esta sección lo consolida como especificación completa —para que no haya que volver a
decidirlo— y corrige los cuatro huecos que la auditoría encontró (H-04, H-05, H-11 y el arranque).

## Las condiciones (contra las que se valida todo)

iPad horizontal sostenido por los bordes, sol pleno, pantalla posiblemente mojada, sin señal parte
del tiempo, fila de pie, y quien opera puede no ser Daniela ni haber visto la pantalla antes. De
ahí las cinco reglas que ya rigen y se conservan: estado en 0 ms desde la copia local · relleno
pleno, nunca matices · 64 px por fila con 8 px de aire · cero diálogos en el flujo por-persona
(el error se deshace, no se previene) · sin dinero en pantalla.

## El arranque: a qué abre la pantalla

El encargo pide «la cámara es el estado por defecto». La regla 14 dice «el QR nunca es requisito
para embarcar», y la fase 0 midió que buena parte de los embarques no traen QR (alojamiento,
empleados, grupos sin nombres, walk-ins). La resolución:

- **Con un zarpe de ida preparado y en ventana de embarque, el lector se abre solo** al entrar a
  la lancha. Es la mañana real: la fila que llega trae pases. Un toque en × lo cierra y deja la
  lista — y la pantalla recuerda la elección durante ese zarpe (si la asesora lo cerró, no se le
  vuelve a abrir).
- **En cualquier otro estado** (zarpe sin preparar, regreso, día cerrado) abre la lista, que es
  donde están las tareas de ese momento.

Así el escaneo es el camino por defecto **cuando el contexto lo es**, sin volverse un peaje para
los casos sin QR. Es la única pieza de esta fase que cambia el arranque actual; queda marcada como
decisión a validar con Daniela en el primer día de uso (§Decisiones).

## El escaneo (consolidación + el arreglo de H-05)

Lo vigente, que se conserva tal cual: escaneo **continuo** (el lector no se cierra al leer;
silencio de 1.5 s por token repetido), veredicto como franja inferior grande dentro del lector,
color pleno legible a un metro, **sonido sintetizado** con WebAudio (agudo corto = adelante ·
doble medio = ya subió · grave = detener), desbloqueado con el gesto de abrir el lector,
interruptor de silencio persistente por aparato. **Vibración no existe** en iPadOS — el canal
háptico se descarta por plataforma, no por criterio. Validación **local contra Dexie**, sin red,
muy por debajo de los 200 ms pedidos.

**El arreglo (H-05):** el veredicto válido gana la acción que le faltaba —

> Franja verde: **«Familia Pérez · 4 personas»** en grande, y debajo, dentro de la misma franja,
> el botón **`Embarcar los 4`** (64 px, ancho completo de la franja). Un toque: embarca al grupo,
> suena el tic de éxito, el contador grande hace su tic, y **la cámara sigue mirando** — cero
> toques entre una familia y la siguiente.

Esto respeta la regla («el QR dice quién es; embarcar es un acto deliberado del muelle») y
convierte los 3 toques por persona en **1 toque por grupo sin salir de la cámara**. Si el grupo
necesita revisión persona a persona (plazas sin nombre, niños), el botón secundario de la franja
—`Ver el grupo`— cierra el lector ya filtrado, que es el comportamiento actual.

## Todos los casos, con su respuesta

| Caso | Respuesta en pantalla | Estado |
|---|---|---|
| QR válido | Franja verde + nombre grande + `Embarcar los N` | Construido + botón nuevo |
| QR ya escaneado | Franja aviso: «Ya subió · 8:14» — información, no regaño | Construido |
| QR de otro día | Franja alarma: «Es del 15 de agosto» + `Buscar por nombre` | Construido |
| QR ilegible / no encontrado | Franja sol-tinta: «No es de hoy. Búscalo por el nombre» | Construido |
| Sin QR (alojamiento, empleados) | Lista: 1 toque por fila; empleados y alojados entran por «Preparar» | Construido |
| Grupo sin nombres | Plazas «Persona 4 de 24»: cuentan en el contador y el manifiesto las lleva como plazas; botón `Nombre` las nombra y embarca en un gesto (2 clics + 1 campo) | Construido |
| Walk-in | `Sin reserva` en la barra fija → captura mínima (nombre; CC y Colombia ya puestos; documento opcional) → embarca. **No crea reserva**: la oficina la convierte después | Construido |
| Cámara falla | `Buscar por nombre` **siempre visible** fijo bajo el lector — no solo cuando falla | Construido |
| No aparece por ningún lado | La respuesta es el walk-in: se embarca con captura mínima y queda para la oficina. La asesora nunca queda sin salida ni la fila esperando una llamada | Construido (documentar en la pantalla: el vacío de búsqueda ofrece `Sin reserva`) |

## Lo que la pantalla dice en todo momento

1. **Embarcados / esperados** — el elemento más grande (ContadorVivo con tic). Construido.
2. **Qué lancha y cuánto cupo queda** — cabecera fija. Construido.
3. **Cola de sincronización** — IndicadorSync (52 px en muelle): silencio si todo subió, conteo si
   no. Construido.

Nada más. Métricas, filtros y dinero no existen en este modo.

## El cierre del embarque (H-04 + H-11)

- **Confirmación con resumen, siempre** — ida y regreso: «Embarcaron 34 de 36 · 2 sin embarcar ·
  **3 cambios sin subir**» + `Cerrar el zarpe` / `Volver a revisar`. Hoy solo confirma el regreso
  con faltantes; el cierre dispara manifiesto y formato de Capitanía y es irreversible: merece el
  único diálogo del modo.
- **Con escrituras pendientes no se cierra en silencio**: si la cola tiene eventos del zarpe, el
  resumen los muestra en ámbar y el botón dice `Cerrar con 3 en cola` — se puede (la cola drena
  sola al volver la señal, y el cierre mismo se encola), pero **es imposible hacerlo sin saberlo**.
- **El regreso gana el deshacer de 8 segundos** que hoy tiene solo la ida (H-04). Nada en las
  reglas lo prohíbe: el evento `desembarque` se anula igual que un `check_in` dentro de la
  ventana, y el cierre —no el toque— es lo que consolida el conteo. Queda a confirmación de Rafa
  por tocar el flujo que alimenta la alerta de pernocta (§Decisiones).
- Prerrequisito operativo: **la migración 032 sigue pendiente de correr** — sin ella la isla no
  puede cerrar el regreso que la propuesta ya le asignó.

## Lo que el diseño hace visible que ya no ocurre

El formato de Capitanía se genera del manifiesto (nombre, identificación, país por lancha — regla
15); el plato viene del check-in y vive en Cocina como pronóstico. **La pantalla de embarque no
pregunta nada de eso, y está bien así** — la auditoría lo verificó: no pide ningún dato ya
capturado. El listado impreso con el que Daniela preguntaba el plato persona por persona queda
explícitamente fuera del muelle: esa consulta es de la isla (H-06, fase 7).

---

# FASE 5 — Tableros: el de cada rol

No existe «el dashboard»: existe lo que cada persona necesita responder al abrir la app, y el
`home` por rol ya lo enruta. Dos naturalezas que no se mezclan: **operativo** (hoy, en vivo,
Realtime) y **de gestión** (periodo, tolera latencia). Regla transversal: cada tarjeta responde
una pregunta que alguien se hace de verdad — está escrita al lado de cada una; si no se pudo
escribir, la tarjeta no está. Un dato sin acción es decoración: cada número problemático lleva su
botón.

**Sobre los 8 tableros del encargo**: existen 7 roles asignables. `recepcion` se retiró (017) — su
necesidad («quién llega hoy con nombre, plan y tarifa») la cubre el Hoy de isla. **`financiera` no
existe como rol**; sus dos preguntas (kardex de tiquetes, liquidación de comisiones) hoy son
pantallas de gerencia/directora. Crear el rol es decisión de Rafa (§Decisiones); el tablero queda
especificado para quien lo herede.

| Rol · dispositivo | Arriba (la respuesta) | Después | Estado |
|---|---|---|---|
| **Daniela (asesora)** · PC | **Mañana antes que hoy**: cupos vendidos / capacidad, check-ins hechos, platos sin elegir, **solicitudes de cupo por aprobar en un clic** (regla 20). Pregunta: *¿mañana está listo para venderse y zarpar?* | Hoy: la franja (verbo del momento, embarcados, regreso) + pendientes ordenados por lo que detiene el zarpe + la lista | La estructura existe; **falta el bloque de aprobaciones** (no hay pantalla de solicitudes) y fijar «mañana» como bloque permanente — hoy es una pestaña |
| **Gerencia** · celular | **La meta, sola y grande** (`BloqueDato lg`; verde solo si cumplida). *¿Vamos a llegar?* | Hoy (pax vs promedio) · el periodo (`valor_a_cobrar()`, jamás `total_calculado`) · cartera vencida >90 (coral solo si hay) · **la franja del día** (zarpó, quién está de turno, en la isla ahora — lo pidió explícitamente y la franja ya lo trae) · enlaces a Informes y Cartera | Construido (paso 10). Falta conectar `destello` al cambio por Realtime (H-17) |
| **Directora** · PC/celular | El **Hoy operativo completo** (decisión del paso 10: ella opera; su resumen de negocio está a un toque en Informes) | Bloque comercial nuevo: ventas por asesora · cortesías del mes · reservas nuevas del día · **agencias que bajaron su volumen** (insumo del remarketing) | El bloque comercial es nuevo; «agencias que bajaron» depende del módulo del bloque 8 — el tablero nace con las tres primeras tarjetas y esa entra cuando exista su dato |
| **Admin de isla / guardia** · tablet | *¿Cuánta gente llega hoy y a qué hora?* — pax por zarpe con hora, desglose por plan y plato (pronóstico de cocina) | Reservas de restaurante con lancha externa (cuando exista H-02) · aviso de zarpe de regreso · «de pasadía, en la isla» (ContadorVivo) | Parcial: Isla y Cocina lo traen repartido; su «Hoy» de rol los junta sin construir pantalla nueva — es composición de lo que hay |
| **Financiera (sin rol aún)** | **Kardex diario encadenado de tiquetes**: iniciales · comprados · disponibles · consumidos (alojamiento / daytour, derivado del embarque) · saldo. *¿Alcanzan los tiquetes y cuadra el saldo?* | Liquidación de comisiones por agencia (existe en Metas) · alerta predictiva («quedan 30 y mañana van 87» — existe) | El kardex como pantalla **no existe**; su dato sí (019). Gated a la decisión de rol |
| **Super admin (Rafa)** · PC | Tickets de soporte abiertos con «me bloqueó» primero (existe: Reportes) | Actividad por usuario (existe) · salud: cola de sincronización por aparato, versión desplegada, últimos errores capturados por los tickets | Falta solo el bloque de salud; los datos ya llegan en el contexto de cada ticket |
| **Mesero** · tablet | `/isla` sin barra (consulta pura) | — | Tras el arreglo H-01 |

Criterios comunes, todos con dueño en el sistema: los números en vivo **destellan** al cambiar
(H-17) y **la lista no se reordena mientras se lee** (regla ya vigente: llegan filas y cambian
estados, no se reordena); **estado vacío por tablero** con `EstadoVacio` — un día sin operación
por bandera roja dice «Hoy no hay zarpe — bandera roja» en tono contingencia, no un hueco (H-09);
el **informe semanal de los lunes 8:30** (bloque 7) se arma de estas mismas vistas —
`avance_metas`, cartera, no-shows, cortesías, tiquetes — sin consultas nuevas: si el tablero y el
correo suman distinto, uno de los dos miente.

---

# FASE 6 — Calendarios

El negocio es cíclico y se vende contra días futuros; el objeto central es el día. Hoy el sistema
navega el tiempo con `SelectorDia` (Hoy/Mañana/Otro día) y `DateNav` (‹ ›) — excelente para operar
el día, ciego para ver el mes. Cuatro calendarios:

## 6.1 El calendario de operación (el principal — nuevo)

**Dónde vive: dentro de Reservas**, como vista `Mes` junto a la vista de día (pestaña con URL:
`/reservas` día · `/reservas/mes`). No es una ruta nueva del menú: es la otra forma del mismo
sustantivo — coherente con la navegación por sustantivos, igual que Historial es «la misma lista
con otro rango».

- **Cada celda del mes**: día del mes + **pax vendidos / capacidad del día** (suma de lanchas
  activas) + estado de fondo: con cupo (blanco) · casi lleno ≥80 % (arena-100) · lleno (tinta
  sobre arena-300) · cerrado sin operación (gris `linea`) · **contingencia** (token nuevo §3.1).
  Nada más en la celda: el mes completo cabe sin scroll horizontal en un portátil y en iPad
  horizontal (7 columnas × ~44 px mínimo por celda — la densidad manda).
- **Tocar un día abre el `PanelLateral`** (patrón existente) con: cupos por lancha, tiquetes
  disponibles contra lo vendido, las reservas del día (mini-lista), y **`Nueva reserva` con la
  fecha ya puesta** — desde ahí se vende. En pantallas chicas el panel es página completa (regla
  del patrón).
- **Venta de última hora**: la celda de mañana con cupo libre se marca (borde azul) hasta las
  11:59 p.m., y el Hoy de Daniela ya lo dice en su bloque de mañana (fase 5). El segundo corte de
  cocina a las 6 a.m. no es del calendario: es del cierre.
- **El pasado es histórico**: celdas de días idos en gris plano, abren su panel en solo-lectura
  (editar exige `super_admin`, que es la regla de cambios tras el cierre ya vigente).
- Semana: el mismo componente con 7 celdas más altas que muestran, además, los zarpes programados.
  Se construye después del mes solo si Daniela la pide — el mes responde la pregunta de venta.

## 6.2 El calendario de guardias (existe — se ajusta)

`/config/turnos` ya es esto: mes, un toque por día, panel con los tres turnos que se guardan al
elegir, coral **solo** donde hay confirmados y nadie en embarque (la lancha no sale), el pasado
nunca marcado. Permisos correctos por la 015: isla la asignan directora y gerencia; embarque y
recibimiento se los reparten las asesoras — y **gerencia ya tiene la sección**, como pide el
encargo. Ajustes: estado vacío del mes (H-09) y sello «quién asignó» ya sellado por la 030.

## 6.3 Eventos y reservas especiales (capa, no pantalla — gated al bloque 6)

Los eventos masivos (Gematours, 250 pax = 7 manifiestos), el restaurante externo programado y las
cortesías de inspección **no tienen calendario propio: son marcas sobre el de operación** — una
banda con nombre en la celda (evento) y conteos separados en el panel del día, porque sus reglas
de cobro difieren (regla 11). Diseñarles pantalla aparte sería un segundo calendario que hay que
mantener sincronizado a ojo. Depende de: migración 021 (eventos) y **H-02 resuelto**
(`restaurante_externo` sembrado) — sin eso no hay dato que pintar.

## 6.4 Temporada y clima (capa)

- **Temporada**: banda de fondo continua en el encabezado de las semanas (arena-100 alta ·
  sin banda baja), con el nombre al pasar el rango — es lo que decide tarifa (regla 4) y la ficha
  de temporada ya cuenta reservas por rango.
- **Bandera roja / contingencia**: un día cancelado por Capitanía toma el token `contingencia`, y
  su panel muestra **a dónde se reprogramó su gente** (dato del bloque 6/022 — hasta entonces, el
  panel lista las reservas afectadas con su estado, que ya existe).
- **Clima** (viento y oleaje de Open-Meteo, bloque 6): informa en el panel del día y en el cierre.
  **Nunca decide** — la autoridad portuaria y el capitán definen el zarpe.

---

# FASE 7 — Ruta por ruta

Las 30 rutas. Columnas: qué cambia con este plan (con su hallazgo), qué patrones adopta, y el
conteo de clics contra la fase 0. **Ninguna acción desaparece sin decir a dónde fue** — las
eliminaciones están todas en la columna de cambios con su destino. «—» = la pantalla está bien y
no se toca (también es un resultado de auditoría).

| Ruta | Tarea principal | Qué cambia (hallazgo → acción) | Patrones que adopta | Clics: hoy → queda |
|---|---|---|---|---|
| `/` Hoy (asesora) | Organizar el día | H-09: estado vacío con `EstadoVacio` (día sin reservas / bandera roja). Fase 5: bloque «Mañana» permanente + aprobaciones (regla 20) | EstadoVacio | — (ya óptimo) |
| `/` Hoy (gerencia) | ¿Vamos bien? | H-17: `destello` en los números por Realtime; `duration-500` → escala | — | — |
| `/` Hoy (directora) | Operar + comercial | Fase 5: bloque comercial (3 tarjetas; la 4.ª con el bloque 8) | BloqueDato, TarjetaPendiente | — |
| `/nuevo` | Crear reserva | **H-03: estado de error** (EstadoError + reintentar en la carga de catálogos). H-10: aviso en línea si `forma_pago=cortesia` contradice el tipo de ingreso («Una cortesía no lleva forma de pago — ¿es cortesía o pasadía?»). H-02: opción «Restaurante (lancha externa)» cuando la siembra exista | EstadoError, SeccionFormulario (reemplaza su copia local `Seccion`) | 5 → 5 (proteger); grupo con platos: 48 clics de selects → 24 (plato por defecto del plan, editable — regla 23: lo deducido visible y editable) |
| `/editar/:id` | Editar reserva | Las mismas tres de `/nuevo` | Ídem | — |
| `/embarque` | Embarcar y cerrar | **Fase 4.1 completa**: embarcar desde el veredicto (H-05), confirmación de cierre con resumen y cola (H-11), deshacer en regreso (H-04), lector auto-abierto en ida, inputs a `ui/` (H-16) | — (modo muelle: sus piezas son propias a propósito) | QR: 3/persona → **1/grupo**; cierre: 1 → 2 (el clic que compra la irreversibilidad) |
| `/isla` | ¿A qué cuenta va? | **H-06: la fila se vuelve pulsable** → panel del grupo con pasajeros y su plato (pronóstico del check-in, solo-lectura; la comanda sigue siendo de Zeus — frontera intacta). Cargando de texto → Esqueleto | PanelLateral, Esqueleto | Plato de una mesa: imposible → **1 toque** |
| `/cocina` | Pronóstico de almuerzos | — (RevisionCocina y restricciones ya resueltas) | — | — |
| `/cerrar` | Cerrar el tentativo | Etiquetas (H-20): `Imprimir tentativo`, `Imprimir cocina`, `Copiar mensaje`, `Guardar de nuevo`. Cargando → Esqueleto | Esqueleto | 2 → 2 (decisión: sin diálogo, es reabrible) |
| `/reservas` | El listado del día | Ya rediseñada (estado como dato, impuesto en palabras, 44 px). Queda: `gray-*` → tokens (24), thead compartido (H-16), `destello` en filas nuevas (H-17), vista **`/reservas/mes`** (fase 6.1) | ListaDelDia (encabezado de tabla), EstadoVacio | — |
| `/dia` | redirección | — | — | — |
| `/folios` | Folios de Zeus | H-12: título «Folios» (trunk test); banner esmeralda/ámbar → tokens verde/aviso; tooltip hover → texto bajo el botón; primaria única `Imprimir listado`; `GRP` púrpura → arena; `RefreshCw` se elimina (Realtime + refetch); input de folio → `ui/Input` | EstadoVacio, InsigniaEstado | — |
| `/historial` | Buscar reservas pasadas | Edit2 sin aria (H-14) → `BotonIcono`; `gray-*` (24) → tokens; filtros → `FiltroBarra`; vacío → `EstadoVacio` | FiltroBarra, EstadoVacio, BotonIcono | — |
| `/informes` | Desempeño del periodo | **H-13, el trabajo grande**: partirse en secciones; `KpiCard` → `BloqueDato`; `FilterSelect` ×8 → `FiltroBarra` + presets (los presets se quedan: son el camino del 90 %); paleta propia → una serie en `blue-600`, resto arena/línea; 55 `gray-*` → tokens; **absorbe Metas** (son rendimiento, no sección aparte — decisión ya tomada en propuesta §0) | BloqueDato, FiltroBarra, EstadoVacio | 8 filtros visibles → presets + panel |
| `/usuarios` | Dar acceso y rol | — (ya sobre ListaDelDia/ConfirmarAccion) | — | — |
| `/cartera` | Quién debe | ChevronDown ~30 px → `BotonIcono` 44; «Registrar pago» texto 13 px → botón `sm` | BotonIcono, EstadoVacio | — |
| `/metas` | Avance de metas | **Se muda dentro de Informes** (H-13). Sus modales de meta/comisión viajan con ella; `/metas` redirige | — | — |
| `/clientes`, `/clientes/:id` | ¿Ya vino? | — (perfil con panel, decidido y construido) | — | — |
| `/reportes` | Soporte | Etiquetas: `Con cerrados` / `Solo abiertos` (H-20) | — | — |
| `/config` | Índice + «Antes de operar» | H-07: deja de ser peaje (engranaje desplegable en escritorio); estado de error que falta | EstadoError | sección: 2 clics → 1 |
| `/config/:seccion` | Catálogos | Pestañas con URL (H-07); `Casilla` local → primitivo | Pestanas, Casilla | — |
| `/config/turnos` | Guardias del mes | Vacío del mes (H-09) | EstadoVacio | — |
| `/config/mensajes` | Plantillas y correos | — (recién construida, con vista previa) | — | — |
| `/config/actividad` | Bitácora | — | — | — |
| `/equipo` (+`/:tipo/:id`) | Lanchas, pilotos, empleados | Pestañas con URL (H-07); vacíos de lanchas y países (H-09); `Interruptor` local → sistema | Pestanas, EstadoVacio | piloto: 4 decisiones → 2 |
| `/config/planes/:id` | Ficha del plan | `EstadoDelPlan` y `Estado` gemelos → un componente (H-16) | — | — |
| `/config/temporadas/:id` | Ficha de temporada | Ídem | — | — |
| `/estilo` | El sistema, vivo | Documenta lo nuevo: BotonIcono, Pestanas, TarjetaOpcion, Casilla, estado encolado, token contingencia, léxico de etiquetas. Estado de error que falta | — | — |
| `/login` | Entrar | Amber → aviso; Eye sin aria → BotonIcono (H-14, H-18) | — | — |
| `/r/:token` | Check-in del cliente | **H-18**: adopta primitivos (`Campo`→Input/Select, `Aviso`→sistema, botones→Button); 25 `text-[px]` → escala. Es la cara del hotel ante el cliente: entra en la primera ola visual | ui/* | — |

---

# FASE 8 — Plan de ejecución

Etapas ordenadas por la tabla de la fase 1 (severidad × frecuencia), no por comodidad. Cada una
entregable sola, sin romper producción, detrás de la verificación completa: **273 pruebas · build
· lint en 0 errores · humo 21/21 · roles 6/6 · modos 3/3**. Migraciones: las escribe este plan,
**las corre el dueño** — ninguna etapa de front depende de una migración no corrida.

| Etapa | Alcance (hallazgos) | Archivos principales | Riesgo | Horas |
|---|---|---|---|---|
| **E0 · Lo roto y lo barato** ✅ **hecho** | H-01 mesero retirado (migración 033) · H-03 error en Reserva · H-09 vacío de un día pasado · H-14 los 8 aria-labels · H-20 renombres y léxico de «guardar» · H-21 duraciones (eco→240, los dos `duration-500`) · **H-17 parcial**: `tic-sale` conectado; `destello` y `eco` pasan a E2 y E3, que es donde se tocan sus pantallas | 033_sin_mesero.sql, navegacion.js, Reserva.jsx, FraseDelDia, ContadorVivo, Modal, Login, Historial, ListadoDia, Informes, Folios, Embarque, CerrarDia, Reportes, Mensajes, PrepararZarpe, Buscador, BarraVerComo, index.css | Bajo | 6–8 |
| **E1 · Primitivos** ✅ **hecho** | H-08, H-16, H-23: `BotonIcono` (con `etiqueta` obligatoria), `Pestanas`, `TarjetaOpcion`, `Casilla`; Button de 6 variantes a **4**; adopción en Config, Equipo, ListadoDia, PanelLateral, IndicadorSync, EnviarTarjetas, BuscadorAgencia, TarjetasPlan; `/estilo` documenta los cuatro; **`primitivos.test.js`** con 7 reglas que impiden reinventarlos | ui/BotonIcono·Pestanas·TarjetaOpcion·Casilla, ui/Button, Config, Equipo, Turnos, ListadoDia, Folios, TarjetasPlan, PanelLateral, IndicadorSync, EnviarTarjetas, BuscadorAgencia, Estilo | Bajo-medio | 8–10 |
| **E2 · Las tablas viejas al sistema** | H-12 Folios (trunk test, banner, candado en texto) · H-16 thead compartido · `gray-*` de ListadoDia/Historial/Folios/Login → tokens · vacíos → EstadoVacio (los 16 caseros) · H-15 primera ola de `text-[px]` (CheckInPublico) · H-18 check-in a primitivos | Folios, ListadoDia, Historial, Login, CheckInPublico | Medio | 10–12 |
| **E3 · Embarque (fase 4.1)** | H-05 embarcar desde el veredicto · H-11 cierre con resumen y cola · H-04 deshacer en regreso (si Rafa aprueba) · arranque en lector · inputs del muelle a `ui/` | Embarque.jsx, LectorQR.jsx, useEmbarque.js | **Alto** (la pantalla del día a día) — se prueba en `npm run demo` con el flujo completo ida+regreso antes de tocar producción | 8–10 |
| **E4 · Informes partido** | H-13 completo + absorber Metas + H-10 aviso de cortesía contradictoria en Reserva | Informes.jsx (→ 4 archivos), Metas.jsx, Reserva.jsx | Medio (solo forma: la corrección de plata ya se hizo) | 10–14 |
| **E5 · El calendario de operación** | Fase 6.1: `/reservas/mes` + panel del día + capa de temporada | ListadoDia (pestaña), CalendarioMes nuevo, PanelLateral | Medio | 12–16 |
| **E6 · La isla llega al plato** | H-06: fila pulsable + panel con pasajeros y plato. **Antes: validar con Daniela** que el pronóstico del check-in es lo que la isla necesita ver (frontera con Zeus intacta: la comanda no entra) | Isla.jsx | Bajo | 4–6 |
| **E7 · Tableros y datos que faltan** | Fase 5: bloque comercial de directora · Hoy de isla compuesto · aprobaciones de Daniela (regla 20) · perfil de agencia (la búsqueda ya lo espera) | Hoy.jsx, hoy/*, Clientes/FichaAgencia | Medio | 12–16 |
| **E8 · Lo gated** | H-02 siembra de `restaurante_externo` (migración nueva — la corre el dueño) + su rama en Reserva y su marca en calendario · kardex de financiera (si nace el rol) · capa de eventos (bloque 6) | migración, Reserva.jsx, calendario | Depende de decisiones §abajo | — |

> **Dos errores míos de auditoría, corregidos al ejecutar.** Van escritos porque un plan que
> esconde sus equivocaciones deja de servir para decidir: **H-19** (el buscador «por debajo del
> mínimo táctil») era falso — el CSS global ya lo cubría, y leí la clase sin leer la regla. Y
> **H-09** estaba mal descrito: el vacío de Hoy sí existía; el defecto era otro y peor. La primera
> versión de la prueba que escribí para blindar los tamaños **acusaba a `Select` y `DatePicker`,
> que son ejemplares** —ya declaran su compensación táctil—, y otra versión dio verde sin mirar
> nada porque exigía que el `className` estuviera en la misma línea que la etiqueta.

> **Dos hallazgos que solo aparecieron al mirar la pantalla** (H-24 y H-25), después de arreglar
> el vacío de un día pasado. Ninguna lectura del código los habría encontrado: el primero es un
> estado que se lee mal solo cuando la fecha está en el pasado, y el segundo es una contradicción
> **entre dos partes de la pantalla que están a 400 píxeles de distancia** — el vacío nuevo y el
> botón primario decían cosas opuestas. H-25 quedó arreglado en el momento; H-24 se anota porque
> exige decidir qué debe decir la franja de un día ido, y eso no es una decisión de código.

**Subconjunto mínimo para la entrega próxima** (mejora percepción sin tocar lógica de operación):
**E0 + E1 + E2** — unas 24–30 horas. Deja: cero botones sin etiqueta, cero `gray-*` en pantallas,
un solo sistema de botones, vacíos con carácter, Folios pasando el trunk test y el check-in del
cliente dentro del sistema. E3 (embarque) **no** entra en ese subconjunto a propósito: es la
pantalla de mayor riesgo y merece su propia ventana con prueba en muelle.

**Puede esperar, y queda escrito**: la vista semana del calendario (hasta que Daniela la pida),
el bloque de salud del super admin, los ~30 avisos `react-hooks/set-state-in-effect` (advertencias
del compilador, no defectos — razón documentada en eslint.config.js), y los 84 hex de printDoc.js
(hoja de impresión; se toca solo con edición manual por el mojibake conocido — nunca con scripts).

---

# FASE 9 — Dependencias: `motion`

**Veredicto: no se instala.** Tres razones medidas, no de gusto:

1. **El catálogo de animación de este producto ya existe en CSS puro y pesa cero.** Seis
   animaciones nombradas con duración y curva en `index.css`; lo que la fase 3 necesita es
   **conectar las tres muertas**, no capacidad nueva. Ninguna animación del plan (tic, eco,
   destello, aparecer, panel) exige springs, layout animations ni orquestación — que es lo que
   `motion` sabe hacer.
2. **El costo va justo donde más duele.** `motion` son ~30 KB gzip que el iPad del muelle
   re-descarga con cada despliegue en la señal de La Bodeguita. El encargo ya lo excluye de
   `/embarque` e `/isla`; con lazy() en oficina el bundle inicial no crece — pero entonces paga
   quien menos lo necesita (la oficina, donde el CSS ya alcanza) y no lo usa quien podría
   justificarlo (el muelle, donde está prohibido).
3. **La evidencia del repo**: con capacidad de sobra instalada (las 6 animaciones), la mitad no se
   usa (H-17). El cuello de botella de movimiento en DayPASS es adopción, no herramienta.

Impacto en el bundle por ruta: **ninguno — no hay cambio**. La primera carga sigue en ~106 KB
(medida del 10 de agosto tras la partición). Si algún día una pantalla de gestión pidiera una
transición de layout real (p. ej. el calendario reordenando meses), la puerta queda anotada:
`npm install motion`, `import { ... } from "motion/react"`, lazy() solo en esa ruta — y ese día
habrá un hallazgo que lo justifique, que es lo que este documento exige para todo.

---

# Lo que dejó la reunión con Daniela y las asesoras (12 de agosto)

Diez puntos, y conviene separarlos porque piden cosas distintas: **tres son fallas** (6, 9, 10),
**dos son decisiones de modelo** (1, 4) y **cinco son de flujo y proceso** (2, 3, 5, 7, 8). La
tabla dice a dónde va cada uno; el análisis completo quedó en la conversación del 12 de agosto.

| # | Lo que dijeron | Qué es | A dónde va |
|---|---|---|---|
| 10 | Los nombres se borran al guardar | **Falla.** Dos hipótesis; el diagnóstico las separa. La de lectura ya quedó blindada: la carga de pasajeros tragaba el error y pintaba la lista vacía, y guardar encima **borraba en la base lo que la pantalla no mostró** | Blindaje hecho · `reunion_12ago_diagnostico.sql` bloque A/B/E |
| 9 | No aparecen los almuerzos en el check-in | **Casi seguro datos, no código**: un plan sin filas en `opciones_plato` no pregunta plato (por diseño, para Diamond) — y un Gold sin platos cargados se ve idéntico. Los platos se cargan en la ficha del plan | Diagnóstico bloque C · catálogos (umbral A) |
| 6 | No permite hacer el check-in, no envía el QR | **Cadena**: el QR aparece al completar, completar exige firmar, firmar exige `documentos_legales` vigente (regla 12). La otra mitad —«no envía»— es la decisión pendiente: el envío server-side (Resend/WhatsApp) se pospuso; hoy el enlace se manda a mano con el botón | Diagnóstico bloque D · revisar la prioridad de Resend |
| 1 | Las agencias tienen tipos de precio (fidelidad, rack…) | **Decisión de modelo.** Propuesta: `tarifas` versionadas por plan × tipo de tarifa × temporada; la agencia apunta a su tipo (o convenio). La regla 4 queda intacta: el precio se congela al crear. La deducción de la regla 23 se completa: agencia → canal → **tarifa** | Migración nueva + E4; diseñar con la lista real de tipos que use el hotel |
| 4 | La lancha se decide en el embarque, no antes | **Decisión de modelo chica.** La asignación al crear pasa a ser *plan*, no contrato: en el muelle, **«Mover a otra lancha»** por grupo (1 toque + elegir). El manifiesto refleja la lancha real — regla 3: la operación manda | E3 (embarque) |
| 3, 8 | Agencias mandan «Rafael (x4)» sin nombres; llevar eso es complicado | **Flujo.** El mecanismo existe (plazas sin nombre + enlace + contador 3/24 + pendientes); lo que falta es el **tubo**: mandar el enlace de nombres **a la agencia** (no solo al titular), y la métrica de cumplimiento por agencia (perfil de agencia, E7) para la conversación con datos | E7 + enlace a agencia |
| 7 | Alojamiento sin datos; «no llevan cel», «no llevan documento», «¿y si reservan a las 10 p.m.?» | **Flujo, y el reencuadre importa: el documento físico nunca fue requisito — el dato es.** Y el sistema no puede ser más estricto que el papel que reemplaza: se escribe lo que dicten, como hoy. Capas: (1) el que llega a hospedarse **trae el documento puesto** —se lo van a pedir en el check-in del hotel— y se captura en el muelle en 2 min (dictado · foto del pasaporte en el celular · escaneo de cédula A3); (2) lo único que conviene recibir la noche anterior es el **aviso de cuántos**, por el cupo, no por los documentos — un WhatsApp de una línea que A1 vuelve registro; (3) el aviso de llegadas necesita dueño (coordinadora de alojamiento con cuenta, o el reporte de llegadas pegado). Pendiente del dueño que define el piso: qué tan estricta es la Capitanía en la práctica (pendiente #5 del plan v6) | E3 (alojado en 2 toques) + A1 + A3 |
| 2 | El grueso es agencias, no individuales | **Flujo.** El formulario arranca hoy en individual; si el grueso es agencia, la agencia va primero y el tipo se deduce de ella (regla 23) | Ajuste de formulario, barato |
| 5 | Daniela necesita ver los impuestos | **Por precisar con ella**: ¿el monto por reserva, el total del día para el muelle, o ambos? El valor del impuesto vive en `ajustes` (regla 22); falta mostrarlo multiplicado donde se cobra | Preguntar → ajuste chico |

## El plan de automatizaciones (12 de agosto)

El principio que lo ordena: **no obligar a nadie a cambiar cómo trabaja — hacer barato digerir lo
que ya mandan.** En orden sugerido de ejecución: A2 → A1 → A4 → A5 → A3 → A6.

| # | Automatización | Qué hace | Costo |
|---|---|---|---|
| **A1** | Pegar el WhatsApp → reserva prellenada | El mensaje de la agencia se pega tal cual y el formulario deduce pax, fecha, plan y agencia contra los catálogos; todo editable y con su «de dónde salió» (regla 23). También digiere el aviso de llegadas de alojamiento | Medio |
| **A2** | La agencia primero, con memoria | Elegir la agencia deduce canal, tarifa (cuando exista el modelo de tipos), tipo grupo, y plan/forma de pago usuales desde su historial | Bajo |
| **A3** | Escanear la cédula (PDF417) | Nombre + documento + categoría por fecha de nacimiento en un escaneo, en muelle y oficina. Prueba técnica en el iPad real antes de prometerla | Medio-alto |
| **A4** | El enlace se manda solo | El servidor manda el enlace al crear la reserva (titular y/o agencia) y recuerda automático si faltan nombres y zarpa mañana. Reabre la decisión de Resend/WhatsApp API | Edge Function + proveedor |
| **A5** | Walk-ins → reserva en un clic | Los «sin reserva» del día se agrupan y la oficina los convierte en reserva real. Cierra el ciclo de la reserva de las 2 a.m. | Bajo-medio |
| **A6** | Fotos en los platos | `foto` en opciones_plato + Storage; se sube desde la ficha del plan, el check-in muestra tarjetas con foto. Comprimida al subir, carga tardía | Bajo-medio |

**Sobre conectar el WhatsApp de la asesora a la plataforma — evaluado y descartado, que quede
escrito por qué.** La app de WhatsApp Business no tiene API legítima: los puentes no oficiales
arriesgan el número a un baneo, y ese número es el canal de ventas. La API oficial (Cloud API)
exige migrar el número — dejaría de funcionar en su teléfono — y obligaría a construir un inbox
completo para ~30 chats diarios. El valor se captura por partes sin riesgo: **A1** (la digitación),
los deep links `wa.me` que ya existen (el «ver todo», desde DayPASS hacia el chat), y **A4 con un
número dedicado del sistema** (el envío automático, sin tocar el número de ella). Si algún día el
volumen lo pide, el camino queda abierto: Cloud API + inbox open source con el contexto de DayPASS.
Esa decisión se toma ese día, con ese volumen.

# Decisiones que no puedo tomar solo (Rafa)

1. ~~**`mesero`**~~ ✅ **Decidido el 11 de agosto: se retira.** Migración **033 pendiente de
   correr** — hasta que corra, la base sigue aceptando el rol aunque la app ya no lo ofrezca.
2. **`restaurante_externo` (H-02)**: necesita migración nueva (sembrar el tipo N/N/S en
   `tipos_ingreso`). La escribo cuando digas; la corres tú. Hasta entonces, cada reserva de
   restaurante que se capture con el atajo actual falsea cupo y tiquetes — vale decidirlo pronto.
3. **Deshacer en el regreso (H-04)**: propongo la misma ventana de 8 s de la ida. Toca el flujo
   que alimenta la alerta de pernocta; quiero tu sí explícito.
4. **Confirmación al cerrar la ida (H-11)**: agrega un clic ×2–4 veces/día a cambio de que nunca
   se cierre un zarpe con cola pendiente sin saberlo. Propongo que sí.
5. **El lector auto-abierto en la ida** (fase 4.1): cambia el arranque actual de la pantalla.
   Propongo probarlo un día real con Daniela antes de fijarlo.
6. **¿Nace el rol `financiera`?** Su tablero (kardex + liquidación) queda especificado; sin rol,
   lo hereda gerencia.
7. **El plato en la isla (H-06 / E6)**: validar con Daniela que el pronóstico del check-in es la
   respuesta que la isla necesita — la frontera con Zeus no se mueve.
8. **Migración 032**: sigue pendiente de correr. Sin ella, la isla no puede cerrar el regreso.
9. **Metas dentro de Informes (E4)**: ya estaba decidido en la propuesta; lo relisto porque E4 lo
   ejecuta y cambia una entrada de menú de gerencia.

---

*Verificación de esta entrega: este documento, y nada más. Código de producto intacto; `motion` no
instalado (fase 9). Los inventarios de la fase 0 citan archivo:línea para que cualquier afirmación
se pueda comprobar contra el repo del 11 de agosto de 2026.*



