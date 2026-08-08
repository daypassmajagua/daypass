# DayPASS — Plan v6 de ejecución

Plan definitivo con el alcance completo aprobado (todo menos el motor de reservas) y el prompt
maestro para ejecutar con Claude Code en VS Code.

**Punto de partida:** commit `67f232b`, migraciones 001–013 aplicadas, producción en Vercel,
fases A–D completas, E parcial.

---

## 1. Los ocho bloques, en orden de dependencias

El orden no es negociable: cada bloque desbloquea el siguiente. Saltárselo significa rehacer.

### Bloque 0 · Arreglos y datos (bloquea el piloto)

Sin migración. Es lo que hace que el piloto con Daniela sirva.

- **Corregir infantes.** Hoy el conteo de almuerzos asume que no almuerzan. Confirmado: **de 0 a 3
  sí almuerzan**. Campo `pasajeros.almuerza` booleano, con valor por defecto según categoría pero
  editable. *Quién paga y quién come son ejes distintos.*
- **Conectar Resend** + Edge Functions para los tres correos: manifiesto, recordatorio de
  check-in, agradecimiento.
- **Cargar catálogos reales**: lanchas con capacidad y prioridad (MAJ 1 y MAJ 2 primero), pilotos,
  agencias, planes con precios reales, empleados.
- **Revisar las reservas con `tipo_ingreso='pasadía'` y `forma_pago='cortesía'`** — contar cuántas
  son y decidir si es error de captura.
- **Mover al repo las pruebas de humo** de Puppeteer que ya atraparon tres fallos.

### Bloque 1 · Diseño base (antes de cualquier pantalla nueva)

Sin migración. **Va aquí y no al final**: vienen 7 pantallas nuevas, y si los patrones no existen,
cada una inventa su layout.

- Extraer los 8 patrones a `components/patrones/`: `ListaDelDia`, `TarjetaPendiente`,
  `BloqueDato`, `SeccionFormulario`, `FiltroBarra`, `EstadoVacio`, `ConfirmarAccion`,
  `InsigniaEstado`. **Salen de Hoy, Reserva, Cerrar y Embarque** — es refactor, no diseño nuevo.
- `ModoProvider` con los tres modos (oficina · muelle · isla). El modo se marca **por
  dispositivo**, no por usuario. Salir del modo muelle pide confirmación.
- Los tres estados obligatorios en toda pantalla que traiga datos: cargando (esqueleto, no
  spinner), vacío (invita a actuar) y error (qué pasó y cómo se arregla).
- **Rehacer `Config.jsx` con los patrones**, como prueba de que alcanzan.

### Bloque 2 · Roles, guardias y multi-tenant (`014`)

Desbloquea todo lo demás: sin esto no se sabe a quién mostrarle qué ni a quién notificar.

- `perfiles` (user_id, nombre real, rol, activo) con **ocho roles**: `super_admin`, `gerencia`,
  `directora`, `asesora`, `asesora_comercial`, `admin_isla`, `recepcion`, `mesero`.
  **Cocina sale** — reciben las comandas en Zeus.
- RLS real por rol. **El dinero se excluye a nivel de columna** para isla, recepción y mesero, no
  se esconde en el front.
- `navegacion.js`: una sola fuente de verdad con el `home` y las rutas de cada rol. De ahí salen
  el Navbar, la redirección al entrar y la protección.
- **Calendario de guardias**: la directora y gerencia asignan quién cubre la isla cada día. La
  guardia **habilita** las acciones de `admin_isla` solo ese día; el rol base no cambia. Alerta si
  se acerca un fin de semana sin guardia.
- **Bitácora** de acciones sensibles (cierre, cambios tras el cierre, tarifas, cortesías, estados
  manuales, cierre de zarpe, envío de manifiesto, ajustes de inventario, anulaciones). El
  `super_admin` **también** queda auditado.
- **Aislamiento por hotel** (`hotel_id` + RLS). Se hace aquí porque después significa reescribir
  todas las políticas. Es lo que hace que el hotel #2 cueste cero de infraestructura.

### Bloque 3 · Personas y organizaciones (`015`)

Ver `spec-contingencia-personas.md`, parte 2. Va junto a roles porque comparte RLS.

- `personas` con documento como llave natural. `pasajeros.persona_id`.
- `agencias` → organizaciones con `tipo_organizacion`: agencia, operador externo, proveedor,
  aliado, empresa de personal, **institución** (CorpoTurismo, Parques, Capitanía, Financiera).
- `vinculos` y `etiquetas_persona` (calculadas vs. asignadas, separadas).
- **Los correos de destino viven en la ficha de cada institución**, no en Ajustes.
- Unir duplicados (solo directora o admin, con bitácora).
- Precarga en la reserva y en el check-in público.

### Bloque 4 · Tickets de soporte (`016`)

Adelantado a propósito: si van a probar durante meses, el canal de reportes tiene que existir
**mientras** se construye, no al final.

- `tickets` con contexto capturado solo: usuario, rol, ruta, fecha activa, modo, versión,
  dispositivo, conexión, eventos en cola, últimos errores de consola.
- Captura de pantalla automática con `html2canvas`, quitable. Adjunto manual como respaldo.
- Tres tipos: no funciona · se ve mal · idea. Más casilla **"me bloqueó la operación"** → push
  inmediato al `super_admin`.
- Botón en el shell, **también en modo muelle**. Funciona sin señal: entra a la cola.
- Estados visibles para quien reportó. Adjuntos se borran a los 90 días.

### Bloque 5 · Dinero y control (`017`–`019`)

- **Pagos y cartera** (`017`): tipo, valor, estado, soporte. Cartera por agencia con antigüedad
  (0-30/31-60/61-90/+90). Tasa de no-show por agencia.
- **Tiquetes** (`018`): kardex combinado (zarpe + parque). **Saldo inicial digitado una vez**, sin
  migrar la planilla. Compras manuales por lote con proveedor. **Consumo derivado del embarque**
  según `consume_tiquete`. Responsable de pago (hotel, agencia, cliente, empresa). **Alerta
  predictiva** al cerrar el día: *"quedan 30 y mañana van 87"*. Kardex mensual que **sí suma
  alojamiento** (la fórmula actual no lo hace).
- **Cortesías, metas y liquidación** (`019`): reporte mensual de cortesías con quién autorizó y
  costo de servicio. Metas por año, periodo y responsable — visibles para gerencia **y para
  Daniela**; las ventas de otras asesoras suman a su meta. Liquidación de comisiones por agencia.

### Bloque 6 · Operación ampliada (`020`–`021`)

- **Eventos masivos** (`020`): el evento como unidad comercial por encima de la reserva, con
  lancha asignada **por pasajero**. Caso real: Gematours, 250 personas = 7 manifiestos. Carga
  masiva de nombres, distribución en lanchas con zarpes escalonados, embarque por lotes, menú
  fijado a nivel de evento.
- **Restaurante externo**: reservas con lancha de terceros. No consumen cupo ni tiquete, sí
  generan ingreso. Se crean con anticipación y **se confirman o desconfirman en el cierre del día
  anterior**. Sus almuerzos **suman al conteo de cocina**.
- **Contingencia** (`021`): ver `spec-contingencia-personas.md`, parte 1, más la
  sección 2 de este documento (contingencia desde la isla).
- **Clima**: viento y oleaje de Open-Meteo (gratis, sin clave) en el cierre y en Hoy. **Informa,
  nunca decide** — la autoridad portuaria y el capitán definen el zarpe.

### Bloque 7 · Comunicación (`022`)

- **Notificaciones** con matriz configurable por usuario y evento. Cuatro canales: en la app,
  push, correo, WhatsApp (fase 2). Regla: *se notifica solo si quien recibe haría algo distinto,
  o si es un hecho que está esperando.*
- Eventos que sí notifican: zarpó · **salió de regreso de la isla** · llegó a Cartagena ·
  **falta gente en el conteo de regreso** (urgente) · nueva reserva (solo directora) · cambio tras
  el cierre · tiquetes insuficientes · sobrecupo · reserva de agencia sin nombres cerca del zarpe ·
  día cancelado · **cambio de hora del regreso**.
- **Informe semanal los lunes 8:30 a.m.** a gerencia y directora: la semana contra la anterior,
  avance de meta, top agencias, no-shows, cortesías, tiquetes, y lo que viene.
- **Postventa**: correo a la mañana siguiente del regreso con enlace directo a reseña de Google —
  a todos por igual, **sin incentivos ni filtrado** (viola las políticas de Google). Más encuesta
  interna, con alerta a la directora si la calificación es baja.

### Bloque 8 · Cierre

- **Informes** rehechos con `FiltroBarra` y `BloqueDato`, paleta de tokens en Recharts.
- **Módulo de marketing**: segmentos automáticos desde el historial (no vuelven hace un año,
  mexicanos que compraron Gold, etc.) exportables, más sugerencias generadas con IA sobre los
  datos del mes.
- **Reducción de clics**: auditoría de los flujos ya construidos. Autoría automática, persona
  natural como pasajero automático, agencia → canal y tarifa, plan → platos disponibles.
- **Página `/estilo`** (solo super_admin) con tokens, primitivos y patrones en los tres modos.
- **Aprendizaje por rol** y página "¿Cómo se hace?".

---

## 2. Contingencia desde la isla: el regreso que se mueve

Salieron con buen clima y a las 2 de la tarde está lloviendo. O al revés: viene mal tiempo y hay
que salir antes. **Quien decide es el capitán; quien informa es la isla; quien necesita saberlo es
todo el mundo.**

### Qué se puede hacer desde `/isla`

Tres acciones, cada una de un toque:

| Acción | Qué hace |
|---|---|
| **Adelantar el regreso** | Nueva hora + motivo. Notifica a Daniela y a los pasajeros |
| **Retrasar el regreso** | Nueva hora estimada + motivo. Misma notificación |
| **Salió Majagua 1** | Fija `hora_real_salida` del zarpe de regreso |

Y una cuarta, la grave: **"El regreso no puede salir"** — que abre el flujo de pernocta forzada
(quiénes se quedan, dónde, y aviso a quien los espera en Cartagena).

### Esquema

```sql
alter table zarpes
  add hora_estimada_actual time,        -- se mueve; la programada no
  add motivo_cambio_hora text,
  add hora_cambiada_por uuid references auth.users,
  add hora_cambiada_at timestamptz;
```

**La hora programada no se toca.** Se mueve la estimada. Así al final se puede medir cuánto se
desvía la operación de lo planeado, que es un dato útil por sí solo.

### Quién se entera y cómo

- **Daniela**, siempre y primero: es quien va al muelle a recibir. Push inmediato.
- **Los pasajeros**, si el cambio es de más de 30 minutos: correo o WhatsApp con la hora nueva.
  Y su **tarjeta se actualiza sola** — otra ventaja de que sea página y no imagen.
- **Recepción y gerencia**, en la app.
- **Quien esté de guardia**, si no es quien reportó.

### Detalle que importa

**En la isla puede no haber señal.** El cambio de hora se encola como todo lo demás y sale cuando
haya red — pero el aviso en pantalla debe mostrar **la hora del hecho, no la del envío**, para que
nadie se confunda si llega con retraso. Y si el cambio no ha logrado sincronizar, la pantalla lo
dice: *"pendiente de avisar"*.

---

## 3. Prompt maestro (pegar en Claude Code al inicio de cada sesión)

> Trabajo sobre DayPASS (`github.com/daypassmajagua/daypass`, raíz `daypass/`): la plataforma de
> pasadías del Hotel San Pedro de Majagua, Islas del Rosario, Cartagena. Los visitantes salen en
> lancha del muelle La Bodeguita a las 8:30, pasan el día en la isla con almuerzo y regresan hacia
> las 3:30 p.m. Volumen real: **20–35 pax en un día típico, picos de 85**. Lanchas de 41 asientos.
> La asesora líder se llama **Daniela**.
>
> ### Arquitectura
>
> Un solo sistema operado desde tres lugares —oficina, muelle e isla— que comparten la misma
> información en tiempo real. El dispositivo define la **vista**, no un módulo aparte.
>
> ### Ya existe y funciona (revisa `supabase/migrations/` antes de tocar nada)
>
> Migraciones 001–013 aplicadas · 23 tablas · 61 pruebas en Vitest · offline con Dexie y cola por
> `client_id` · check-in público en `/r/:token` con firma y QR · muelle con manifiesto y regreso ·
> `/isla` · sistema visual v2 · modo demo (`npm run demo`).
>
> ### Reglas que no se rompen
>
> 1. Un solo modelo de datos. Cambia la vista y los permisos por rol, no el dato.
> 2. Ningún campo de negocio con valores finitos es texto libre. `observaciones` es la única
>    excepción y no participa en cálculos ni informes.
> 3. Los estados los dispara la operación. El cambio manual es excepción auditada.
> 4. El precio se congela al crear la reserva. Las tarifas versionadas nunca reescriben el pasado.
> 5. Extender, no reemplazar. Migración nueva y numerada; jamás editar una aplicada.
> 6. Toda fecha de calendario es hora local de Colombia: `hoyLocal()` / `aFechaLocal()`. Nunca
>    `toISOString()` para derivar una fecha.
> 7. Nada de dropdowns ni datepickers nativos: `ui/Select`, `ui/DatePicker`, `ui/DateNav`.
> 8. Lenguaje de la operación: reserva, "guardando cambios", "Hoy". Prohibidas en la interfaz:
>    registro, entidad, query, sincronizar, submit, dashboard, settings. Español colombiano,
>    tuteo.
> 9. **Plato ≠ plan.** El plan vive en la reserva y da la tarifa; el plato vive en el pasajero.
>    Diamond no tiene opciones: no se pregunta.
> 10. **Quién paga ≠ quién come.** El conteo de cocina nunca se deriva de la regla de precios.
>     Infantes de 0 a 3 **sí almuerzan**.
> 11. **Tres banderas por persona embarcada**, derivadas del tipo de ingreso, nunca digitadas:
>     `consume_cupo` · `consume_tiquete` · `genera_ingreso`. Pasadía S/S/S · cortesía S/S/N ·
>     alojamiento S/S/N · empleado S/N/N · proveedor S/N/variable (`cobra_cupo` por reserva) ·
>     restaurante externo N/N/S.
> 12. **Una firma por reserva** (el titular), recogida en el check-in sobre la versión vigente de
>     `documentos_legales`. El canvas del iPad es respaldo.
> 13. **Dos ventanas del cliente:** nombres desde que existe la reserva hasta el zarpe; plato y
>     firma desde 2 días antes (configurable) hasta el zarpe. El check-in cierra **a la hora de
>     zarpe**, no al cerrar el día. Se vende hasta las **11:59 p.m.** del día anterior, con
>     segundo corte de cocina a las 6 a.m.
> 14. **El QR es una llave, no un boleto.** Contiene solo el token; todo lo demás se lee al
>     escanear. Token **aleatorio y largo**, nunca el consecutivo. Sirve de ida, en la isla y de
>     regreso. **Nunca es requisito para embarcar.**
> 15. **Lista nominal obligatoria por norma** (Capitanía): nombre, identificación y país de cada
>     persona, incluidos alojamiento y empleados, por lancha. El conteo rápido de grupo sirve para
>     el plato, jamás para los nombres.
> 16. **El envío lo hace el servidor**, nunca el dispositivo: el iPad del muelle no tiene WhatsApp
>     y a menudo no tiene señal. Si no hay red, se encola con estado visible.
> 17. **El regreso es el cierre real.** Solo baja quien subió. Contrasta y alerta si falta alguien.
>     Invalida el QR, cierra folios y día, programa el agradecimiento.
> 18. **Cortesías sin folio**: recepción cobra el tiquete directamente.
> 19. **Tiquetes**: inventario combinado, compra manual, consumo derivado, saldo inicial digitado
>     una vez, alerta predictiva contra las reservas de mañana.
> 20. Las reservas de otras asesoras y de la directora **se autoconfirman** si hay cupo y el día
>     está abierto; si no, escalan a Daniela **con la solución ya propuesta**, para resolver en un
>     clic. Las cortesías de la directora no piden aprobación. El cupo queda retenido hasta el
>     cierre.
> 21. **Lanchas con prioridad**: Majagua 1 y Majagua 2 primero. La asesora administra lanchas,
>     pilotos y empleados: catálogos, nunca texto libre; se seleccionan, no se digitan; se
>     desactivan, no se borran.
> 22. **Toda constante operativa vive en base de datos y la edita quien la usa.** Ningún correo,
>     texto de mensaje, horario o dato del hotel escrito en el código.
> 23. **Menos clics.** Cada campo justifica por qué se pregunta. Lo que el sistema puede deducir,
>     lo deduce: autoría por sesión, persona natural como primer pasajero, agencia → canal y
>     tarifa, fecha → temporada y precios, plan → platos disponibles. Lo deducido queda visible y
>     editable, con una línea que diga de dónde salió.
> 24. **Cada persona tiene su usuario con nombre real.** Sin cuentas compartidas. `creado_por` y
>     `actualizado_por` en toda tabla, más bitácora append-only de acciones sensibles. Consultar
>     no genera bitácora.
>
> ### Seguridad (aprendido a golpes en la migración 012)
>
> - En PostgreSQL **toda función nace con `EXECUTE` para `PUBLIC`**. Las `SECURITY DEFINER` pasan
>   por debajo de la RLS. Hay `alter default privileges ... revoke execute from public`, pero
>   **`create or replace` restablece los permisos**: toda migración que redefina una función tiene
>   que volver a revocar y terminar comprobando que solo cinco queden abiertas a `anon`.
> - Para saber qué puede ejecutar un rol se lee `has_function_privilege('anon', p.oid, 'execute')`
>   sobre `pg_proc`. **Nunca se llama a la función a ver qué pasa** — así se cerró por error el
>   día operativo del 9 de agosto en producción.
>
> ### Cómo trabajamos
>
> Vamos por bloques (0 a 8 del plan v6); te digo cuál en cada sesión. **No construyas bloques
> futuros ni "mejoras" fuera del alcance del bloque actual sin preguntarme.** Cada cambio de
> esquema va en migración nueva numerada. Antes de escribir código en un bloque, dime qué
> encontraste en el esquema actual que contradiga lo que voy a pedir.

---

## 4. Pendientes del dueño

1. **Resend** (clave) · **Vercel Pro** · **Supabase Pro** — ~45 USD/mes.
2. Reunión con Daniela: prueba práctica y preguntas de `reunion-daniela-preguntas.md`.
3. Datos: correos de destino · saldo inicial de tiquetes · metas del año · nombres, cargos y
   correos para los perfiles · catálogos reales.
4. Jurídico y aseguradora: firma electrónica (Ley 527) y habeas data (Ley 1581) — autorización de
   tratamiento en el check-in, política publicada, tiempo de retención.
5. Capitanía: ¿acepta manifiesto con plazas sin nombre? ¿talonario en paralelo?
6. **Motor de reservas**: averiguar en qué punto está la decisión del hotel y si integra. Queda
   fuera del alcance actual; se cotiza aparte.
7. **¿Cuántos días al año cierran el puerto?** Define cuánto pesa el bloque de contingencia.
