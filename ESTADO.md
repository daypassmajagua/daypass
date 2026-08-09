# DayPASS — Estado del proyecto

**Corte:** 8 de agosto de 2026 · commit `d5cc3fa` · 48 commits
**Producción:** https://daypass-seven.vercel.app · **Repo:** github.com/daypassmajagua/daypass
**Base de datos:** Supabase `ubtmixgqwfwvartciqyr` · migraciones **001–016**, todas
corridas y verificadas contra `pg_proc`, `pg_class` y `pg_policies`
(`supabase/consultas/estado_de_los_roles.sql`, 7 de 7 en verde)

Este documento es el estado real verificado contra el código y contra la base en
producción, no un resumen de intenciones. Donde dice "verificado" es porque se
comprobó, y donde hay un supuesto sin confirmar, lo dice.

---

## 1 · Qué está construido y funcionando

### Fases del plan v5

| Fase | Qué era | Estado |
|---|---|---|
| **A** | Capa offline (PWA + Dexie + cola + indicador) | ✅ Completa |
| **B** | Modelo de la operación real (`007`) | ✅ Completa |
| **C** | Check-in público, firma y tarjetas (`008`) | ✅ Completa **salvo** correo del servidor |
| **D** | Muelle completo: manifiesto, regreso, QR | ✅ Completa **salvo** envío por correo |
| **E** | Isla | 🟡 Parcial — ver §4 |
| **F** | Pagos, tiquetes, metas | ❌ No empezada — **ver §5, es lo que queda para apagar el Excel** |
| **G** | Roles con RLS real | ✅ Completa (`015`, `016`) — ocho roles, no nueve: cocina salió |
| **H** | UX de Config e Informes, pulido | 🟡 Config hecha; Informes pendiente |

### Pantallas (17 rutas)

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Coordinadora | "Hoy": pendientes del día con acción directa |
| `/nuevo`, `/editar/:id` | Coordinadora | Alta y edición de reserva; pega listados de agencia |
| `/dia` | Coordinadora | Listado del día, folios en línea, envío de enlaces |
| `/cerrar` | Coordinadora | El cierre: tentativo, conteo de cocina, tarjetas |
| `/cocina` | Isla | **Almuerzos** — pronóstico, no orden (ver §3) |
| `/embarque` | Muelle (iPad) | Embarque y regreso, manifiesto, lector de QR |
| `/isla` | Mesero | **¿A qué cuenta va?** — folio para cargar en Zeus |
| `/folios` | Coordinadora | Listado para crear folios en Zeus y cargarlos |
| `/equipo` | Coordinadora | Lanchas, pilotos, empleados |
| `/historial`, `/informes` | Coordinadora | Informes sin fase UX todavía |
| `/config` | Coordinadora | Catálogos y constantes de la operación |
| `/usuarios` | Quien administra | Quién entra y qué ve; cuentas sin rol todavía |
| `/r/:token` | **Cliente, sin login** | Check-in: nombres, plato, condiciones, firma, pase QR |

### Números

- **16.066 líneas** de JS/JSX · **26 tablas** · **16 migraciones** (3.810 líneas de SQL)
- **102 pruebas automáticas** en Vitest, 6 archivos, más dos de navegador con Puppeteer:
  `npm run humo` (9 pantallas cargan limpias) y `npm run roles` (7 roles ven lo suyo)
- Modo demo completo (`npm run demo`): mock de ~1.300 líneas que replica triggers, RPC, realtime y presencia

---

## 2 · Decisiones operativas tomadas en el camino

Estas **cambian el plan v5** y conviene que queden registradas, porque varias
contradicen lo que estaba escrito.

### 2.1 El check-in cierra cuando zarpa la lancha, no cuando cierra el día

**El plan decía:** "El check-in cierra cuando Daniela cierra el día."

**Problema encontrado:** Daniela cierra entre las 7 y las 10 de la noche. Quien
abría su enlace a las 10:05 no podía registrar nombres, elegir plato ni firmar — y
la noche es justo cuando la gente lo hace. Peor: el único botón que mandaba el
enlace vivía en la pantalla de cierre, así que el cliente lo recibía exactamente
cuando dejaba de funcionar.

**Ahora:** el enlace se manda al **crear la reserva** (y desde el listado del día).
El check-in cierra a la **hora de zarpe**, configurable, por defecto 08:30.
Migración `009`.

Son **dos ventanas distintas**, y no conviene confundirlas:

- **Nombres:** desde que la reserva existe hasta que zarpa. Una agencia que vende
  con tres semanas manda su listado cuando lo tiene.
- **Plato y firma:** desde N días antes (por defecto 2) hasta que zarpa.

### 2.2 El plato del check-in es un pronóstico, no una orden

**Decisión del dueño (8 ago):** el almuerzo lo **comanda el mesero en la mesa**, y
esa comanda es la que manda. **Cocina no tiene perfil** en el sistema.

**Consecuencias implementadas (`013`):**

- El plato **ya no se congela**: se puede cambiar hasta que zarpa la lancha. Una
  estimación no se protege congelándola, se protege dejándola llegar.
- El control de "cierre de cocina" de la `010` quedó sin función. Sus columnas se
  conservan (no se reescribe el pasado) pero ya no cierran nada.
- La pantalla se llama **Almuerzos**, no Cocina, y la abre quien trabaja en la isla.
- Lo que sí se registra: **con qué número preparó cocina**. Quien le lleva el
  conteo lo marca (`marcar_revision_cocina`) y la pantalla dice cuánto se movió
  desde entonces — que es lo que el mesero necesita antes de comandar.

> **Nota técnica para quien retome esto:** no se puede deducir de `updated_at`.
> `guardar_pasajeros_por_token` borra y reinserta la lista completa de la reserva,
> así que todos los pasajeros dicen "modificado ahora" en cuanto alguien toca su
> check-in. Se intentó y no sirve.

### 2.3 La comanda vive en Zeus, no en DayPASS

**Confirmado por el dueño (8 ago):** el mesero toma la comanda **en papel** y la
digita en una pantalla de **Zeus**, contra la cuenta del folio. **Daniela crea el
folio en Zeus** y escribe el número en DayPASS.

Eso **quita** de la Fase E toda la parte de comanda. La frontera queda:

```
Daniela crea folio en Zeus → escribe folio_zeus en DayPASS
                                      ↓
                        el mesero lo lee en /isla
                                      ↓
              comanda en papel → lo digita en Zeus contra ese folio
```

### 2.4 El regreso de las 3:30 es el cierre real

Implementado (`011`). De vuelta **solo puede bajar quien subió**: la lista del
regreso no son los que tenían reserva sino los que embarcaron —incluye al walk-in
y excluye al que no llegó—. Cerrar con gente sin bajar pregunta antes.

Al cerrar el regreso: las reservas de los que bajaron pasan a `completada` y su
enlace se invalida (`estado = 'finalizado'`, `expira_at` = fecha + 7 días, la
ventana del agradecimiento).

> **Hallazgo:** hasta la `011`, `tokens_reserva.expira_at` **no se escribía nunca**
> y ningún token llegaba a `finalizado`. Todos los enlaces eran eternos.
> `_reserva_de_token` ya filtraba por ambos: la puerta estaba puesta, faltaba quien
> la cerrara.

### 2.5 Las horas reales de la operación

| Momento | Hora | Dónde se configura |
|---|---|---|
| Cita a los pasajeros | 8:00 a.m. | — |
| Embarque real | 8:20–8:30 a.m. | `ajustes.checkin_cierra_hora` (08:30) |
| Cocina revisa los platos | Mañana, después del desayuno | Se marca a mano en `/cocina` |
| Regreso | 3:30 p.m. | `ajustes.hora_regreso` (15:30) |

---

## 3 · Incidente de seguridad y su arreglo (migración 012)

**Esto es lo más importante que pasó y hay que entenderlo bien.**

### Qué se encontró

Verificado contra producción **con la clave anon** —la que viaja en el bundle del
navegador y cualquiera puede sacar en diez segundos—: un anónimo podía ejecutar

- `cerrar_dia` → **cerrar el día operativo**
- `cerrar_tentativo`, `cerrar_zarpe` → cerrar el tentativo y los zarpes
- `programar_zarpes`, `programar_regresos` → **crear zarpes**
- `cambiar_estado_manual` → **cambiar el estado de una reserva**
- `conciliacion_del_dia` → **leer nombres de clientes**

### Por qué

En PostgreSQL **toda función nace con `EXECUTE` concedido a `PUBLIC`**. Como estas
son `SECURITY DEFINER` —corren con los permisos del dueño—, **la RLS de las tablas
no las detiene: son un túnel por debajo de ella**.

Escribir `grant execute ... to authenticated` no cerraba nada, porque el problema
no era lo que faltaba conceder sino lo que ya venía concedido de fábrica.

Venía desde la `003`. Las cinco funciones de la puerta pública (`008`) sí estaban
bien, porque ahí se escribió el `revoke` explícito.

### Cómo se cerró (`012`)

1. Revoca de `anon` y de `PUBLIC` todas las funciones del esquema (excepto las de
   trigger, que las llama el sistema).
2. Deja abiertas **exactamente cinco** para `anon`: `reserva_publica`,
   `marcar_token_abierto`, `guardar_pasajeros_por_token`, `firmar_por_token`,
   `documento_vigente`.
3. `alter default privileges in schema public revoke execute on functions from public`
   — de aquí en adelante una función nueva **nace cerrada**.
4. Termina comprobando que sean cinco y **lanza excepción si no**.

### La trampa que queda

**`create or replace` sobre una función existente restablece los permisos por
defecto.** Toda migración que reemplace una función tiene que volver a revocar.
La `013` ya lo hace y termina con la misma comprobación de las cinco.

### Verificado hoy contra producción (solo lecturas)

```
Tablas legibles por anon:     registros [] · pasajeros [] · tokens_reserva []
                              firmas [] · ajustes [] · dias_operativos []
                              embarques [] · zarpes []          → ninguna
Funciones que anon ejecuta:   documento_vigente ✅ · reserva_publica ✅
                              marcar_token_abierto ✅
                              cerrar_dia 42501 · conciliacion_del_dia 42501
                              revision_cocina 42501             → denegadas
```

### Daño colateral y su reparación

Al comprobar el alcance **llamé a las funciones de verdad contra producción** en
vez de leer los permisos del catálogo. Tres de esas llamadas escribieron: crearon
un zarpe de regreso vacío y **cerraron el día operativo del 9 de agosto**.
Reparado con `daypass/supabase/reparar_2026-08-09.sql`.

**Lección aplicable a cualquier IA que trabaje en este repo:** para saber qué puede
ejecutar un rol se lee `has_function_privilege('anon', p.oid, 'execute')` sobre
`pg_proc`. Nunca se llama a la función a ver qué pasa.

---

## 4 · Qué falta

### 4.1 Lo que necesita cuentas o claves tuyas (bloqueado)

| Qué | Por qué está bloqueado |
|---|---|
| **Manifiesto por correo** a Capitanía, CorpoTurismo y Financiera | Necesita Edge Functions + proveedor de correo (Resend, SendGrid…) con su clave. No hay `supabase/functions/` ni `service_role` en ninguna parte, que es lo correcto. |
| **Recordatorio de check-in a las 6 p.m.** | Lo mismo, más un cron |
| **Correo de agradecimiento + reseña a los 7 días** | Lo mismo. La expiración del token ya está implementada (`011`) |

Mientras tanto el manifiesto **se imprime y se guarda como PDF desde el navegador**,
que es lo que desbloquea la operación.

### 4.2 Fase E — Isla (parcial)

**Hecho:** `/isla` responde "¿a qué cuenta va este almuerzo?" — busca por nombre,
grupo, agencia o folio y muestra el folio grande, distinguiendo los cinco casos
(folio · sin folio todavía · cortesía · huésped de alojamiento · empleado).
Funciona sin señal.

**Falta:** `/llegadas` y `/buscar` del plan original. **La comanda ya no aplica**
(§2.3).

### 4.3 Fase F — Pagos, tiquetes, metas

No empezada. El plan original la llamaba `010_pagos`, `011_tiquetes` y
`012_metas`; **esos tres números ya están usados**, igual que hasta el `016`. Las
siguientes migraciones arrancan en la **`017`**.

El kardex de tiquetes CorpoTurismo+Parques y el reporte mensual de cortesías
siguen pendientes.

### 4.4 Fase H — UX de Config e Informes

`Config.jsx` ya está: se rehízo con los patrones del sistema, sin una sola clase
`gray-*`, y sus cuatro tablas casi idénticas quedaron en una sola declaración.

`Informes.jsx` (792 líneas) sigue con el sistema visual viejo: **56 clases
`gray-*`**, cero tokens del sistema v2, unos 20 colores hex escritos a mano dentro
de los gráficos de Recharts, y todo en un solo componente.

---

## 5 · Los roles, ya cerrados (Fase G) — y lo que queda

### 5.1 Lo que había y lo que hay

**Había:** una sola política en las 26 tablas, `authenticated_full_access using
(auth.role() = 'authenticated')`. Cualquiera con sesión leía y escribía todo,
incluido el dinero. `/isla` y `/cocina` se habían construido para el mesero y no
se le podían dar sin entregarle el negocio entero.

**Hay:** ocho roles —`super_admin`, `gerencia`, `directora`, `asesora`,
`asesora_comercial`, `admin_isla`, `recepcion`, `mesero`—, guardias por día,
bitácora append-only y políticas por rol en las 26 tablas. Verificado contra la
base, no supuesto.

### 5.2 El problema del dinero, y por qué la solución se ve rara

El plan pedía excluir los precios **a nivel de columna**. **No se puede.** En
PostgreSQL los permisos por columna son `grant`/`revoke` y van **por rol de base
de datos**; en Supabase todo el que inicia sesión es el mismo rol,
`authenticated`. Revocar `precio_adulto` se lo quitaría también a Daniela. Y la
RLS es solo por **filas**: no sabe enmascarar una columna.

La solución que sí se sostiene en el servidor: **una vista que enmascara**. La app
lee `reservas` en vez de `registros`, y ahí los precios llegan en `null` para quien
no puede verlos:

```sql
case when puedo_ver_dinero() then r.precio_adulto end as precio_adulto
```

No es esconder en el front. Quien consulte la vista por PostgREST con su propia
sesión recibe `null` igual.

> **Para quien retome esto:** se **lee** de la vista `reservas` y se **escribe** en
> la tabla `registros`. No es un descuido: la vista tiene columnas calculadas y no
> acepta que le escriban los precios. Hoy son 7 lecturas contra la vista y 6
> escrituras contra la tabla, y así debe quedarse.

### 5.3 Dos cosas que salieron mal y conviene no repetir

**La vista contra una columna que no existía.** La `015` proyectaba
`vendida_por_id` en un bloque anterior al `alter table` que la creaba. Falló con
`42703` en la primera corrida. Ahora el `alter` va antes.

**Borrar políticas por nombre.** La `015` limpió el modelo viejo recorriendo
tablas y borrando `authenticated_full_access`, `<tabla>_lectura` y
`<tabla>_escritura`. Dos políticas no se llamaban así —`authenticated_read` en
`cambios_estado` (003) y en `documentos_legales` (008)— y sobrevivieron.

Eso importa porque **las políticas permisivas se suman con O**: al lado de
`using (soy_del_equipo())` seguía `using (auth.role() = 'authenticated')`, y basta
que una diga que sí. No se notaba, porque todo el que tenía sesión tenía perfil
activo. Se habría notado el primer día que alguien se desactivara.

La `016` las borra **por lo que dicen y no por cómo se llaman**: cualquier política
cuya condición mencione `auth.role()`. Y comprueba al final que ninguna tabla con
RLS se haya quedado sin política de lectura, que sería peor que el problema
original.

### 5.4 Crear cuentas son dos pasos, en dos sitios

Esto no se puede juntar y conviene saberlo antes de necesitarlo:

| | Dónde | Por qué ahí |
|---|---|---|
| Crear la cuenta | Supabase → Authentication → Users | Desde el navegador exigiría la clave de servicio, y esa no puede vivir en el front |
| Darle el rol | DayPASS → `/usuarios` | Queda claro quién lo hizo, sin abrir Supabase |

Entre los dos pasos, esa persona inicia sesión y no ve nada. Por eso `/usuarios`
pone arriba y en coral las cuentas que esperan rol: hay alguien del otro lado.

Para el huevo y la gallina —la primera cuenta, o el día que nadie con
`super_admin` pueda entrar— está `supabase/consultas/dar_super_admin.sql`.

### 5.5 Lo que queda para apagar el Excel: la Fase F

Pagos, tiquetes y metas. El kardex de tiquetes CorpoTurismo + Parques, el reporte
mensual de cortesías y la alerta predictiva contra las reservas de mañana.

Es lo único que todavía obliga a abrir el Excel.

---

## 6 · Deuda técnica conocida

| Qué | Detalle |
|---|---|
| **Lint** | 32 problemas (28 errores, 4 avisos), casi todos `react-hooks/set-state-in-effect` en hooks con fetch. Es el patrón idiomático del repo; el compilador de React lo marca. No son fallos de corrección. |
| **Migraciones que se redefinen** | La versión vigente de `reserva_publica` y `guardar_pasajeros_por_token` está en la **014**; la de `firmar_por_token` en la **009**; `marcar_token_abierto` y `documento_vigente` siguen como las dejó la **008**. Leer solo la `008` induce a error en tres de las cinco. |
| **`create or replace` reabre la puerta** | En PostgreSQL redefinir una función **restablece el `execute` para `PUBLIC`**, aunque haya `alter default privileges`. Toda migración que redefina una función tiene que volver a revocar y terminar comprobando cuántas quedan abiertas a `anon`. Deben ser cinco. |
| **Mojibake** | Quedan 2 líneas con el emoji 🌊 corrupto en `printDoc.js` (cabeceras del tentativo y de folios). Cosmético. **No arreglar con scripts que reescriban el archivo** — así se corrompió la primera vez. |
| **Datos contradictorios** | Hay reservas con `tipo_ingreso = 'pasadia'` **y** `forma_pago = 'cortesia'`. `/isla` las marca como "revisar antes de cobrar" en vez de elegir bando. Falta contarlas (`supabase/consultas/pasadia_con_forma_pago_cortesia.sql`): si son muchas, es un problema de captura, no de datos sueltos. |
| **Dos ejes que se pisan** | La categoría `cortesia` del pasajero y el tipo de ingreso `cortesia` no son lo mismo: la categoría dice **qué es** la persona en esa reserva, el tipo de ingreso dice **por qué entró**. Hoy se confunden. Anotado para el bloque de personas. |

---

## 7 · Preguntas abiertas para el hotel

1. **¿La Capitanía acepta el manifiesto con plazas sin nombre?** Se construyó
   aceptando ambas: salen visibles y contadas, y el muelle puede nombrarlas antes
   de zarpar. Si la respuesta es que **todas** deben ir nominales, el flujo del
   muelle cambia.
2. ~~**¿Los infantes almuerzan?**~~ **Resuelta (8 ago): sí.** De 0 a 3 años comen,
   pero **no eligen plato** — un niño de esa edad no decide y sus padres no van a
   estar escogiendo un plan por él. El check-in no le abre el selector. En el
   conteo de cocina aparecen como **línea propia**: "41 Gold · 25 Silver · 3
   infantes", porque cocina necesita saber que son tres porciones más aunque no
   sean un plato del menú. Migración `014`, con la edad de corte en `ajustes`
   (`edad_max_infante`) y no escrita a mano en tres pantallas.
   **Sigue abierto:** qué se les sirve exactamente. Lo confirma la isla.
3. **¿Cuántas reservas tienen tipo e ingreso contradictorios?** (§6)
4. **¿A qué hora revisa cocina exactamente?** Hoy se marca a mano, lo cual funciona
   sin saberlo, pero saberlo permitiría avisar si nadie lo marcó.
5. **¿Los ocho roles cubren a toda la gente?** Faltan dos casos por resolver: quién
   cubre recepción en la isla, y si la coordinadora de alojamiento entra como
   `asesora_comercial` o merece rol propio.

---

## 8 · Cómo verificar cualquier cosa de este documento

```bash
cd daypass
npm run demo      # datos de muestra, sin tocar producción — puerto 5175
npm test          # 102 pruebas
npm run build
npx eslint src    # línea base: 32 problemas
npm run humo      # 9 pantallas cargan limpias, escuchando la consola
npm run roles     # cada uno de los 7 roles ve lo suyo y solo lo suyo
```

**Las pruebas de navegador han atrapado cuatro fallos que el build dejó pasar**: un
`ReferenceError` que dejaba una pantalla en blanco, un documento impreso que salía
vacío, una ruta que nunca se registró y rebotaba al inicio, y un icono sin
importar. Ese último no reventaba de milagro —el navegador expone un global `Lock`
de la Web Locks API y la ruta que lo usaba estaba oculta—; el siguiente icono sin
importar sí habría tumbado la barra entera.

Contra la base, sin escribir nada:

```
supabase/consultas/estado_de_los_roles.sql   -- 7 comprobaciones de la RLS y los perfiles
```

> **Cómo NO se comprueba un permiso:** llamando a la función a ver qué pasa. Así se
> cerró por error el día operativo del 9 de agosto en producción. Se lee
> `has_function_privilege('anon', p.oid, 'execute')` sobre `pg_proc`.
