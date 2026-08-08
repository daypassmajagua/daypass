# DayPASS — Especificación: contingencia y perfiles de personas

Dos módulos aterrizados, listos para construir. Complementan el plan v5 y el estado del 8 de
agosto.

---

# PARTE 1 · Contingencia ante eventualidad

## 1.1 Los tres escenarios reales

No es uno solo, y cada uno se resuelve distinto:

| Escenario | Cuándo | Qué pasa |
|---|---|---|
| **No se zarpa** | Antes de salir | Bandera roja, avería, decisión del hotel. Nadie salió |
| **Salió parte** | A media mañana | MAJ 1 ya zarpó cuando cierran el puerto. MAJ 2 no sale |
| **No se puede volver** | Tarde | La gente está en la isla y el regreso no puede salir |

El tercero es el más grave y el que nadie prevé: **hay personas varadas en la isla.** El hotel
tiene que alojarlas o esperar a que abran el puerto, y alguien tiene que saber exactamente
quiénes son. El sistema ya lo sabe: son los que embarcaron y no han desembarcado.

## 1.2 Esquema

```sql
-- estado nuevo del día operativo
alter type estado_dia add value 'cancelado';

alter table dias_operativos
  add cancelado_at timestamptz,
  add cancelado_por uuid references auth.users,
  add motivo_cancelacion motivo_cancelacion,   -- enum
  add nota_cancelacion text;

-- enum
create type motivo_cancelacion as enum
  ('bandera_roja','averia','decision_hotel','fuerza_mayor','otro');

-- la cancelación también puede ser de un zarpe suelto
alter table zarpes
  add motivo_cancelacion motivo_cancelacion,
  add nota_cancelacion text;

-- qué se decidió con cada reserva afectada
create table contingencias_reserva (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references registros on delete cascade,
  dia date not null,
  decision text not null check (decision in
    ('reprogramada','devuelta','pendiente','sostenida')),
  registro_nuevo_id uuid references registros,   -- si se reprogramó
  valor_devuelto numeric(12,2),                  -- si se devolvió
  soporte_url text,
  motivo text,
  registrado_por uuid references auth.users,
  ocurrido_at timestamptz not null default now()
);

-- personas que se quedaron en la isla
create table pernoctas_forzadas (
  id uuid primary key default gen_random_uuid(),
  zarpe_id uuid references zarpes,
  pasajero_id uuid references pasajeros,
  registro_id uuid references registros,
  motivo text,                     -- 'puerto cerrado', 'decisión propia'
  resuelto_at timestamptz,         -- cuándo salió finalmente
  registrado_por uuid references auth.users
);
```

**Nota importante:** una reserva reprogramada **no se edita** — se crea la del día nuevo y la
original queda `cancelada` apuntando a ella con `registro_nuevo_id`. Así el histórico no miente y
los informes de cada mes siguen cuadrando.

## 1.3 La pantalla

Un botón **"Cancelar el día"** en `/cerrar` y en `/`, que abre una pantalla con tres pasos:

**Paso 1 — Qué se cancela.** Todo el día o zarpes específicos. Motivo del enum y nota libre.

**Paso 2 — Qué se hace con cada reserva.** La lista completa del día, con las cuatro decisiones y
**acciones en lote arriba**: *"Reprogramar todas a mañana"*, *"Marcar todas como pendientes"*.
Al elegir "reprogramar a [fecha]", el sistema **valida cupo del día destino** contando pasadías,
alojamiento, empleados y externos — y avisa antes si no caben.

**Paso 3 — Confirmar.** Un resumen: cuántas se reprograman, cuántas se devuelven, cuánto suma la
devolución, cuántos tiquetes vuelven al inventario, y a cuántas personas se les va a avisar.

## 1.4 Lo que se dispara solo

**Los tiquetes vuelven al inventario.** Nadie zarpó, nadie consumió. Es un movimiento de entrada
en el kardex con concepto "reversa por cancelación" y referencia al día. **Sin esto el inventario
queda descuadrado** — es muy probable que parte de los saldos negativos de la planilla actual
salgan de aquí.

**El aviso masivo.** Reutiliza la pantalla de "Enviar tarjetas": una fila por reserva, con el
mensaje ya escrito según la decisión (reprogramada con nueva fecha / devuelta / pendiente).
Correo automático desde el servidor, y el botón de WhatsApp para las que lo necesiten.

**Los tokens.** Reprogramada → el link sigue vivo y la tarjeta se actualiza sola con la fecha
nueva (una ventaja más de que sea página y no imagen). Devuelta o cancelada → el token pasa a
`finalizado` y muestra la explicación.

**Las notificaciones.** A la isla y a cocina primero — ellos ya prepararon. A la directora y
gerencia. Al administrador o a quien esté de guardia.

**El manifiesto no se envía.** Si no hubo zarpe, no hay manifiesto. Si se canceló después de
enviarlo, se envía una corrección.

## 1.5 El registro del costo

Al cerrar la cancelación se guarda lo que ya se sabe: **pax afectados, almuerzos ya preparados,
tiquetes recuperados y valor devuelto.** En el informe mensual aparece como *"3 días cancelados
por clima · X pax · $Y en costo"*. Es un número que hoy no existe y que a gerencia le sirve para
presupuestar temporada de lluvias.

## 1.6 Si el que falla es el sistema

Distinto problema, misma filosofía: **la operación no depende de que un servidor esté vivo.**

- **La falla probable ya está resuelta:** la que ocurre de verdad no es que se caiga Supabase, es
  que no haya señal en el muelle — y para eso está la capa offline.
- **El respaldo de papel es el plan B, no un retroceso.** Lo que se imprime en el cierre de la
  noche anterior —manifiesto, lista del día, tickets— es exactamente lo que se necesita para
  operar sin sistema. Debe quedar como PDF guardado, no solo en pantalla.
- **Respaldo diario descargable**: un archivo con el día completo, generado en el cierre, que
  Daniela tenga en su computador.
- **Reingreso:** cuando el sistema vuelve, tiene que existir una forma explícita de decir *"este
  zarpe se operó a mano"* y capturar el resultado. Si no, ese día queda como hueco en los
  informes y nadie sabe por qué.

---

# PARTE 2 · Personas y organizaciones

## 2.1 El principio

**Una sola tabla de personas, con el documento de identidad como llave natural.** No tres
catálogos paralelos de clientes, proveedores y empleados — porque la misma persona puede ser
varias cosas, y en distintos momentos.

Y la regla que evita el error más probable:

> **La etiqueta propone, la reserva decide.** Que Rafael López esté marcado como proveedor hace
> que el sistema *sugiera* tipo de ingreso "proveedor". Si ese día va con su familia pagando, se
> cambia. El tipo de ingreso vive en la reserva, nunca en la persona.

## 2.2 Esquema

```sql
create table personas (
  id uuid primary key default gen_random_uuid(),
  tipo_documento tipo_documento,
  documento text,                          -- llave natural
  nombre text not null,
  pais_id uuid references paises,
  telefono text, email text,
  restriccion_alimentaria text,
  opcion_plato_habitual_id uuid references opciones_plato,
  notas text,
  activo boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz,
  unique (tipo_documento, documento)
);

-- las agencias se generalizan a organizaciones
alter table agencias
  add tipo_organizacion tipo_organizacion not null default 'agencia',
  add nit text, add comision_pct numeric(5,2), add condiciones_pago text;

create type tipo_organizacion as enum (
  'agencia',            -- Dorado, All Reps, Panamericana, Aviatur
  'operador_externo',   -- lanchas de terceros que reservan restaurante
  'proveedor',          -- AISA y demás
  'aliado',             -- Diving Planet
  'empresa_personal',   -- la que provee trabajadores
  'institucion'         -- CorpoTurismo, Parques Nacionales, Capitanía
);

create table vinculos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas on delete cascade,
  organizacion_id uuid not null references agencias on delete cascade,
  rol text,                                -- 'contacto', 'guía', 'representante'
  tipo_ingreso_sugerido_id uuid references tipos_ingreso,
  desde date, hasta date,
  unique (persona_id, organizacion_id)
);

create table etiquetas_persona (
  persona_id uuid references personas on delete cascade,
  etiqueta text not null,                  -- vip, prensa, influencer, frecuente
  asignada_por uuid references auth.users, -- null = calculada por el sistema
  motivo text,
  asignada_at timestamptz default now(),
  primary key (persona_id, etiqueta)
);

-- los pasajeros apuntan a la persona cuando hay documento
alter table pasajeros add persona_id uuid references personas;
```

## 2.3 Dos clases de estatus, y no se mezclan

**Calculado** — lo deduce el sistema y nadie lo toca: *"9 visitas este año"*, *"cliente
frecuente"*, *"primera visita"*. Se recalcula solo.

**Asignado** — lo pone una persona con motivo y queda con autoría: VIP, prensa, influencer.
Solo la directora o gerencia.

Mezclarlos hace que nadie sepa si "VIP" significa que vino mucho o que alguien lo decidió.

## 2.4 CorpoTurismo, Parques y Capitanía como organizaciones

Esto ordena algo que estaba suelto: **los correos de destino no van en "Ajustes", van en la ficha
de cada institución**, junto con sus contactos.

- **Capitanía de Puerto** — contacto: Rosiri (la que da los zarpes). Recibe el manifiesto.
- **CorpoTurismo** — recibe el manifiesto y vende tiquetes.
- **Parques Nacionales** — vende tiquetes.
- **Financiera** — puede ser interna, pero recibe manifiesto y control de tiquetes.

Así, cuando cambia una persona o un correo, se edita donde tiene sentido y todo lo que dependa de
esa institución queda actualizado. Y el kardex de tiquetes puede referenciar de quién se compró
cada lote.

## 2.5 Cómo se usa (que es lo que importa)

**Al crear la reserva.** Daniela escribe "Rafael" y aparece con documento, país, plan habitual y
sus etiquetas. Un toque y queda armada, con el tipo de ingreso sugerido según su vínculo. **Cero
digitación para todo el que ya vino antes.**

**En el check-in público.** Si el documento coincide con alguien del historial, se precargan país,
restricciones y el plato de la última vez: *"La vez pasada pediste pescado frito, ¿repetimos?"* —
un toque en vez de una decisión.

**En la isla y en recepción.** *"Tercera visita este año"* · *"Viene por Diving Planet"* ·
*"Alergia al maní"*. Antes de que la persona llegue. Eso es servicio.

**En el perfil.** Todas sus visitas con fecha, plan, agencia y valor. Y del lado de la
organización: pax por mes, ticket promedio, mix de planes, cartera, no-show y **cumplimiento del
pre-registro** — la pantalla que la directora abre antes de renegociar un convenio.

## 2.6 Duplicados

Van a existir: la misma persona con documento escrito distinto, o sin documento la primera vez.
Hace falta una acción **"unir personas"** (solo directora o admin): selecciona dos, elige cuál
queda, y el sistema reapunta pasajeros, vínculos y etiquetas. Con registro en bitácora, porque es
irreversible.

## 2.7 Privacidad

Con esto DayPASS pasa a ser, formalmente, una base de datos de personas: documentos de identidad
de miles de visitantes guardados por años. **No soy abogado**, pero tres cosas para revisar con el
jurídico del hotel antes de producción:

- **Autorización de tratamiento** en el check-in, junto al texto de condiciones que ya se firma.
- **Política de tratamiento** publicada y un canal para pedir eliminación.
- **Tiempo de retención** definido. "Para siempre por si acaso" no es una política.

---

## Dependencias

**Contingencia** necesita: tiquetes (para la reversa al inventario) y notificaciones (para el
aviso). Se puede construir antes y dejar esos dos enganches marcados.

**Personas** necesita ir **antes** del módulo de marketing y de los informes por cliente, porque
es lo que alimenta la segmentación. Y conviene hacerlo junto con roles, porque comparte las
políticas de RLS.
