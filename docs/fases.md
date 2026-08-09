# DayPASS — Las fases, con dependencias y riesgo

Complementa `plan-v6.md`: aquel dice **qué** se construye, este dice **en qué orden se puede** y
**qué rompe**. Sin estimaciones de tiempo.

Estado a 8 de agosto de 2026: **migraciones 001–019** (001–018 corridas y verificadas 9/9; la 019
pendiente de correr), producción en Vercel, 102 pruebas más humo y roles.

> **La numeración corrió dos puestos.** La `018` se la llevó la auditoría —candados de rol en las
> RPC, la tabla `registros` sin plata, las vistas sin túnel— y la `019`, el arreglo de la regla 21
> (la asesora administra sus lanchas, pilotos y empleados). Las fases que aún no tienen migración
> escrita empiezan en la **`020`**.

---

## 0 · Lo primero: tres umbrales distintos, no uno

"Que Daniela empiece a operar" no es una sola línea. Son tres, y conviene no confundirlas porque
cada una desbloquea algo diferente.

| Umbral | Qué hace falta | Qué se logra |
|---|---|---|
| **A · Piloto de Daniela sola** | Fase 0 (catálogos reales) | Opera el día completo en DayPASS: reserva, nombres, cierre, muelle, manifiesto, regreso, folios. Con el Excel al lado como red |
| **B · Opera el equipo** | + Fase 2 (roles) | La isla, el mesero y las otras asesoras entran sin ver el dinero de todo el negocio |
| **C · Se apaga el Excel** | + Fase 5 (dinero y tiquetes) | Ya no queda nada que solo viva en la planilla |

**El umbral A está a una fase de distancia**, y lo único que falta son datos tuyos. El ciclo
operativo ya está construido y probado.

> **El umbral B ya se cruzó** (8 de agosto de 2026, migraciones `015`–`017`). Toda política de RLS
> pregunta por el rol; el dinero se enmascara en el servidor con la vista `reservas`. La isla, el
> mesero y las asesoras ya pueden entrar sin ver los precios del negocio.
>
> Quedan **siete** roles, no ocho: `recepcion` se retiró porque todo lo de la isla lo hace
> `admin_isla` o quien esté de guardia. La coordinadora de alojamiento entra como
> `asesora_comercial` — las guardias le dan el muelle los días que le toque.
>
> **El que hoy manda es el umbral A, y no depende de código sino de tus catálogos reales.**

---

## 1 · Tres cosas que cambian el plan

### 1.1 · La columna que rompe ocho archivos (importante)

La fase 2 dice, con razón, que **el dinero se excluye a nivel de columna, no se esconde en el
front**. Pero eso tiene una consecuencia que conviene costear antes:

> En PostgreSQL, si un rol no tiene `SELECT` sobre una columna, **`select *` falla con
> `permission denied for column`**. No la omite en silencio.

Y hoy **las ocho consultas sobre `registros` usan `select('*')`**:

```
src/hooks/useRegistros.js      src/pages/Folios.jsx      src/pages/Isla.jsx
src/hooks/useEmbarque.js       src/pages/Historial.jsx   src/pages/Reserva.jsx
src/lib/offline/precarga.js    src/pages/Informes.jsx
```

El día que se revoque `precio_adulto` para el rol `mesero`, `/isla` deja de cargar. Y
`precarga.js` es peor: es la copia local del muelle, así que el fallo aparecería **sin señal, en el
muelle, a las 8 de la mañana**.

**Qué hacer:** antes o dentro de la fase 2, cambiar esos ocho `select('*')` por listas explícitas
de columnas. Es mecánico y de bajo riesgo hacerlo *antes*; es un incendio hacerlo *después*.

### 1.2 · No hay multi-tenant

La versión anterior de este documento proponía partir la fase 2 en dos migraciones porque metía
roles y `hotel_id` en el mismo bloque. **Eso ya no aplica: no hay multi-tenant.**

El plan v6 justificaba el aislamiento por hotel diciendo que «hace que el hotel #2 cueste cero de
infraestructura». Confirmado con el dueño: **DayPASS es exclusivamente para el Hotel San Pedro de
Majagua.** No hay hotel #2, ni está sobre la mesa vender el producto.

Así que la fase 2 es una sola migración —`015_roles.sql`— y la numeración es la simple: cada fase
toma el número siguiente, sin desdoblar.

Si algún día cambiara, agregarlo cuesta reescribir las políticas de RLS para que incluyan la
columna. Es mecánico, acotado y sin migración de datos — no justifica construirlo hoy contra un
supuesto que nadie pidió.

### 1.3 · Notificaciones antes que operación ampliada

El plan pone contingencia en la fase 6 y notificaciones en la 7. Pero
`spec-contingencia-personas.md` dice, en sus propias dependencias:

> **Contingencia** necesita: tiquetes (para la reversa al inventario) y **notificaciones** (para el
> aviso).

Cancelar un día sin poder avisarle a nadie sirve de poco: el aviso masivo *es* la mitad de esa
funcionalidad. Además, la alerta de **"falta gente en el conteo de regreso"** ya tiene sus datos
desde la 011 y es lo más urgente de toda la lista de notificaciones — alguien se quedó en una isla.

**Propuesta:** intercambiar. Comunicación pasa a ser la fase 6 y operación ampliada la 7. Eventos
masivos y restaurante externo son comerciales y aguantan; que se quede alguien en la isla, no.

---

## 2 · Las fases

Una migración por fase, numeradas de corrido desde la `015`.

---

### Fase 0 · Arreglos y datos

**Migración:** `014` — corrida.

**Qué incluye**
- ✅ Infantes almuerzan: `pasajeros.almuerza`, las dos rutas del conteo, línea propia
- ✅ `edad_max_infante` a `ajustes`
- ✅ Pruebas de humo al repo (`npm run humo`)
- ⬜ **Catálogos reales**: lanchas con capacidad y prioridad, pilotos, agencias, planes con precios,
  empleados
- ⬜ **Resend + Edge Functions**: manifiesto, recordatorio de las 6 p.m., agradecimiento
- ⬜ Revisar las reservas con tipo e ingreso contradictorios (consulta escrita, falta correrla)

**Depende de** — nada. Es la base.

**Bloqueado por ti**
- Los catálogos reales: no me los puedo inventar
- La clave de Resend y el dominio verificado
- Correr la 014 y la consulta

**Se puede hacer sin eso** — ya está hecho. Lo que queda son datos y cuentas.

> **Detalle que arrastra a la fase 3:** los correos de destino (Capitanía, CorpoTurismo,
> Financiera) van a vivir en `ajustes` cuando se conecte Resend, porque las instituciones como
> organizaciones llegan en la fase 3. Es rework pequeño y consciente: no vale la pena adelantar
> media fase 3 para evitarlo.

**Paralelo con** — todo. No bloquea nada más que el piloto.

**Riesgo: BAJO.** Los catálogos son datos, no código. Resend es aditivo: nada de lo que hoy
funciona depende de que exista.

**Umbral: A — imprescindible para que Daniela empiece.**

---

### Fase 1 · Diseño base

**Migración:** ninguna.

**Qué incluye**
- Los ocho patrones a `components/patrones/`
- `ModoProvider` con los tres modos
- Los tres estados obligatorios (cargando · vacío · error)
- Rehacer `Config.jsx` con los patrones, como prueba de que alcanzan

**Depende de** — nada técnico. Pero **va antes de la fase 2** por una razón práctica: la fase 2
trae pantallas nuevas (Panorama, Resultados, Llegadas) y si los patrones no existen, cada una
inventa su layout. Es lo que ya pasó con Config e Informes y sus 99 clases `gray-*`.

**Bloqueado por ti** — nada.

**Paralelo con** — la fase 0 (son datos y cuentas) y con cualquier trabajo de base que no toque el
front.

**Riesgo: MEDIO.** Es refactor de cuatro pantallas que hoy funcionan: Hoy, Reserva, Cerrar y
Embarque. No toca datos y se revierte con un `git revert`, pero son las pantallas del día a día.

> **Recomendación:** extraer los patrones de **Hoy, Reserva y Cerrar**, y **dejar Embarque e Isla
> quietas** hasta que `ModoProvider` exista. Esas dos son deliberadamente distintas —sin barra,
> filas de 64 px, alto contraste para el sol— y homogeneizarlas con patrones pensados para oficina
> sería empeorarlas. Se adaptan después, cuando el modo sea explícito.

> **Config se va a tocar dos veces más:** en la fase 2 gana administración de usuarios y en la 3
> pierde los correos de destino. Rehacerla aquí sigue valiendo la pena —es la prueba de que los
> patrones alcanzan— pero cuenta con volver.

**Umbral: ninguno.** No bloquea a Daniela. Bloquea la calidad de todo lo que venga después.

---

### Fase 2 · Roles y guardias

**Migración:** `015` — corrida, más la `016` (dos políticas que sobrevivieron), la `017` (fuera
recepción), la `018` (la auditoría: candados de rol en las RPC, `registros` sin plata, vistas sin
túnel) y la `019` (la asesora administra sus lanchas, pilotos y empleados — regla 21).

**Qué incluye**
- `perfiles` con los ocho roles (cocina fuera)
- RLS real por rol, con el dinero excluido por columna
- `navegacion.js`: una sola fuente de verdad para menú, redirección y protección
- Calendario de guardias: habilita acciones por día sin cambiar el rol base
- Bitácora de acciones sensibles, con el `super_admin` también auditado

**Depende de**
- La fase 1, para que las pantallas nuevas nazcan con patrones
- **Los ocho `select('*')` convertidos a listas explícitas** (§1.1). Esto no es opcional: sin ello
  la fase rompe `/isla`, `/embarque` y la copia offline del muelle

**Bloqueado por ti** — los nombres, cargos y correos reales de cada persona. Sin eso se puede
construir todo y sembrar los perfiles después.

**Paralelo con** — la fase 4 (tickets) no comparte nada; se puede adelantar. Con la fase 3 no:
comparten las políticas de RLS y pelearían por los mismos archivos.

**Riesgo: ALTO. El más alto del plan.**

| Qué toca | Por qué duele |
|---|---|
| RLS de las 23 tablas | Un error deja a alguien sin ver su trabajo, o peor, viéndolo todo |
| Los 8 archivos que leen `registros` | `select('*')` revienta contra columnas revocadas |
| `precarga.js` | Es la copia local del muelle: el fallo aparece sin señal y a las 8 a.m. |
| `Navbar` y `ProtectedRoute` | Hoy son listas sueltas; pasan a derivarse de `navegacion.js` |

**Umbral: B — imprescindible para que opere el equipo.** No para Daniela sola.

---

### Fase 3 · Personas y organizaciones

**Migración:** `020` — escrita, pendiente de correr.

**Qué incluye**
- ✅ `personas` con el documento como llave **opcional y única cuando existe**, y
  `pasajeros.persona_id` + `registros.persona_id` (el titular)
- ✅ `agencias` → `organizaciones` con `tipo`, incluidas las instituciones
- ✅ `vinculos` y `persona_etiquetas` (calculadas y asignadas, en filas distintas)
- ✅ `organizacion_correos` con propósito: de ahí sale el destino del manifiesto
- ✅ `unir_personas()`, solo dirección o coordinación, con bitácora
- ✅ Precarga por documento **en la reserva**
- ✅ El solapamiento de `cortesia` cerrado con CHECK en `pasajeros` y `embarques`

> **La precarga NO va en el check-in público, y es a propósito.** Dejar que
> cualquiera con un enlace escriba un documento y vea a quién pertenece sería
> regalar la base de datos entera. `buscar_personas` exige sesión del equipo.
> Lo que el cliente sí ve precargado es lo suyo, que ya funcionaba.

> **Falta la autorización de tratamiento (Ley 1581).** El mecanismo existe
> —`documentos_legales` + `firmas`, migración 008—: cuando llegue el texto del
> abogado se publica como documento vigente y queda recogida sin tocar código.
> **Hasta entonces esto se puede probar, pero no debería usarse para nada
> distinto de operar el pasadía.**

**Depende de** — la fase 2, porque comparte las políticas de RLS y `personas` guarda documentos de
identidad, que es justo lo que hay que proteger por rol.

**Bloqueado por ti** — la revisión jurídica de habeas data (Ley 1581). Con esta fase DayPASS pasa
a ser formalmente una base de datos de personas: miles de documentos guardados por años.
**Se puede construir sin la respuesta**, pero no debería entrar en producción sin la autorización
de tratamiento en el check-in y una política de retención.

**Paralelo con** — la fase 4 (tickets). No con la 2.

**Riesgo: MEDIO.**

| Qué toca | Riesgo |
|---|---|
| `agencias` (gana 4 columnas) | Bajo — solo `Reserva.jsx` la lee |
| `pasajeros` (gana `persona_id`) | Medio — la leen el check-in público, el manifiesto y el conteo de cocina |
| `categoria_pasajero` (quitar `cortesia`) | Medio — hay que migrar las filas que ya lo usen, y el enum lo tocan cinco pantallas |

**Umbral: ninguno.** Ahorra digitación y habilita el marketing, pero nadie deja de operar sin ella.

---

### Fase 4 · Tickets de soporte

**Migración:** `021`

**Qué incluye**
- `tickets` con el contexto capturado solo
- Captura de pantalla con `html2canvas`, quitable
- Tres tipos, más la casilla "me bloqueó la operación"
- Botón en el shell, también en modo muelle, funcionando sin señal

**Depende de** — la fase 2 para el rol de quien reporta y para el `super_admin`. Poco más.

> **Ojo con el push:** el plan pide *"push inmediato al `super_admin`"*, pero las notificaciones
> son la fase 6/7. Esta fase sale con **aviso en la app y correo** —que ya funciona si Resend está
> conectado en la fase 0— y el push se engancha después sin tocar nada de lo construido.

**Bloqueado por ti** — nada.

**Paralelo con** — las fases 3 y 5. Es la más aislada de todas: tabla nueva, componente nuevo, y
no cambia nada de lo que existe.

**Riesgo: BAJO.** Lo único que toca de lo existente es el shell, para poner un botón.

**Umbral: ninguno formalmente, pero léelo así:** si Daniela va a probar esto durante meses, el
canal para reportar tiene que existir **mientras** prueba. Un fallo que ella reporta por WhatsApp y
nadie anota es un fallo que se pierde. **Yo la subiría justo después del umbral A.**

---

### Fase 5 · Dinero y control

**Migración:** `022`–`024`

**Qué incluye**
- **Pagos y cartera**: tipo, valor, estado, soporte; cartera por agencia con antigüedad; tasa de
  no-show por agencia
- **Tiquetes**: kardex combinado, saldo inicial digitado una vez, compras por lote, consumo
  derivado del embarque, alerta predictiva al cerrar
- **Cortesías, metas y liquidación**: reporte mensual de cortesías, metas por año y responsable,
  comisiones por agencia

**Depende de**
- La fase 2 para las metas (hay que saber de quién es cada una) y para que la cartera no la vea
  cualquiera
- Lo demás ya existe: `tipos_ingreso.consume_tiquete` está desde la 007 y el consumo se deriva de
  `embarques`, que es append-only desde la 006

**Bloqueado por ti**
- **El saldo inicial de tiquetes.** Se digita una vez y de ahí en adelante el kardex se lleva solo
- Las metas del año y los porcentajes de comisión por agencia

**Se puede hacer sin eso** — todo el mecanismo. Lo que no se puede es arrancar el kardex sin saber
de cuántos tiquetes se parte.

**Paralelo con** — las tres partes entre sí son bastante independientes: pagos no depende de
tiquetes y tiquetes no depende de metas. Se pueden repartir.

**Riesgo: BAJO-MEDIO.** Casi todo son tablas nuevas. Lo que toca lo existente:

| Qué toca | Riesgo |
|---|---|
| El cierre del día (alerta predictiva) | Bajo — se agrega una tarjeta |
| `Informes.jsx` (metas y cartera) | Medio — son 791 líneas en un solo componente |
| Nada de `registros` ni `embarques` | El consumo se **deriva**, no se escribe |

> **Hallazgo que hay que arrastrar:** el kardex mensual de la planilla actual **no suma
> alojamiento**, y por eso es probable que parte de sus saldos negativos vengan de ahí. La fórmula
> nueva sí lo suma. Cuando se digite el saldo inicial, no cuadrará con la planilla — y estará bien.

**Umbral: C — imprescindible para apagar el Excel.**

---

### Fase 6 · Comunicación *(propuesta: adelantada desde la 7)*

**Migración:** `027` — la última, aunque la fase vaya penúltima por el intercambio

**Qué incluye**
- Matriz de notificaciones configurable por usuario y evento, cuatro canales
- Los eventos de la lista, empezando por **"falta gente en el conteo de regreso"**
- Informe semanal de los lunes
- Postventa: agradecimiento y reseña de Google, sin incentivos ni filtrado

**Depende de**
- La fase 2: sin roles no se sabe a quién notificar, y las notificaciones **se enrutan al turno, no
  a la persona** (CLAUDE.md), así que necesita el calendario de guardias
- La fase 3 para los correos y teléfonos que no son de usuarios internos
- Resend, de la fase 0

**Por qué la adelanto** — §1.3: la contingencia la necesita para avisar, y la alerta de faltantes
en el regreso ya tiene sus datos desde la 011. Es lo único de esta lista donde el costo de no
avisar es que alguien se quede en una isla.

**Bloqueado por ti** — Resend. El push necesita además que cada persona instale la PWA y autorice
las notificaciones; **en iPhone solo funcionan si está instalada en la pantalla de inicio**, así
que eso es cinco minutos por persona en la puesta en marcha, no algo que se descubra solo.

**Paralelo con** — la fase 5. No comparten nada.

**Riesgo: BAJO-MEDIO.** Tablas nuevas y Edge Functions. Lo que toca de lo existente es el cierre
del regreso, para disparar el aviso. La postventa se engancha a `tokens_reserva.expira_at`, que ya
se escribe desde la 011.

**Umbral: ninguno**, pero la alerta de faltantes en el regreso es de las cosas que más te van a
importar el primer día que pase.

---

### Fase 7 · Operación ampliada *(propuesta: atrasada desde la 6)*

**Migración:** `025`–`026`

**Qué incluye**
- **Eventos masivos**: el evento por encima de la reserva, con lancha **por pasajero**. Gematours,
  250 personas, 7 manifiestos
- **Restaurante externo**: lancha de terceros, no consume cupo ni tiquete, sí genera ingreso, y sus
  almuerzos suman a cocina
- **Contingencia**: los tres escenarios, incluida la pernocta forzada
- **Clima** de Open-Meteo: informa, nunca decide

**Depende de**
- La fase 5 para la reversa de tiquetes al inventario cuando se cancela un día
- La fase 6 para el aviso masivo
- Los eventos masivos dependen del manifiesto, que ya existe (011)

**Bloqueado por ti** — **cuántos días al año cierran el puerto.** Eso define si la contingencia es
una fase o una tarde: si son dos días al año, con registrar el hecho y avisar alcanza; si son
quince, hay que construir la reprogramación en lote completa.

**Paralelo con** — el clima es independiente de todo lo demás y no lleva migración; se puede hacer
en cualquier momento como relleno.

**Riesgo: MEDIO-ALTO.**

| Qué toca | Por qué |
|---|---|
| `registros.lancha_id` | Hoy es `NOT NULL` y **la lancha vive en la reserva**. Los eventos masivos la quieren **por pasajero**: es un cambio de modelo, no una columna más |
| El enum `estado_dia` gana `cancelado` | Todo lo que decide según el estado del día tiene que contemplarlo: el check-in público, el cierre, el muelle |
| `tipos_ingreso` | **Falta sembrar `restaurante_externo`.** La regla 11 lo define (N/N/S) pero la 007 solo sembró seis códigos |
| El conteo de cocina | Los almuerzos del restaurante externo suman, y hoy el cálculo solo mira `registros` |

**Umbral: ninguno.** Es crecimiento comercial y seguro operativo, no operación diaria.

---

### Fase 8 · Cierre

**Migración:** ninguna.

**Qué incluye**
- Informes rehechos con los patrones y la paleta de tokens
- Módulo de marketing con segmentos automáticos
- Auditoría de reducción de clics sobre lo ya construido
- Página `/estilo` para `super_admin`
- Aprendizaje por rol y "¿Cómo se hace?"

**Depende de** — la fase 1 (patrones), la 3 (personas, para segmentar) y la 5 (datos de dinero que
mostrar).

**Bloqueado por ti** — nada.

**Paralelo con** — nada; es el cierre por definición.

**Riesgo: MEDIO.** `Informes.jsx` son 791 líneas en un solo componente con ~20 colores hex a mano
dentro de Recharts. Se parte o se repinta, pero cualquier cambio se hace medio a ciegas hasta que
esté partido.

**Umbral: ninguno.**

---

## 3 · El mapa, de un vistazo

```
              ┌──────────────────────────────────────────────┐
   Fase 0 ────┤ catálogos · Resend · (014 ya escrita)        │  → umbral A
              └──────────────────────────────────────────────┘
                    │
   Fase 1 ──────────┤ patrones · modos · Config          (sin migración)
                    │        ║ puede ir en paralelo con la 0
                    ▼
   Fase 2 ──────────┤ roles y guardias        (015–017, +018 y 019 de la auditoría)
                    │  ⚠ requiere antes: los 8 select('*')  → umbral B ✅
         ┌──────────┼──────────┐
         ▼          ▼          ▼
   Fase 3      Fase 4      Fase 5
   personas    tickets     dinero y tiquetes                → umbral C
   (020)       (021)       (022–024)
         │          │          │
         └──────────┴────┬─────┘
                         ▼
   Fase 6 ───────────────┤ comunicación   ← adelantada
                         ▼
   Fase 7 ───────────────┤ eventos · restaurante · contingencia · clima
                         ▼
   Fase 8 ───────────────┤ informes · marketing · /estilo
```

**Lo que se puede repartir sin pisarse:**

- Fase 0 ∥ Fase 1 — una es datos, la otra es front
- Fase 3 ∥ Fase 4 — no comparten tabla ni pantalla
- Fase 4 ∥ Fase 5 — igual
- Dentro de la fase 5: pagos ∥ tiquetes ∥ metas
- El clima de la fase 7 ∥ cualquier cosa — no lleva migración ni toca nada

**Lo que NO se puede repartir:** las fases 2 y 3 pelean por las mismas políticas de RLS. Y nada
que toque el front debería ir en paralelo con la fase 1 mientras extrae patrones de esas pantallas.

---

## 4 · Lo que necesito de ti, ordenado por lo que desbloquea

| Qué | Desbloquea | Sin eso |
|---|---|---|
| Correr la `014` | Cierra la fase 0 técnica | El conteo de cocina sigue sin infantes en producción |
| **Catálogos reales** | **Umbral A — el piloto** | Daniela no puede crear una reserva de verdad |
| Clave de Resend + dominio | Manifiesto, recordatorio, agradecimiento, y el correo de los tickets | Todo eso se imprime o se manda a mano |
| Correr la consulta de contradictorias | Decidir si es error de captura | `/isla` seguirá diciendo "revisar antes de cobrar" sin que nadie sepa cuántas son |
| Nombres, cargos y correos | Sembrar los perfiles de la fase 2 | Se construye igual; se siembra después |
| Saldo inicial de tiquetes | Arrancar el kardex (fase 5) | El mecanismo se construye, el inventario no arranca |
| Metas del año y comisiones | Metas y liquidación (fase 5) | Igual |
| Revisión jurídica de habeas data | Que la fase 3 pueda entrar en producción | Se construye, no se despliega |
| Respuesta de Capitanía sobre plazas sin nombre | Cerrar el manifiesto | Hoy salen visibles y contadas, y el muelle puede nombrarlas |
| Cuántos días al año cierra el puerto | Dimensionar la contingencia | Se construye de más o de menos |

---

## 5 · Qué decidir para poder seguir

1. ~~¿Se parte la fase 2 en dos migraciones?~~ **Resuelto: no.** No hay multi-tenant (§1.2), así
   que la fase 2 es una sola migración y la numeración es de corrido desde la `015`.
2. **¿Se intercambian las fases 6 y 7?** (§1.3) Notificaciones antes que operación ampliada.
3. ~~¿Los ocho `select('*')` se arreglan antes de la fase 2 o dentro?~~ **Hecho, antes.** Están en
   `src/lib/columnas.js` con 27 pruebas. Aparecieron **tres** niveles y no dos: `forma_pago` no es
   un precio —dice cómo se paga, no cuánto— y la isla lo necesita para saber si a alguien se le
   carga el almuerzo o es cortesía del hotel.
4. **¿Los tickets suben justo después del umbral A?** No es lo que dice el plan, pero si el piloto
   dura meses, el canal de reportes vale más temprano que tarde.
