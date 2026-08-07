-- ============================================================
-- DayPASS — 002 · Pasajeros nominales
-- Ejecutar DESPUÉS de 001_initial_schema.sql
--
-- Los contadores de `registros` (adultos, ninos, infantes, cortesias)
-- siguen siendo EL PLAN. Esta tabla es LA REALIDAD: quién viene con
-- nombre propio. Los nombres llegan tarde en la operación real, así que
-- nada obliga a que coincidan — la diferencia se muestra, no se bloquea.
-- ============================================================

-- Tipo de documento como catálogo cerrado (regla: ningún campo de negocio
-- con valores finitos es texto libre).
create type tipo_documento as enum ('cc', 'ce', 'pasaporte', 'ti', 'rc', 'otro');

-- Categoría: espeja los contadores de registros.
create type categoria_pasajero as enum ('adulto', 'nino', 'infante', 'cortesia');

create table pasajeros (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references registros(id) on delete cascade,
  nombre text not null,
  tipo_documento tipo_documento,
  documento text,
  pais_id uuid references paises(id),
  categoria categoria_pasajero not null default 'adulto',
  restriccion_alimentaria text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on pasajeros (registro_id);
create index on pasajeros (pais_id);

-- Mismo trigger que ya usa `registros` (definido en 001).
create trigger pasajeros_updated_at
  before update on pasajeros
  for each row execute function set_updated_at();

-- RLS: misma política que el resto de tablas en esta etapa.
-- Los roles reales (asesora / directora / isla) llegan en 008_roles.sql.
alter table pasajeros enable row level security;

create policy "authenticated_full_access" on pasajeros
  for all using (auth.role() = 'authenticated');
