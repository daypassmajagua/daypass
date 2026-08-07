-- ============================================================
-- DayPASS — 006 · Zarpes y embarques
-- Ejecutar DESPUÉS de 005_sello_del_cierre.sql
--
-- El muelle no edita: registra hechos. `embarques` nunca se actualiza
-- ni se borra; corregir un error es insertar un evento nuevo, y el
-- estado actual de una persona se deriva del último evento.
--
-- Eso elimina los conflictos de sincronización: dos iPads insertando
-- hechos distintos no colisionan, y `client_id` único hace que
-- reenviar la misma cola dos veces sea inofensivo.
-- ============================================================

-- ── 1. Zarpes ────────────────────────────────────────────────

create type sentido_zarpe as enum ('ida', 'regreso');

create type estado_zarpe as enum (
  'programado',  -- está en el plan del día
  'embarcando',  -- la asesora ya está en el muelle marcando
  'zarpado',     -- salió; su gente está en la isla
  'regresado',   -- volvió al muelle
  'cancelado'
);

create table zarpes (
  id uuid primary key default gen_random_uuid(),
  fecha date not null references dias_operativos(fecha),
  lancha_id uuid not null references lanchas(id),
  sentido sentido_zarpe not null default 'ida',

  hora_programada    time,
  hora_real_salida   timestamptz,
  hora_real_regreso  timestamptz,

  capitan text,
  tripulacion text,

  estado estado_zarpe not null default 'programado',
  cerrado_por uuid references auth.users(id),
  cerrado_at  timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on zarpes (fecha);
create index on zarpes (fecha, estado);
create unique index zarpes_unicos on zarpes (fecha, lancha_id, sentido, coalesce(hora_programada, '00:00'));

create trigger zarpes_updated_at
  before update on zarpes
  for each row execute function set_updated_at();

-- ── 2. Embarques: el registro de hechos ──────────────────────

create type evento_embarque as enum (
  'check_in',     -- subió
  'no_show',      -- no llegó
  'walk_in',      -- llegó sin reserva
  'desembarque'   -- bajó
);

create table embarques (
  id uuid primary key default gen_random_uuid(),
  zarpe_id uuid not null references zarpes(id),

  -- Los tres casos reales del muelle:
  --  · pasajero con nombre cargado  → pasajero_id y registro_id
  --  · reserva sin nombres todavía  → solo registro_id (una fila por persona)
  --  · walk-in sin reserva          → ninguno de los dos, y sus datos abajo
  pasajero_id uuid references pasajeros(id) on delete set null,
  registro_id uuid references registros(id) on delete set null,

  evento evento_embarque not null,

  -- Datos del walk-in. No se crea una reserva falsa en pleno embarque:
  -- la oficina la convierte después, con calma.
  nombre text,
  documento text,
  pais_id uuid references paises(id),
  categoria categoria_pasajero,

  ocurrido_at     timestamptz not null default now(),  -- hora del dispositivo
  sincronizado_at timestamptz default now(),           -- llegada al servidor

  registrado_por uuid references auth.users(id),
  dispositivo text,

  -- Generado en el iPad. Reenviar la misma cola dos veces no duplica nada.
  client_id uuid not null unique,

  created_at timestamptz default now()
);

create index on embarques (zarpe_id);
create index on embarques (registro_id);
create index on embarques (pasajero_id);
create index on embarques (zarpe_id, ocurrido_at desc);

-- Un walk-in necesita nombre; los demás eventos apuntan a alguien.
alter table embarques add constraint embarques_identifican_a_alguien check (
  (evento = 'walk_in' and nombre is not null)
  or (evento <> 'walk_in' and (pasajero_id is not null or registro_id is not null))
);

-- ── 3. Append-only, de verdad ────────────────────────────────
-- No basta con no escribir el UPDATE en el front: se bloquea aquí.

create or replace function embarques_son_inmutables()
returns trigger as $$
begin
  raise exception 'Los embarques no se corrigen: se registra un evento nuevo'
    using errcode = 'restrict_violation';
end;
$$ language plpgsql;

create trigger embarques_sin_update
  before update on embarques
  for each row execute function embarques_son_inmutables();

create trigger embarques_sin_delete
  before delete on embarques
  for each row execute function embarques_son_inmutables();

-- ── 4. El estado actual se deriva del último evento ──────────

create or replace view estado_embarques as
select distinct on (e.zarpe_id, coalesce(e.pasajero_id::text, e.client_id::text))
  e.zarpe_id,
  e.pasajero_id,
  e.registro_id,
  e.client_id,
  e.evento as estado,
  e.nombre,
  e.documento,
  e.categoria,
  e.ocurrido_at
from embarques e
order by e.zarpe_id,
         coalesce(e.pasajero_id::text, e.client_id::text),
         e.ocurrido_at desc;

-- ── 5. Cerrar un zarpe ───────────────────────────────────────
-- Fija la hora real, marca el zarpe como zarpado y manda a la isla a
-- todos los que efectivamente embarcaron.

create or replace function cerrar_zarpe(p_zarpe_id uuid)
returns zarpes as $$
declare
  z zarpes;
begin
  perform set_config('daypass.operacion_sistema', 'on', true);

  select * into z from zarpes where id = p_zarpe_id for update;
  if z is null then
    raise exception 'No existe ese zarpe' using errcode = 'no_data_found';
  end if;
  if z.estado in ('zarpado', 'regresado', 'cancelado') then
    raise exception 'Ese zarpe ya está %', z.estado using errcode = 'check_violation';
  end if;

  if z.sentido = 'ida' then
    update zarpes
       set estado = 'zarpado',
           hora_real_salida = coalesce(hora_real_salida, now()),
           cerrado_por = auth.uid(), cerrado_at = now()
     where id = p_zarpe_id
    returning * into z;

    -- Los que subieron ya están en la isla.
    update registros r
       set estado = 'en_isla'
     where r.fecha = z.fecha
       and r.estado in ('confirmada', 'tentativa')
       and exists (
         select 1 from estado_embarques ee
          where ee.zarpe_id = p_zarpe_id
            and ee.registro_id = r.id
            and ee.estado in ('check_in', 'walk_in')
       );

    -- El muelle marca el no llegó, no la oficina.
    update registros r
       set estado = 'noshow'
     where r.fecha = z.fecha
       and r.estado in ('confirmada', 'tentativa')
       and exists (
         select 1 from estado_embarques ee
          where ee.zarpe_id = p_zarpe_id and ee.registro_id = r.id and ee.estado = 'no_show'
       )
       and not exists (
         select 1 from estado_embarques ee
          where ee.zarpe_id = p_zarpe_id and ee.registro_id = r.id
            and ee.estado in ('check_in', 'walk_in')
       );

    -- El día entra en operación con el primer zarpe que sale.
    update dias_operativos
       set estado = 'en_operacion'
     where fecha = z.fecha and estado = 'tentativo_cerrado';
  else
    update zarpes
       set estado = 'regresado',
           hora_real_regreso = coalesce(hora_real_regreso, now()),
           cerrado_por = auth.uid(), cerrado_at = now()
     where id = p_zarpe_id
    returning * into z;
  end if;

  perform set_config('daypass.operacion_sistema', 'off', true);
  return z;
end;
$$ language plpgsql security definer;

-- ── 6. Programar los zarpes de un día ────────────────────────
-- Un zarpe de ida por cada lancha que tenga gente ese día.

create or replace function programar_zarpes(p_fecha date, p_hora time default '09:00')
returns setof zarpes as $$
begin
  insert into zarpes (fecha, lancha_id, sentido, hora_programada)
  select distinct p_fecha, r.lancha_id, 'ida'::sentido_zarpe, p_hora
    from registros r
   where r.fecha = p_fecha
     and r.estado not in ('cancelada', 'noshow')
  on conflict do nothing;

  return query select * from zarpes where fecha = p_fecha order by hora_programada, created_at;
end;
$$ language plpgsql security definer;

-- ── 7. RLS ───────────────────────────────────────────────────

alter table zarpes    enable row level security;
alter table embarques enable row level security;

create policy "authenticated_full_access" on zarpes
  for all using (auth.role() = 'authenticated');

-- Se puede leer e insertar. Actualizar y borrar no tienen política a
-- propósito: además del trigger, la base tampoco lo permite.
create policy "authenticated_read" on embarques
  for select using (auth.role() = 'authenticated');

create policy "authenticated_insert" on embarques
  for insert with check (auth.role() = 'authenticated');

-- ── 8. Tiempo real ───────────────────────────────────────────
-- Lo que el muelle marca lo ven la oficina y la isla al instante.

alter publication supabase_realtime add table zarpes;
alter publication supabase_realtime add table embarques;
alter table zarpes replica identity full;
