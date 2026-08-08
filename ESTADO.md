# DayPASS — Estado del proyecto

**Corte:** 8 de agosto de 2026 · commit `67f232b` · 36 commits
**Producción:** https://daypass-seven.vercel.app · **Repo:** github.com/daypassmajagua/daypass
**Base de datos:** Supabase `ubtmixgqwfwvartciqyr` · migraciones **001–014**

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
| **F** | Pagos, tiquetes, metas | ❌ No empezada |
| **G** | 9 roles con RLS real | ❌ No empezada — **ver §5, es lo más urgente** |
| **H** | UX de Config e Informes, pulido | ❌ No empezada |

### Pantallas (16 rutas)

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
| `/historial`, `/informes`, `/config` | Coordinadora | Sin fase UX todavía |
| `/r/:token` | **Cliente, sin login** | Check-in: nombres, plato, condiciones, firma, pase QR |

### Números

- **13.931 líneas** de JS/JSX · **23 tablas** · **13 migraciones** (2.836 líneas de SQL)
- **75 pruebas automáticas** en Vitest, 5 archivos, más humo con Puppeteer (`npm run humo`)
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

No empezada. Incluye `010_pagos`, `011_tiquetes`, `012_metas` del plan original
(**ojo: esos números ya están usados por otras migraciones**; habría que
renumerar a `014`, `015`, `016`).

El kardex de tiquetes CorpoTurismo+Parques y el reporte mensual de cortesías
siguen pendientes.

### 4.4 Fase H — UX de Config e Informes

`Config.jsx` (386 líneas) e `Informes.jsx` (791 líneas) siguen con el sistema
visual viejo: **~99 clases `gray-*` entre las dos**, cero tokens del sistema v2, y
unos 20 colores hex escritos a mano dentro de los gráficos de Recharts.
`Informes.jsx` es un solo componente de 690 líneas.

Estimación: Config ~1 sesión, Informes ~1,5–2.

---

## 5 · Lo más urgente que queda: los roles (Fase G)

**Hoy toda política de RLS es `authenticated_full_access using (auth.role() =
'authenticated')`. Cualquier persona con sesión puede leer y escribir todo,
incluido el dinero.** Seis pantallas muestran precios: Reserva, ListadoDia,
Historial, Informes, Config y TarjetasPlan.

Consecuencia práctica inmediata: **`/isla` y `/cocina` no se le pueden dar al
mesero sin entregarle el negocio completo.** Se construyeron para él y hoy solo
las puede abrir alguien de confianza.

Los nueve roles del plan v5 —ahora **ocho**, porque cocina salió— son la Fase G y
es el bloque más grande que queda. Es lo que yo pondría primero.

---

## 6 · Deuda técnica conocida

| Qué | Detalle |
|---|---|
| **Lint** | 36 problemas (31 errores, 5 avisos), casi todos `react-hooks/set-state-in-effect` en hooks con fetch. Es el patrón idiomático del repo; el compilador de React lo marca. No son fallos de corrección. |
| **Migraciones que se redefinen** | `reserva_publica` y `guardar_pasajeros_por_token` están vigentes en la **013**; `firmar_por_token` en la **009**. Leer la `008` para entender el comportamiento actual induce a error. |
| **Mojibake** | Quedan 2 líneas con el emoji 🌊 corrupto en `printDoc.js` (cabeceras del tentativo y de folios). Cosmético. **No arreglar con scripts que reescriban el archivo** — así se corrompió la primera vez. |
| **Supuesto sin validar** | El conteo de cocina asume que los infantes no almuerzan y las cortesías sí. Deducido de la regla de precios, nunca confirmado con Daniela. |
| **Datos contradictorios** | Hay reservas con `tipo_ingreso = 'pasadía'` **y** `forma_pago = 'cortesía'`. `/isla` las marca como "revisar antes de cobrar" en vez de elegir bando. Si son muchas, es un problema de captura. |

---

## 7 · Preguntas abiertas para el hotel

1. **¿La Capitanía acepta el manifiesto con plazas sin nombre?** Se construyó
   aceptando ambas: salen visibles y contadas, y el muelle puede nombrarlas antes
   de zarpar. Si la respuesta es que **todas** deben ir nominales, el flujo del
   muelle cambia.
2. **¿Los infantes almuerzan?** (§6)
3. **¿Cuántas reservas tienen tipo e ingreso contradictorios?** (§6)
4. **¿A qué hora revisa cocina exactamente?** Hoy se marca a mano, lo cual funciona
   sin saberlo, pero saberlo permitiría avisar si nadie lo marcó.

---

## 8 · Cómo verificar cualquier cosa de este documento

```bash
cd daypass
npm run demo      # datos de muestra, sin tocar producción — puerto 5175
npm test          # 75 pruebas
npm run build
npx eslint src    # línea base: 34 problemas
```

Las pruebas de humo ya están en el repo: `npm run humo` carga las ocho pantallas
y escucha la consola. **Han atrapado tres fallos que el build dejó pasar**: un
`ReferenceError` que dejaba una pantalla en blanco, un icono sin importar que
habría reventado la barra de navegación, y un documento impreso que salía vacío.
