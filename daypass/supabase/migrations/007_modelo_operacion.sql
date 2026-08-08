-- ============================================================
-- DayPASS — 007 · El modelo de la operación real (Plan v5, Fase B)
-- Ejecutar DESPUÉS de 006_zarpes_embarques.sql
--
-- Lo que el modelo original no sabía: el plato se elige por persona
-- dentro del plan; a bordo van tres poblaciones (visitantes,
-- alojamiento, empleados) con banderas distintas de cupo, tiquete e
-- ingreso; el manifiesto de Capitanía es nominal e incluye a todos;
-- y el cliente hará check-in remoto con un token, no con su número
-- de reserva.
-- ============================================================

-- ── 1. Opciones de plato ─────────────────────────────────────
-- El plan vive en la reserva y da la tarifa; el plato vive en el
-- pasajero. Diamond no tiene opciones → no se pregunta.

create table opciones_plato (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id),
  nombre_es text not null,
  nombre_en text not null,
  activo boolean not null default true,
  created_at timestamptz default now()
);

create index on opciones_plato (plan_id);

-- Semillas sobre los planes existentes, emparejando por categoría y
-- nivel. Los planes sin filas aquí simplemente no preguntan plato.
insert into opciones_plato (plan_id, nombre_es, nombre_en)
select p.id, o.nombre_es, o.nombre_en
  from planes p
  cross join lateral (
    values
      ('Pescado frito', 'Fried fish'),
      ('Filete de pescado', 'Fish fillet'),
      ('Pescado a la plancha', 'Grilled fish'),
      ('Pollo', 'Chicken')
  ) as o(nombre_es, nombre_en)
 where p.nivel = 'silver';

insert into opciones_plato (plan_id, nombre_es, nombre_en)
select p.id, o.nombre_es, o.nombre_en
  from planes p
  cross join lateral (
    values
      ('Langosta', 'Lobster'),
      ('Cazuela de mariscos', 'Seafood casserole')
  ) as o(nombre_es, nombre_en)
 where p.nivel = 'gold';

-- El plato elegido por cada persona. Nullable = "sin plato todavía".
alter table pasajeros
  add column opcion_plato_id uuid references opciones_plato(id);

-- ── 2. Tipos de ingreso y sus banderas ───────────────────────
-- Tres banderas por persona embarcada, derivadas del tipo, nunca
-- digitadas: consume_cupo / consume_tiquete / genera_ingreso.
-- Nullable a propósito: guía existe pero sus reglas están por
-- definir con el hotel; ante null, el consumidor cae a lo seguro
-- (cuenta cupo y tiquete).

create table tipos_ingreso (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  consume_cupo boolean,
  consume_tiquete boolean,
  genera_ingreso boolean,
  activo boolean not null default true
);

insert into tipos_ingreso (codigo, nombre, consume_cupo, consume_tiquete, genera_ingreso) values
  ('pasadia',     'Pasadía',              true,  true,  true),
  ('cortesia',    'Cortesía',             true,  true,  false),
  ('alojamiento', 'Huésped de alojamiento', true, true,  false),
  ('empleado',    'Empleado',             true,  false, false),
  ('proveedor',   'Proveedor',            true,  false, null),   -- variable: cobra_cupo en la reserva
  ('guia',        'Guía de turismo',      null,  null,  null);   -- por definir con el hotel

alter table registros
  add column tipo_ingreso_id uuid references tipos_ingreso(id),
  add column cobra_cupo boolean,                 -- solo aplica a proveedor
  add column valor_cupo numeric(12,2),
  add column telefono text,
  add column email text;

-- Todo lo existente es pasadía; de aquí en adelante el default lo
-- pone el front (obligatorio allí, no aquí: extender sin romper).
update registros
   set tipo_ingreso_id = (select id from tipos_ingreso where codigo = 'pasadia')
 where tipo_ingreso_id is null;

create index on registros (tipo_ingreso_id);

-- ── 3. Pilotos y empleados: catálogo, no texto libre ─────────
-- El manifiesto de Capitanía lleva el nombre del piloto y no puede
-- depender de cómo se escribió ese día. Desactivar, nunca borrar:
-- el histórico de manifiestos los referencia.

create table pilotos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  documento text,
  activo boolean not null default true,
  created_at timestamptz default now()
);

create table empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_documento tipo_documento,
  documento text,
  pais_id uuid references paises(id),
  activo boolean not null default true,
  created_at timestamptz default now()
);

-- ── 4. Lanchas con prioridad ─────────────────────────────────
-- Majagua 1 y Majagua 2 siempre primero; la autoasignación llena por
-- prioridad y las demás solo entran cuando esas dos se llenan.
-- Campo editable, no código duro: un cambio de flota no requiere
-- desarrollo.

alter table lanchas add column prioridad integer;

update lanchas set prioridad = 1 where codigo = 'MAJ1';
update lanchas set prioridad = 2 where codigo = 'MAJ2';
update lanchas set prioridad = 10 where prioridad is null;

-- ── 5. El zarpe gana su manifiesto ───────────────────────────

alter table zarpes
  add column piloto_id uuid references pilotos(id),   -- capitan (texto) se conserva por compatibilidad
  add column coordinador_tour text,
  add column agencia_operadora text;

-- Empleados que van en un zarpe: Daniela los marca con checkboxes.
create table zarpe_empleados (
  zarpe_id uuid not null references zarpes(id) on delete cascade,
  empleado_id uuid not null references empleados(id),
  primary key (zarpe_id, empleado_id)
);

-- Huéspedes de alojamiento en un zarpe: captura manual liviana.
-- (Zeus quedará detrás de un adaptador de lectura; esto no lo espera.)
create table zarpe_alojamiento (
  id uuid primary key default gen_random_uuid(),
  zarpe_id uuid not null references zarpes(id) on delete cascade,
  nombre text not null,
  documento text,
  pais_id uuid references paises(id),
  created_at timestamptz default now()
);

create index on zarpe_alojamiento (zarpe_id);

-- ── 6. Tokens del link público ───────────────────────────────
-- majagua.co/r/{token}. Token aleatorio largo, jamás el consecutivo.
-- El link caduca; el dato no.

create type estado_token as enum ('activo', 'check_in_abierto', 'finalizado', 'expirado');

create table tokens_reserva (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references registros(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  estado estado_token not null default 'activo',
  expira_at timestamptz,
  created_at timestamptz default now()
);

create index on tokens_reserva (registro_id);

-- ── 7. RLS ───────────────────────────────────────────────────
-- Mismo régimen que el resto hasta 013_roles. La página pública NO
-- lee estas tablas directamente: llegará vía funciones SECURITY
-- DEFINER en la fase C, nunca con políticas anon sobre tablas.

alter table opciones_plato    enable row level security;
alter table tipos_ingreso     enable row level security;
alter table pilotos           enable row level security;
alter table empleados         enable row level security;
alter table zarpe_empleados   enable row level security;
alter table zarpe_alojamiento enable row level security;
alter table tokens_reserva    enable row level security;

create policy "authenticated_full_access" on opciones_plato    for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on tipos_ingreso     for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on pilotos           for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on empleados         for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on zarpe_empleados   for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on zarpe_alojamiento for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on tokens_reserva    for all using (auth.role() = 'authenticated');

-- ── 8. Tiempo real ───────────────────────────────────────────
-- La preparación del zarpe se ve desde el muelle y la isla.

alter publication supabase_realtime add table zarpe_empleados;
alter publication supabase_realtime add table zarpe_alojamiento;
