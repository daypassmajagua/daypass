# Auditoría del proyecto — 8 de agosto de 2026

**Método.** Todo lo de aquí sale de leer el código, las 17 migraciones y el bundle compilado, y de
correr las verificaciones locales (`npm test`, `npm run build`, `npx eslint src`, `npm run humo`).
**Nada se ejecutó contra producción**; los permisos se analizaron leyendo las migraciones (qué
concede y revoca cada una, en qué orden), no llamando funciones. Lo que solo la base puede
confirmar quedó en **`daypass/supabase/consultas/auditoria_integridad.sql`** — 6 bloques de
seguridad y 7 de datos, todos de solo lectura, cada uno con su explicación. Los corres tú y me
pegas los resultados.

**Clasificación:** 🔴 crítico · 🟠 importante · 🟡 menor.

> **Actualización, el mismo día.** Los arreglos del top 5 quedaron aplicados: la migración
> **`018_los_roles_se_cumplen.sql`** cubre C1 (candado de rol en las RPC), C2 (la tabla
> `registros` sin plata y `reservas` como vista dueña), C3 (`estado_embarques` con
> `security_invoker` y sin anon), M2 (`anotar` revocada) e I1 (el check-in empareja por id en
> vez de borrar y reinsertar); el front resolvió I2 (la hora de zarpe sale del ajuste), I3
> (reintento en los canales del muelle, más copia local si no hay señal) e I4 (estado de error
> en las nueve pantallas que traen datos). Verificado: 102/102 tests, build limpio, eslint 31
> (bajó uno), humo 9/9.
>
> **La 018 corrió en producción el mismo día** y `estado_de_los_roles.sql` respondió **9 de 9
> en verde**: los tres críticos quedan cerrados y verificados contra `pg_catalog` — C3 incluido,
> que era el que faltaba por confirmar. Y el conteo de `categoria = 'cortesia'` dio **cero en
> `pasajeros` y cero en `embarques`**: el solapamiento de la Fase 3 no tiene datos históricos,
> así que se cierra con un CHECK simple, sin valor huérfano que cargar.
>
> **Sigue pendiente tuyo:** los bloques A2–A6 y B1–B6 de `auditoria_integridad.sql` (los de
> datos: contradictorias, cortesías con folio, tokens eternos, días sin cerrar), y verificar en
> el tablero que el registro de cuentas esté cerrado.

**Lo que salió limpio, para que el informe sea justo:** la cadena de la puerta pública
(008→009→010→013→014) mantiene los 5 grants de `anon` correctos y cada redefinición posterior a
la 012 re-revoca como manda la casa; `.env` no está versionado ni estuvo nunca (el ignore está
bien escrito y `.env.demo`/`.env.example` son los únicos versionados, a propósito); el bundle no
contiene `service_role` y el único JWT incrustado dice `"role":"anon"`; las dos menciones de
`service_role` en el historial de git son prosa de documentación ("no va aquí"); la 016 barrió las
políticas viejas **por su contenido** y no por su nombre; la regla 6 (fechas) está impecable — 37
usos de `toISOString` y ninguno deriva fecha de calendario; y no hay ni un precio, correo ni
capacidad de lancha cableados en lógica de producción.

---

## 1 · Seguridad

### 🔴 C1 — Las RPC sensibles no comprueban rol: cualquiera con cuenta puede cerrar el día

**Qué.** La migración 012 le concedió `EXECUTE` a `authenticated` sobre **todas** las funciones
([012_cerrar_la_puerta.sql:71](daypass/supabase/migrations/012_cerrar_la_puerta.sql#L71)). Era lo
correcto entonces: urgía cerrarle la calle a `anon` y las políticas eran todavía
`authenticated_full_access`. Pero la 015 apretó las **tablas** por rol y nunca volvió sobre las
**funciones**. Como son `SECURITY DEFINER`, la RLS no las toca: el grep de
`tiene_rol|puedo_administrar|puedo_operar` sobre las migraciones 001–014 devuelve **cero** usos.
Ninguna comprueba nada por dentro.

**Dónde.** `cambiar_estado_manual`
([003:238](daypass/supabase/migrations/003_dia_operativo.sql#L238)), `cerrar_tentativo` y
`cerrar_dia` ([005:29, 005:64](daypass/supabase/migrations/005_sello_del_cierre.sql#L29)),
`programar_zarpes` ([006:219](daypass/supabase/migrations/006_zarpes_embarques.sql#L219)),
`fijar_cierre_cocina` ([010:96](daypass/supabase/migrations/010_cierre_cocina.sql#L96)),
`programar_regresos` y `cerrar_zarpe`
([011:108, 011:141](daypass/supabase/migrations/011_manifiesto_y_regreso.sql#L108)),
`marcar_revision_cocina` ([013:79](daypass/supabase/migrations/013_el_plato_es_pronostico.sql#L79)).

**Por qué importa.** El mesero —o cualquier cuenta de Supabase, tenga perfil o no— puede llamar
`cerrar_dia`, cambiar el estado de una reserva o programar zarpes contra la API con la clave del
navegador y su sesión. La 015 se construyó justamente porque "darle `/cocina` a cocina sería
entregarle el negocio entero"; estas funciones son la puerta trasera de esa promesa. Y se agrava
con un detalle que el repo no puede verificar: si en el tablero de Supabase el registro de cuentas
está abierto (Authentication → Sign In / Providers), "cualquiera con cuenta" significa
**cualquiera en internet**, porque el alta se puede invocar por API aunque la app no tenga
pantalla de registro.

**Qué propondría.** Migración `018`: redefinir las ocho con su candado al inicio (`if not
tiene_rol(...) then raise`), re-revocar tras cada `create or replace`, y terminar con la
comprobación de las 5 de `anon` — el molde exacto ya está en la 013. Y tú verificar en el tablero
que el registro de cuentas esté cerrado. El bloque A2 del `.sql` te da la lista real de lo que
`authenticated` puede ejecutar hoy.

### 🔴 C2 — La tabla `registros` se puede leer cruda, con precios, por todo el equipo

**Qué.** La vista `reservas` enmascara el dinero, y la app la usa bien (verificado: 6 lecturas por
la vista, escrituras contra la tabla). Pero la política de lectura de la **tabla** es
`soy_del_equipo()` ([015_roles.sql:437-440](daypass/supabase/migrations/015_roles.sql#L437)), y
PostgREST expone las tablas igual que las vistas. Un mesero con su sesión puede pedir
`/rest/v1/registros?select=precio_adulto,total_calculado` y recibir todos los precios. La promesa
de la 015 —"quien consulte por PostgREST con su propia sesión recibe null igual"— hoy solo se
cumple si consulta **la vista**; nada lo obliga.

A esto se suma la escritura: `registros_cambio` deja pasar a quien opera muelle o isla con
`with check (true)` ([015:447-457](daypass/supabase/migrations/015_roles.sql#L447)), así que
`admin_isla` puede además **modificar** `precio_adulto` o `folio_zeus` por la API, sin pasar por
ninguna pantalla.

**Por qué importa.** Es la promesa central de la fase de roles. El umbral B se declaró cruzado
sobre "la isla no ve el dinero", y por la puerta del REST sí lo ve.

**Qué propondría.** En la misma `018`, y es una decisión de diseño más que un parche:
- Lectura: restringir el `select` de la tabla a `puedo_ver_dinero()` y que el resto del equipo
  lea **solo** la vista. Eso obliga a que `reservas` deje de ser `security_invoker` (si no, la
  RLS de la tabla también vaciaría la vista para la isla): pasaría a correr como dueña, con su
  propio `where soy_del_equipo()` — el patrón estándar de Supabase para enmascarar columnas.
- Escritura: cambiar el `with check (true)` por una condición que preserve lo que muelle e isla
  no deben tocar, o mover sus escrituras a funciones con candado.
- **Ojo con un efecto lateral:** `useRegistrosEnVivo` está suscrito por Realtime a la tabla
  `registros` ([useDiaOperativo.js:104-115](daypass/src/hooks/useDiaOperativo.js#L104-L115)), y
  Realtime respeta la RLS: si la isla pierde el `select` de la tabla, deja de recibir esos
  eventos. El callback solo dispara un refetch (no usa el payload), así que la solución puede ser
  suscribir a la isla por `pasajeros`/`embarques`, pero hay que diseñarlo, no solo cerrar.

### 🔴 C3 — `estado_embarques` corre como su dueño y puede estar abierta a `anon` (verificar)

**Qué.** Las vistas no tienen RLS. `reservas` se creó con `security_invoker = true` a propósito;
`estado_embarques` ([006:128](daypass/supabase/migrations/006_zarpes_embarques.sql#L128), ampliada
en [011:81](daypass/supabase/migrations/011_manifiesto_y_regreso.sql#L81)) **no** — corre con los
permisos de su dueño, que se salta la RLS de `embarques`. Y Supabase concede por defecto `select`
sobre lo nuevo de `public` a `anon` y `authenticated`; la 012 solo cambió el default de las
**funciones**. Ninguna migración revocó nada sobre esta vista, y `estado_de_los_roles.sql` nunca
la miró: sus comprobaciones cubren funciones, políticas y la vista `reservas`.

**Por qué importa.** Si el grant sigue ahí —el bloque **A3** del `.sql` lo responde en una
consulta—, cualquiera con la clave `anon` del bundle lee nombre, documento, tipo de documento y
país de cada persona embarcada, sin sesión. Además de crítico en sí, es exactamente el tipo de
dato que la Ley 1581 protege, con la revisión de habeas data todavía pendiente.

**Qué propondría.** Correr A3 primero. Si confirma: en la `018`,
`alter view estado_embarques set (security_invoker = true)` más `revoke select ... from anon` —
la app la lee siempre con sesión ([useEmbarque.js:220](daypass/src/hooks/useEmbarque.js#L220)) y
el equipo tiene `select` sobre `embarques`, así que nada se rompe. Y añadirle a
`estado_de_los_roles.sql` una comprobación 8: ninguna vista legible por `anon`, ninguna vista
sin `security_invoker`.

### 🟠 I8 — Verificaciones de tablero que el repo no puede hacer

Registro de cuentas cerrado (agrava C1); y que la URL del proyecto y la clave `anon` de Vercel
sigan siendo las del proyecto correcto. Dos minutos, y las dos primeras condicionan la severidad
real de todo lo anterior.

### 🟡 M2 — `anotar()` está concedida a todo el equipo y el front no la usa

`grant execute ... to authenticated` ([015:532](daypass/supabase/migrations/015_roles.sql#L532)),
pero `rpc('anotar'` no aparece en `src`: la llaman solo las funciones del servidor. Cualquier
usuario puede escribir en la bitácora acciones arbitrarias (con su propio nombre y rol — no puede
suplantar, pero sí ensuciar). Revocarla de `authenticated` no rompe nada hoy.

### 🟡 M3 — Dentro del trío que administra, la política no distingue jerarquía

`perfiles_escritura` es `puedo_administrar()` a secas
([015:380-382](daypass/supabase/migrations/015_roles.sql#L380)): la directora o gerencia pueden
autopromoverse a `super_admin`, o desactivar al `super_admin`, por la API. La pantalla de
Usuarios impide autodesactivarse; la política no. Entre tres personas de confianza es tolerable —
pero que quede escrito que es confianza, no control.

---

## 2 · Integridad de datos

Las consultas están en
[auditoria_integridad.sql](daypass/supabase/consultas/auditoria_integridad.sql), bloques B1–B7,
cada una con el comentario de qué revela. En resumen: **B1** pasadías con forma de pago cortesía
(la contradicción que `/isla` muestra como "revisar antes de cobrar"); **B2** cortesías con folio
(regla 18); **B3** confirmadas de días pasados sin un solo nombre, más las que se congelaron en
`confirmada`/`en_isla` para siempre; **B4** tokens eternos (de días pasados, ni finalizados ni
con `expira_at` — los que la 011 cierra solo si el regreso se cerró); **B5** zarpes y días
pasados sin cerrar; **B6** embarques que no apuntan a nadie; **B7** el tamaño del error de cocina
con los infantes, pasado contra futuro, más el conteo de `categoria='cortesia'` que decide si el
solapamiento de la Fase 3 tiene datos históricos o está limpio.

Dos hallazgos de modelo que las consultas no ven porque son de comportamiento:

### 🟠 I1 — El check-in del cliente choca con la inmutabilidad de los embarques

**Qué.** `guardar_pasajeros_por_token` borra y reinserta la lista completa
([014:179](daypass/supabase/migrations/014_infantes_almuerzan.sql#L179)). `embarques.pasajero_id`
es `on delete set null` ([006:72](daypass/supabase/migrations/006_zarpes_embarques.sql#L72)) — y
ese `set null` es un UPDATE sobre `embarques`, que el trigger `embarques_sin_update`
([006:118](daypass/supabase/migrations/006_zarpes_embarques.sql#L118)) rechaza con "Los embarques
no se corrigen".

**Por qué importa.** En cuanto el muelle marca el primer `check_in` de un pasajero con nombre,
**todo guardado posterior de esa reserva falla entero**: el del cliente desde su teléfono (el
check-in sigue abierto hasta la hora de zarpe, y el embarque ocurre antes, 8:20–8:30 — la ventana
de choque existe todos los días) y el de la oficina si edita la lista. El error que le llega al
cliente es el mensaje crudo del trigger, que no le dice nada. De paso, cada borrado+reinserción
cambia los `id` de los pasajeros, lo que ya obliga al malabar de `come_previo` para no perder
`almuerza` — y en la Fase 3 obligaría a otro para `persona_id`.

**Qué propondría.** Dejar de borrar: casar por posición o por `id` recibido y hacer
update/insert/delete dirigido, borrando solo a quien de verdad salió de la lista (y si ese tiene
embarque, rechazar **ese** caso con mensaje claro, no todo el guardado). Es la versión que la
Fase 3 necesita de todos modos.

### 🟡 M6 — `tipos_ingreso.guia` tiene las tres banderas en null

([007:98](daypass/supabase/migrations/007_modelo_operacion.sql#L98), "por definir con el hotel").
La regla 11 deriva todo de esas banderas; un tipo con null se comporta como indefinido en
cualquier conteo. Está esperando la respuesta del hotel desde julio — o se define o se desactiva.

---

## 3 · Cumplimiento de las 24 reglas

### Regla 6 (fechas) — ✅ limpia

37 usos de `toISOString`, todos timestamps legítimos (instantes de eventos, colas, presencia).
Ninguno deriva fecha de calendario. Los helpers `hoyLocal()`/`aFechaLocal()` se usan en 34 sitios.

### 🟠 I5 — Regla 7 (controles nativos): 9 violaciones

Los wrappers `ui/Select`, `ui/DatePicker` y `ui/DateNav` están limpios por dentro — ninguna
violación es excusable como implementación:

| Dónde | Qué |
|---|---|
| [Embarque.jsx:198](daypass/src/pages/Embarque.jsx#L198), [:221](daypass/src/pages/Embarque.jsx#L221) | `<select>` nativos: tipo de documento y país del walk-in |
| [CheckInPublico.jsx:360](daypass/src/pages/CheckInPublico.jsx#L360), [:375](daypass/src/pages/CheckInPublico.jsx#L375), [:384](daypass/src/pages/CheckInPublico.jsx#L384), [:401](daypass/src/pages/CheckInPublico.jsx#L401) | `<select>` nativos: tipo de documento, país, categoría y plato — la pantalla que ve el cliente |
| [HoraDeZarpe.jsx:88](daypass/src/components/config/HoraDeZarpe.jsx#L88), [:98](daypass/src/components/config/HoraDeZarpe.jsx#L98), [:107](daypass/src/components/config/HoraDeZarpe.jsx#L107) | dos `<input type="time">` y un `<select>` en Configuración |

En iPad (el aparato del muelle) el `<select>` nativo abre la rueda de iOS, que es exactamente lo
que la regla quiere evitar. Propuesta: es trabajo mecánico de reemplazo por `ui/Select`; el de
plato en CheckInPublico merece además revisión de diseño porque es la cara al cliente.

### 🟡 M1 — Regla 8 (palabras prohibidas): 5 cadenas visibles

- "El registro en línea cierra a las…" — [HoraDeZarpe.jsx:65](daypass/src/components/config/HoraDeZarpe.jsx#L65)
  (toast) y [textosPublicos.js:70](daypass/src/lib/textosPublicos.js#L70). Matiz: aquí "registro"
  no es la jerga de base de datos que la regla persigue sino "registro en línea" como acto de
  registrarse — la misma frase vive en el mensaje de error de la migración 014. Decisión tuya si
  se tolera o se cambia por "check-in".
- `title="Ver el estado de la sincronización"` —
  [IndicadorSync.jsx:54](daypass/src/components/layout/IndicadorSync.jsx#L54), en el componente
  cuyo comentario de cabecera promete "nunca dice «sincronizar»".
- "N registro(s)" y "Registros" **impresos en el manifiesto** —
  [printDoc.js:386](daypass/src/lib/printDoc.js#L386), [:430](daypass/src/lib/printDoc.js#L430).
  Para Capitanía debería decir "reservas".
- El tuteo colombiano es consistente en todo lo demás; cero formas de usted.

### 🟠 I6 — Regla 22 (constantes operativas en el código): 11 reales + 7 defaults

Las que cambian comportamiento:

| Dónde | Qué | Debería salir de |
|---|---|---|
| [useEmbarque.js:91](daypass/src/hooks/useEmbarque.js#L91) + [Embarque.jsx:48](daypass/src/pages/Embarque.jsx#L48) | **`'09:00'` cableada y el ajuste jamás consultado**: `onProgramar()` se llama sin hora, así que los zarpes del día siempre se programan a las 09:00 aunque el zarpe real sea 8:30. `programarRegreso`, 14 líneas abajo, sí lo hace bien (pasa `null` y decide el servidor) | `checkin_cierra_hora` / una clave `hora_zarpe` |
| [textosPublicos.js:74](daypass/src/lib/textosPublicos.js#L74), [:144](daypass/src/lib/textosPublicos.js#L144) | "dos días antes" cableado en ES y EN; si `checkin_abre_dias` pasa a 3, el texto miente | `checkin_abre_dias` |
| [textosPublicos.js:31](daypass/src/lib/textosPublicos.js#L31), [:105](daypass/src/lib/textosPublicos.js#L105) | "Niño (3 a 8)" cableado | `edad_max_infante` + clave nueva para el 8 |
| [enlaceReserva.js:39-52](daypass/src/lib/enlaceReserva.js#L39-L52) | Las dos plantillas de WhatsApp completas, con "muelle de La Bodeguita" incluido — los únicos textos que el cliente recibe fuera de la app, no editables por la operación | tabla de textos / `ajustes` |
| [printDoc.js:748](daypass/src/lib/printDoc.js#L748) | "Regreso a La Bodeguita" / "Ida a Islas del Rosario" en el manifiesto | ficha del muelle (Fase 3 la trae: instituciones) |
| [CheckInPublico.jsx:33-34](daypass/src/pages/CheckInPublico.jsx#L33) | `'08:30'` como fallback ya formateado: un fallo de red le muestra al cliente una hora inventada | mejor no mostrar hora que mostrar una falsa |

El resto (fallbacks `?? 3`, `'08:30'`, `'2'` que repiten el valor del ajuste, semilla de capacidad
30 en Equipo) son 🟡: el ajuste sí se lee, el default solo miente si la red falla.

### 🟠 I7 — Colores fuera de tokens: 155 `gray-*` + 271 hex

- **Lo grave: 20 `gray-*` dentro de `src/components/ui/`** — Select, DatePicker, Input, Modal,
  Badge, Stepper — y el `danger` de [Button.jsx:6](daypass/src/components/ui/Button.jsx#L6) en hex.
  El sistema de diseño se contamina a sí mismo; todo lo que se construya encima hereda el vicio.
- Concentración en pantalla: [Embarque.jsx](daypass/src/pages/Embarque.jsx) (74 hex — `#101223`
  aparece 35 veces y `#3a3d52` 22 en la app: son tokens de facto sin nombre, pedían nacer como
  token), [Informes.jsx](daypass/src/pages/Informes.jsx) (56 `gray-*` + 44 hex, paleta Recharts
  duplicada a mano — el bloque 8 ya contempla rehacerla), [Isla.jsx](daypass/src/pages/Isla.jsx)
  (30 hex), [ListadoDia.jsx](daypass/src/pages/ListadoDia.jsx) (29 `gray-*`),
  [Historial.jsx](daypass/src/pages/Historial.jsx) (25).
- Los 84 hex de [printDoc.js](daypass/src/lib/printDoc.js) son CSS de impresión — defendibles
  (una hoja impresa no lee Tailwind), pero son 27 valores sin una sola constante compartida y con
  grises distintos a los de pantalla.

Propuesta: bautizar `#101223` y `#3a3d52` como tokens y reemplazar mecánicamente; limpiar `ui/*`
primero (es poco y renta en todo); Informes se deja para su rehechura ya planeada.

### Regla 2 (texto libre) — lo que queda

`zarpes.capitan` y `zarpes.tripulacion` como `text`
([006:36-37](daypass/supabase/migrations/006_zarpes_embarques.sql#L36)) — superadas por
`piloto_id` y `zarpe_empleados` de la 007 y sin uso en el front (solo el demo las pone en null);
ver §5. `vendida_por` y `agencia_nombre` están documentadas como históricas con su reemplazo ya
creado — correcto. El nombre/documento del walk-in en `embarques` es texto por naturaleza.

---

## 4 · Estado funcional

| Verificación | Resultado |
|---|---|
| `npm test` | **102/102 en verde** (6 archivos, 718 ms) |
| `npm run build` | **Limpio**, 1.3 s. Aviso: un solo chunk JS de **1.53 MB** (452 KB gzip) |
| `npx eslint src` | **32 problemas (28 errores, 4 avisos)** — igual a la línea base del CLAUDE.md. **No subió.** El encargo decía 36; hoy no hay 36 por ninguna parte: son 32, las familias conocidas (`set-state-in-effect`, memoización del compilador, 4 variables sin uso) |
| `npm run humo` | **9 de 9 pantallas cargan sin errores de consola** (ya no son siete: Usuarios y Check-in público entraron a la prueba) |

### 🟠 I4 — Los tres estados: 12 de 15 pantallas no muestran el error

Solo [Usuarios.jsx](daypass/src/pages/Usuarios.jsx), [Config.jsx](daypass/src/pages/Config.jsx) y
[CheckInPublico.jsx](daypass/src/pages/CheckInPublico.jsx) pintan un estado de error. El resto
tiene cargando y vacío pero no error — y lo revelador es que los hooks **sí** lo capturan
([useRegistros.js:20](daypass/src/hooks/useRegistros.js#L20) hace `setError` y lo devuelve); las
pantallas lo ignoran. Consecuencia: un fallo de red en Hoy, El día, Historial, Embarque o Isla se
ve como **"no hay reservas"**, que es peor que un error porque miente — en el muelle, "no hay
reservas" y "no pude cargar las reservas" llevan a decisiones opuestas. El plan (bloque 1) declara
los tres estados obligatorios. Propuesta: un componente de error del sistema de diseño y pasada
mecánica por las 12.

### 🟠 I3 — Realtime sin reconexión justo donde la señal es peor

`canalConReintento` existe ([canalConReintento.js](daypass/src/lib/offline/canalConReintento.js))
y `useDiaOperativo` lo usa en sus dos canales. Pero los dos canales de **Embarque** van con
`.subscribe()` pelado: [useEmbarque.js:84-89](daypass/src/hooks/useEmbarque.js#L84-L89) (zarpes) y
[:311-318](daypass/src/hooks/useEmbarque.js#L311-L318) (embarques). Si el canal se cae en el
muelle —el sitio donde eso pasa a diario—, el iPad deja de ver lo que marca el otro dispositivo y
nadie se entera; la limpieza al desmontar sí está. Propuesta: envolverlos en `canalConReintento`,
que para eso se escribió; son dos cambios de forma.

### 🟡 M5 — Peso del bundle

1.53 MB en un solo chunk y precache de PWA de 1.9 MB. Recharts es de una sola pantalla
(Informes): partirlo con `import()` dinámico bajaría a la mitad la primera carga y cada
actualización del service worker en el iPad del muelle. No urge; renta cuando toquen Informes.

---

## 5 · Lo que quedó a medias

### Migraciones cuyo comportamiento fue reemplazado — el mapa de vigencias

Leer la migración donde una función **nació** induce a error; esta es la tabla de dónde vive la
versión vigente:

| Función / objeto | Nace | Redefinida en | **Vigente** |
|---|---|---|---|
| `reserva_publica` | 008 | 009, 010 | **014:77** |
| `guardar_pasajeros_por_token` | 008 | 009, 010, 013 | **014:143** |
| `firmar_por_token` | 008 | — | **009:260** |
| `cocina_abierta` | 010 | — | **013:41** |
| `cerrar_tentativo` / `cerrar_dia` | 003 | — | **005:29 / 005:64** |
| triggers de bitácora (`registrar_cambio_estado` y compañía) | 003 | — | **004** (ahí se hicieron DEFINER) |
| `cerrar_zarpe` | 006 | — | **011:141** (ahí vive el regreso y la finalización de tokens) |
| vista `estado_embarques` | 006 | — | **011:81** |
| políticas de `ajustes` | 009 | — | **015:427** |
| todas las políticas `authenticated_*` | 001–008 | — | **015 + 016** (la 016 barrió por contenido las dos que la 015 dejó vivas) |

El caso que más induce a error: la **008** parece la referencia de la puerta pública y dos de sus
tres funciones ya no son esas. Propuesta barata: una línea de comentario al tope de 008, 003 y
006 — "versión superada, la vigente está en X" — la próxima vez que se toque ese directorio.

### Columnas, tablas y valores sin uso tras cambios de decisión

- **`clientes`** ([001:57](daypass/supabase/migrations/001_initial_schema.sql#L57)): nadie la lee
  ni la escribe en todo `src`; `registros.cliente_id` viaja siempre en null. La Fase 3
  (`personas`) decide su destino — absorberla o retirarla; no construirle nada encima.
- **`zarpes.capitan` y `zarpes.tripulacion`** (006:36-37): texto libre superado por `piloto_id`
  (007) y `zarpe_empleados`. Sin uso fuera del demo. Candidatas a comentario de "histórico" como
  el de `vendida_por`.
- **`rol 'recepcion'`**: huérfano en el enum con su CHECK (017) — resuelto y documentado; la
  etiqueta legado en `navegacion.js` es correcta.
- **`categoria_pasajero = 'cortesia'`**: el solapamiento sigue vivo; es de la Fase 3 y el bloque
  B7 del `.sql` dice si hay datos históricos que lo complican.
- **`fake-indexeddb`** ([package.json:44](daypass/package.json#L44)): dependencia huérfana —
  nada la importa. O se borra o se usa (las pruebas de la cola offline la querrían).
- **`printDoc.js:187`** (`confirmados` sin uso) y **`:177`** (escape innecesario): dos de los 32
  de eslint, triviales.

### Código de fases anteriores que ya no aplica

- **La rama 42P01 de `usePerfil`**
  ([usePerfil.js:37-47](daypass/src/hooks/usePerfil.js#L37-L47)): el fallback a rol `asesora`
  "por si la 015 no ha corrido". La 015 corrió; la rama es código muerto que, si algún día un
  error devolviera ese código por otra causa, vestiría de asesora a quien no lo es (solo en
  menú — la RLS lo dejaría sin datos). Retirarla junto con `ROL_POR_DEFECTO`.
- **El comentario de `cambiarEstadoManual`**
  ([useDiaOperativo.js:84-87](daypass/src/hooks/useDiaOperativo.js#L84-L87)): dice que existe
  "porque hasta el sprint del muelle no hay operación que dispare los estados". El muelle existe;
  la función sigue siendo válida como excepción auditada (regla 3), pero el comentario cuenta una
  historia vieja.
- **`ETIQUETA_ROL` y las notas de "ocho roles"** en comentarios de `navegacion.js` y las pruebas:
  son siete desde la 017; cosmético.

---

## Las cinco cosas que arreglaría primero

1. **Correr A1–A6 del `.sql` y, con eso confirmado, la migración `018` de cierre** (C1 + C2 + C3
   juntos: candado de rol en las ocho RPC, lectura de `registros` restringida con la vista
   rediseñada, `security_invoker` y revoke en `estado_embarques`). Es una sola migración con el
   molde ya probado de la 013/015, y es la diferencia entre "los roles existen" y "los roles se
   cumplen". Sin esto, el umbral B está cruzado solo de nombre.
2. **Verificar en el tablero que el registro de cuentas esté cerrado.** Dos minutos. Decide si C1
   es "un mesero podría" o "cualquiera en internet podría".
3. **El choque check-in ↔ embarques (I1).** Reescribir `guardar_pasajeros_por_token` para no
   borrar y reinsertar. Falla hoy, todos los días, en la ventana 8:20–8:30, con el cliente
   delante; y la Fase 3 necesita exactamente esa reescritura para `persona_id`.
4. **La hora de zarpe cableada (I2/regla 22).** `onProgramar()` ignora el ajuste y programa
   siempre a las 09:00. Dos líneas en el front (el patrón correcto está 14 líneas abajo, en
   `programarRegreso`) y deja de mentirle al muelle.
5. **Estado de error en las 12 pantallas y reintento en los dos canales de Embarque (I4 + I3).**
   Van juntas porque son la misma promesa: que el muelle distinga "no hay" de "no pude cargar", y
   que se recupere solo cuando vuelva la señal. Los hooks ya traen el error y `canalConReintento`
   ya existe; es conectar, no construir.

Lo demás —controles nativos, colores, textos operativos, palabras prohibidas— es deuda real pero
no muerde mañana: conviene calendarizarla por archivo (Embarque e Isla concentran casi todo) en
vez de por regla.
