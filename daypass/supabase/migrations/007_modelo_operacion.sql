-- ============================================================
-- DayPASS — 007 · El modelo de la operación real (Plan v5, Fase B)
-- Ejecutar DESPUÉS de 006_zarpes_embarques.sql
--
-- ⚠️ CÓMO CORRERLA
-- Cierra primero todas las pestañas del navegador con DayPASS abierto.
-- Las suscripciones de tiempo real mantienen locks sobre registros,
-- pasajeros y zarpes, y esta migración necesita lock exclusivo sobre
-- esas tablas: ahí es donde se produce el interbloqueo.
--
-- Los tres bloques se pueden correr por separado y REPETIR sin daño:
-- todo es idempotente. Si un bloque falla por lock, vuelve a correrlo.
--
-- Qué agrega: el plato se elige por persona dentro del plan; a bordo
-- van tres poblaciones con banderas distintas de cupo, tiquete e
-- ingreso; el manifiesto de Capitanía es nominal e incluye
-- alojamiento y empleados; y el cliente hará check-in remoto con un
-- token, no con su número de reserva.
-- ============================================================

-- Antes que nada: si un lock no se consigue en 8 segundos, falla
-- rápido en vez de quedarse esperando y provocar un interbloqueo.
set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Tablas nuevas (no toca nada existente: sin riesgo)
-- ════════════════════════════════════════════════════════════

-- ── Tipos ────────────────────────────────────────────────────
do $$ begin
  create type estado_token as enum ('activo', 'check_in_abierto', 'finalizado', 'expirado');
exception when duplicate_object then null;
end $$;

-- ── Opciones de plato ────────────────────────────────────────
-- El plan vive en la reserva y da la tarifa; el plato vive en el
-- pasajero. Diamond no tiene opciones → no se pregunta.

create table if not exists opciones_plato (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes(id),
  nombre_es text not null,
  nombre_en text not null,
  activo boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists opciones_plato_plan_idx on opciones_plato (plan_id);

-- Evita duplicar semillas si el bloque se repite.
create unique index if not exists opciones_plato_unicas
  on opciones_plato (plan_id, nombre_es);

insert into opciones_plato (plan_id, nombre_es, nombre_en)
select p.id, o.nombre_es, o.nombre_en
  from planes p
  cross join (values
      ('Pescado frito', 'Fried fish'),
      ('Filete de pescado', 'Fish fillet'),
      ('Pescado a la plancha', 'Grilled fish'),
      ('Pollo', 'Chicken')
  ) as o(nombre_es, nombre_en)
 where p.nivel = 'silver'
on conflict (plan_id, nombre_es) do nothing;

insert into opciones_plato (plan_id, nombre_es, nombre_en)
select p.id, o.nombre_es, o.nombre_en
  from planes p
  cross join (values
      ('Langosta', 'Lobster'),
      ('Cazuela de mariscos', 'Seafood casserole')
  ) as o(nombre_es, nombre_en)
 where p.nivel = 'gold'
on conflict (plan_id, nombre_es) do nothing;

-- ── Tipos de ingreso y sus banderas ──────────────────────────
-- Tres banderas por persona embarcada, derivadas del tipo, nunca
-- digitadas. Nullable a propósito: guía existe pero sus reglas están
-- por definir con el hotel; ante null, el consumidor cae a lo seguro.

create table if not exists tipos_ingreso (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  consume_cupo boolean,
  consume_tiquete boolean,
  genera_ingreso boolean,
  activo boolean not null default true
);

insert into tipos_ingreso (codigo, nombre, consume_cupo, consume_tiquete, genera_ingreso) values
  ('pasadia',     'Pasadía',                true,  true,  true),
  ('cortesia',    'Cortesía',               true,  true,  false),
  ('alojamiento', 'Huésped de alojamiento', true,  true,  false),
  ('empleado',    'Empleado',               true,  false, false),
  ('proveedor',   'Proveedor',              true,  false, null),  -- variable: cobra_cupo en la reserva
  ('guia',        'Guía de turismo',        null,  null,  null)   -- por definir con el hotel
on conflict (codigo) do nothing;

-- ── Pilotos y empleados: catálogo, no texto libre ────────────
-- El manifiesto de Capitanía lleva el nombre del piloto y no puede
-- depender de cómo se escribió ese día. Desactivar, nunca borrar: el
-- histórico de manifiestos los referencia.

create table if not exists pilotos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  documento text,
  activo boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_documento tipo_documento,
  documento text,
  pais_id uuid references paises(id),
  activo boolean not null default true,
  created_at timestamptz default now()
);

-- ── Tokens del link público ──────────────────────────────────
-- majagua.co/r/{token}. Token aleatorio largo, jamás el consecutivo.
-- El link caduca; el dato no.

create table if not exists tokens_reserva (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references registros(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  estado estado_token not null default 'activo',
  expira_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists tokens_reserva_registro_idx on tokens_reserva (registro_id);

-- ── RLS de lo nuevo ──────────────────────────────────────────
-- Mismo régimen que el resto hasta 013_roles. La página pública NO
-- lee estas tablas directamente: llegará vía funciones SECURITY
-- DEFINER en la fase C, nunca con políticas anon sobre tablas.

alter table opciones_plato enable row level security;
alter table tipos_ingreso  enable row level security;
alter table pilotos        enable row level security;
alter table empleados      enable row level security;
alter table tokens_reserva enable row level security;

do $$ begin
  create policy "authenticated_full_access" on opciones_plato for all using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_access" on tipos_ingreso for all using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_access" on pilotos for all using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_access" on empleados for all using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_access" on tokens_reserva for all using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Columnas sobre tablas que ya existen
-- Aquí es donde puede haber lock: cierra la app antes.
-- Cada ALTER es una operación de catálogo, dura milisegundos.
-- ════════════════════════════════════════════════════════════

alter table pasajeros add column if not exists opcion_plato_id uuid references opciones_plato(id);

alter table registros
  add column if not exists tipo_ingreso_id uuid references tipos_ingreso(id),
  add column if not exists cobra_cupo boolean,              -- solo aplica a proveedor
  add column if not exists valor_cupo numeric(12,2),
  add column if not exists telefono text,
  add column if not exists email text;

-- Todo lo existente es pasadía; de aquí en adelante el default lo
-- pone el front (obligatorio allí, no aquí: extender sin romper).
update registros
   set tipo_ingreso_id = (select id from tipos_ingreso where codigo = 'pasadia')
 where tipo_ingreso_id is null;

create index if not exists registros_tipo_ingreso_idx on registros (tipo_ingreso_id);

-- Lanchas con prioridad: Majagua 1 y 2 siempre primero; las demás
-- solo entran cuando esas se llenan. Campo editable, no código duro.
alter table lanchas add column if not exists prioridad integer;

update lanchas set prioridad = 1  where codigo = 'MAJ1' and prioridad is distinct from 1;
update lanchas set prioridad = 2  where codigo = 'MAJ2' and prioridad is distinct from 2;
update lanchas set prioridad = 10 where prioridad is null;

-- El zarpe gana su manifiesto. `capitan` (texto) se conserva por
-- compatibilidad hasta migrar los datos viejos.
alter table zarpes
  add column if not exists piloto_id uuid references pilotos(id),
  add column if not exists coordinador_tour text,
  add column if not exists agencia_operadora text;

-- Empleados que van en un zarpe: la coordinadora los marca con un toque.
create table if not exists zarpe_empleados (
  zarpe_id uuid not null references zarpes(id) on delete cascade,
  empleado_id uuid not null references empleados(id),
  primary key (zarpe_id, empleado_id)
);

-- Huéspedes de alojamiento en un zarpe: captura manual liviana.
-- (Zeus quedará detrás de un adaptador de lectura; esto no lo espera.)
create table if not exists zarpe_alojamiento (
  id uuid primary key default gen_random_uuid(),
  zarpe_id uuid not null references zarpes(id) on delete cascade,
  nombre text not null,
  documento text,
  pais_id uuid references paises(id),
  created_at timestamptz default now()
);

create index if not exists zarpe_alojamiento_zarpe_idx on zarpe_alojamiento (zarpe_id);

alter table zarpe_empleados   enable row level security;
alter table zarpe_alojamiento enable row level security;

do $$ begin
  create policy "authenticated_full_access" on zarpe_empleados for all using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_full_access" on zarpe_alojamiento for all using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Tiempo real
-- Va aparte y de último: tocar la publicación mientras el worker
-- de Realtime está leyendo es justo lo que provoca el interbloqueo.
-- ════════════════════════════════════════════════════════════

do $$ begin
  alter publication supabase_realtime add table zarpe_empleados;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table zarpe_alojamiento;
exception when duplicate_object then null; end $$;
