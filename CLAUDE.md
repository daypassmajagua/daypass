# DayPASS — Contexto permanente del proyecto

Este archivo lo lee Claude Code al inicio de cada sesión. **No hay que pegarlo: se carga solo.**

Documentos de referencia en `docs/`:
- `plan-v6.md` — los ocho bloques de ejecución (qué se construye y en qué orden)
- `spec-checkin-qr.md` — ciclo reserva → check-in → QR → embarque → regreso
- `spec-contingencia-personas.md` — contingencia y perfiles de personas
- `sistema-diseno.md` — patrones, modos y reglas visuales

---

## El negocio

Plataforma de pasadías del **Hotel San Pedro de Majagua**, Islas del Rosario, Cartagena. Los
visitantes salen en lancha del muelle La Bodeguita a las 8:30, pasan el día en la isla con almuerzo
y regresan hacia las 3:30 p.m.

**Volumen real:** 20–35 pax en un día típico, picos de 85. Lanchas de 41 asientos. Unas 6–9
reservas nuevas por día. **Diseña para claridad y velocidad de uso, no para escala.**

**Un solo sistema operado desde tres lugares** —oficina, muelle e isla— que comparten la misma
información en tiempo real. El dispositivo define la vista, no un módulo aparte.

**Principio rector:** eliminar papeles, eliminar retrabajos y doble digitación, y hacer todo lo más
sencillo posible para todo el mundo.

---

## Las 24 reglas

1. Un solo modelo de datos. Cambia la vista y los permisos por rol, no el dato.
2. Ningún campo de negocio con valores finitos es texto libre. `observaciones` es la única
   excepción y no participa en cálculos ni informes.
3. Los estados los dispara la operación. El cambio manual es excepción auditada.
4. El precio se congela al crear la reserva. Las tarifas versionadas nunca reescriben el pasado.
5. Extender, no reemplazar. Migración nueva y numerada; jamás editar una aplicada.
6. Toda fecha de calendario es hora local de Colombia: `hoyLocal()` / `aFechaLocal()`. Nunca
   `toISOString()` para derivar una fecha.
7. Nada de dropdowns ni datepickers nativos: `ui/Select`, `ui/DatePicker`, `ui/DateNav`.
8. Lenguaje de la operación: reserva, "guardando cambios", "Hoy". Prohibidas en la interfaz:
   registro, entidad, query, sincronizar, submit, dashboard, settings. Español colombiano, tuteo.
9. **Plato ≠ plan.** El plan vive en la reserva y da la tarifa; el plato vive en el pasajero.
   Diamond no tiene opciones: no se pregunta.
10. **Quién paga ≠ quién come.** El conteo de cocina nunca se deriva de la regla de precios.
    Infantes de 0 a 3 **sí almuerzan**.
11. **Tres banderas por persona embarcada**, derivadas del tipo de ingreso, nunca digitadas:
    `consume_cupo` · `consume_tiquete` · `genera_ingreso`.
    Pasadía S/S/S · cortesía S/S/N · alojamiento S/S/N · empleado S/N/N ·
    proveedor S/N/variable (`cobra_cupo` por reserva) · restaurante externo N/N/S.
12. **Una firma por reserva** (el titular), recogida en el check-in sobre la versión vigente de
    `documentos_legales`. El canvas del iPad es respaldo.
13. **Dos ventanas del cliente:** nombres desde que existe la reserva hasta el zarpe; plato y firma
    desde 2 días antes (configurable) hasta el zarpe. El check-in cierra **a la hora de zarpe**, no
    al cerrar el día. Se vende hasta las **11:59 p.m.** del día anterior, con segundo corte de
    cocina a las 6 a.m.
14. **El QR es una llave, no un boleto.** Contiene solo el token; todo lo demás se lee al escanear.
    Token **aleatorio y largo**, nunca el consecutivo. Sirve de ida, en la isla y de regreso.
    **Nunca es requisito para embarcar.**
15. **Lista nominal obligatoria por norma** (Capitanía): nombre, identificación y país de cada
    persona, incluidos alojamiento y empleados, por lancha. El conteo rápido de grupo sirve para el
    plato, jamás para los nombres.
16. **El envío lo hace el servidor**, nunca el dispositivo: el iPad del muelle no tiene WhatsApp y
    a menudo no tiene señal. Si no hay red, se encola con estado visible.
17. **El regreso es el cierre real.** Solo baja quien subió. Contrasta y alerta si falta alguien.
    Invalida el QR, cierra folios y día, programa el agradecimiento.
18. **Cortesías sin folio**: recepción cobra el tiquete directamente.
19. **Tiquetes**: inventario combinado (zarpe + parque), compra manual por lote, consumo derivado
    del embarque, saldo inicial digitado una vez, alerta predictiva contra las reservas de mañana.
20. Las reservas de otras asesoras y de la directora **se autoconfirman** si hay cupo y el día está
    abierto; si no, escalan **con la solución ya propuesta**, para resolver en un clic. Las
    cortesías de la directora no piden aprobación. El cupo queda retenido hasta el cierre.
21. **Lanchas con prioridad**: Majagua 1 y Majagua 2 primero. La asesora administra lanchas,
    pilotos y empleados: catálogos, nunca texto libre; se seleccionan, no se digitan; se desactivan,
    no se borran.
22. **Toda constante operativa vive en base de datos y la edita quien la usa.** Ningún correo, texto
    de mensaje, horario o dato del hotel escrito en el código.
23. **Menos clics.** Cada campo justifica por qué se pregunta. Lo que el sistema puede deducir, lo
    deduce: autoría por sesión, persona natural como primer pasajero, agencia → canal y tarifa,
    fecha → temporada y precios, plan → platos disponibles. Lo deducido queda visible y editable,
    con una línea que diga de dónde salió.
24. **Cada persona tiene su usuario con nombre real.** Sin cuentas compartidas. `creado_por` y
    `actualizado_por` en toda tabla, más bitácora append-only de acciones sensibles. Consultar no
    genera bitácora.

---

## Quién es quién

**Ocho roles:** `super_admin` (AISA, el proveedor) · `gerencia` · `directora` · `asesora`
(Daniela, líder del pasadía) · `asesora_comercial` · `admin_isla` · `recepcion` · `mesero`.
**Cocina no tiene perfil** — reciben las comandas en Zeus.

**Turnos, no personas fijas.** Al muelle no va siempre Daniela: puede ir cualquier asesora
comercial o la coordinadora de alojamiento, y puede ser una persona la que embarca en la mañana y
otra la que recibe en la tarde. Tres tipos de turno, **asignados por día**:

- **Guardia de isla** — la asigna la directora o gerencia.
- **Embarque** y **recibimiento** — los coordina Daniela, pero las asesoras pueden tomarlos o
  cederlos entre ellas.

El turno **habilita** las acciones correspondientes solo ese día; el rol base no cambia.
**Las notificaciones se enrutan al turno, no a la persona.** Si un día tiene gente confirmada y
nadie en el turno, aparece como pendiente.

---

## Seguridad (aprendido a golpes en la migración 012)

- En PostgreSQL **toda función nace con `EXECUTE` para `PUBLIC`**. Las `SECURITY DEFINER` pasan por
  debajo de la RLS. Hay `alter default privileges ... revoke execute from public`, pero
  **`create or replace` restablece los permisos**: toda migración que redefina una función tiene que
  volver a revocar y terminar comprobando que solo cinco queden abiertas a `anon`.
- Para saber qué puede ejecutar un rol se lee `has_function_privilege('anon', p.oid, 'execute')`
  sobre `pg_proc`. **Nunca se llama a la función a ver qué pasa** — así se cerró por error el día
  operativo del 9 de agosto en producción.
- **Nunca ejecutes migraciones ni escrituras contra producción.** Las corre el dueño.

---

## Cómo trabajamos

- **Un bloque por sesión** (0 a 8 de `docs/plan-v6.md`). Te digo cuál al empezar.
- **No construyas bloques futuros ni "mejoras" fuera del alcance del bloque actual sin
  preguntarme.**
- **Antes de escribir código, revisa el esquema y dime qué encontraste que contradiga lo que voy a
  pedir.** Hay 23 tablas y decisiones que cambiaron en el camino.
- Cada cambio de esquema va en migración nueva y numerada. Las migraciones se escriben aquí y las
  corre el dueño en Supabase.
- Al terminar: `npm test`, `npm run build`, `npx eslint src` (línea base: 36 problemas), y probar
  en `npm run demo`.
- Un commit por bloque, con mensaje que diga qué bloque es.

---

## Comandos

```bash
npm run dev      # contra Supabase real (.env)
npm run demo     # datos de muestra en memoria — puerto 5175
npm run build
npm test         # Vitest
npx eslint src   # línea base: 36 problemas conocidos
```
