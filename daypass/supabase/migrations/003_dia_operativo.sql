-- ============================================================
-- DayPASS — 003 · El día operativo
-- Ejecutar DESPUÉS de 002_pasajeros.sql
--
-- El día es la unidad de trabajo del hotel. Aquí deja de estar
-- implícito en las fechas de las reservas y pasa a ser una fila con
-- estado propio, que es lo que los tres puntos miran para saber en
-- qué momento del ciclo están.
--
-- Regla que gobierna este archivo: los estados los dispara la
-- operación, no un selector. Lo que se pueda derivar, se deriva.
-- ============================================================

-- ── 1. El día ────────────────────────────────────────────────

create type estado_dia as enum (
  'planeando',          -- la oficina carga y ajusta
  'tentativo_cerrado',  -- se avisó a cocina y a la isla; ya se trabaja sobre esto
  'en_operacion',       -- hay gente embarcando o en la isla
  'cerrado'             -- el día terminó y quedó liquidado
);

create table dias_operativos (
  fecha date primary key,
  estado estado_dia not null default 'planeando',

  cerrado_tentativo_at  timestamptz,
  cerrado_tentativo_por uuid references auth.users(id),

  cerrado_at  timestamptz,
  cerrado_por uuid references auth.users(id),

  notas text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on dias_operativos (estado);

create trigger dias_operativos_updated_at
  before update on dias_operativos
  for each row execute function set_updated_at();

-- ── 2. Cambios tardíos ───────────────────────────────────────
-- Si una reserva cambia después de cerrar el tentativo, la cocina y
-- la isla ya trabajaron con la versión anterior y tienen que
-- enterarse. Se extiende `registros`; no se renombra nada.

alter table registros
  add column cambio_tardio        boolean     not null default false,
  add column cambio_tardio_at     timestamptz,
  add column cambio_tardio_por    uuid references auth.users(id),
  add column cambio_tardio_motivo text;

create index on registros (cambio_tardio) where cambio_tardio;

-- ── 3. Auditoría de estados ──────────────────────────────────
-- Todo cambio de estado queda con nombre y hora. `origen` distingue
-- lo que disparó la operación de lo que alguien forzó a mano.

create type origen_cambio as enum ('sistema', 'manual');

create table cambios_estado (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references registros(id) on delete cascade,
  estado_anterior text,
  estado_nuevo    text not null,
  origen origen_cambio not null default 'manual',
  motivo text,
  registrado_por uuid references auth.users(id),
  ocurrido_at timestamptz default now()
);

create index on cambios_estado (registro_id);
create index on cambios_estado (ocurrido_at desc);

-- ── 4. El día se crea solo ───────────────────────────────────
-- La primera reserva de una fecha abre su día en 'planeando'.
-- Los días nunca se borran.

create or replace function abrir_dia_si_no_existe()
returns trigger as $$
begin
  insert into dias_operativos (fecha)
  values (new.fecha)
  on conflict (fecha) do nothing;
  return new;
end;
$$ language plpgsql;

create trigger registros_abren_dia
  after insert or update of fecha on registros
  for each row execute function abrir_dia_si_no_existe();

-- ── 5. Marcado automático de cambios tardíos ─────────────────
-- Solo cuentan los campos que cambian el trabajo de cocina, muelle o
-- isla: cuánta gente viene, en qué lancha, con qué plan y si sigue en
-- pie. Escribir un folio Zeus o corregir un teléfono no es un cambio
-- tardío, y marcarlo como tal enseñaría a ignorar la señal.

create or replace function marcar_cambio_tardio()
returns trigger as $$
declare
  estado_del_dia estado_dia;
  cambio_relevante boolean;
begin
  -- Lo que hace el propio sistema (cerrar el tentativo, un zarpe, un
  -- folio) no es un cambio tardío de nadie.
  if coalesce(current_setting('daypass.operacion_sistema', true), 'off') = 'on' then
    return new;
  end if;

  select estado into estado_del_dia
  from dias_operativos where fecha = new.fecha;

  if estado_del_dia is null or estado_del_dia = 'planeando' then
    return new;
  end if;

  cambio_relevante :=
       new.adultos     is distinct from old.adultos
    or new.ninos       is distinct from old.ninos
    or new.infantes    is distinct from old.infantes
    or new.cortesias   is distinct from old.cortesias
    or new.plan_id     is distinct from old.plan_id
    or new.lancha_id   is distinct from old.lancha_id
    or new.fecha       is distinct from old.fecha
    or new.nombre_grupo is distinct from old.nombre_grupo
    or (new.estado is distinct from old.estado and new.estado = 'cancelada');

  if cambio_relevante then
    new.cambio_tardio    := true;
    new.cambio_tardio_at := now();
    new.cambio_tardio_por := auth.uid();
  end if;

  return new;
end;
$$ language plpgsql;

create trigger registros_marcan_cambio_tardio
  before update on registros
  for each row execute function marcar_cambio_tardio();

-- ── 6. Bitácora de estados ───────────────────────────────────

create or replace function registrar_cambio_estado()
returns trigger as $$
begin
  if new.estado is distinct from old.estado then
    insert into cambios_estado (
      registro_id, estado_anterior, estado_nuevo, origen, registrado_por
    ) values (
      new.id, old.estado, new.estado,
      case when coalesce(current_setting('daypass.operacion_sistema', true), 'off') = 'on'
           then 'sistema'::origen_cambio
           else 'manual'::origen_cambio end,
      auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger registros_registran_cambio_estado
  after update on registros
  for each row execute function registrar_cambio_estado();

-- ── 7. Cerrar el tentativo ───────────────────────────────────
-- El ritual de las 7 p.m. Un solo paso: el día pasa a
-- tentativo_cerrado y toda reserva tentativa queda confirmada.

create or replace function cerrar_tentativo(p_fecha date)
returns dias_operativos as $$
declare
  dia dias_operativos;
begin
  perform set_config('daypass.operacion_sistema', 'on', true);

  insert into dias_operativos (fecha) values (p_fecha)
  on conflict (fecha) do nothing;

  select * into dia from dias_operativos where fecha = p_fecha for update;

  if dia.estado <> 'planeando' then
    raise exception 'El día % ya no está en planeación (está en %)', p_fecha, dia.estado
      using errcode = 'check_violation';
  end if;

  update registros
     set estado = 'confirmada'
   where fecha = p_fecha
     and estado = 'tentativa';

  update dias_operativos
     set estado = 'tentativo_cerrado',
         cerrado_tentativo_at = now(),
         cerrado_tentativo_por = auth.uid()
   where fecha = p_fecha
  returning * into dia;

  perform set_config('daypass.operacion_sistema', 'off', true);
  return dia;
end;
$$ language plpgsql security definer;

-- ── 8. Cerrar el día ─────────────────────────────────────────

create or replace function cerrar_dia(p_fecha date)
returns dias_operativos as $$
declare
  dia dias_operativos;
begin
  perform set_config('daypass.operacion_sistema', 'on', true);

  update dias_operativos
     set estado = 'cerrado',
         cerrado_at = now(),
         cerrado_por = auth.uid()
   where fecha = p_fecha
  returning * into dia;

  if dia is null then
    raise exception 'No existe el día %', p_fecha using errcode = 'no_data_found';
  end if;

  perform set_config('daypass.operacion_sistema', 'off', true);
  return dia;
end;
$$ language plpgsql security definer;

-- ── 9. Cambio manual de estado, con motivo ───────────────────
-- Existe porque hasta el sprint del muelle no hay operación que
-- dispare los estados. En 008_roles.sql queda restringido a
-- dirección; la bitácora del punto 6 ya deja el rastro.

create or replace function cambiar_estado_manual(
  p_registro_id uuid,
  p_estado text,
  p_motivo text default null
)
returns registros as $$
declare
  reg registros;
begin
  update registros set estado = p_estado
   where id = p_registro_id
  returning * into reg;

  if reg is null then
    raise exception 'No existe la reserva %', p_registro_id using errcode = 'no_data_found';
  end if;

  update cambios_estado
     set motivo = p_motivo
   where registro_id = p_registro_id
     and id = (select id from cambios_estado
                where registro_id = p_registro_id
                order by ocurrido_at desc limit 1);

  return reg;
end;
$$ language plpgsql security definer;

-- ── 10. RLS ──────────────────────────────────────────────────

alter table dias_operativos enable row level security;
alter table cambios_estado  enable row level security;

create policy "authenticated_full_access" on dias_operativos
  for all using (auth.role() = 'authenticated');

-- La bitácora se lee, no se edita a mano: la escriben los triggers.
create policy "authenticated_read" on cambios_estado
  for select using (auth.role() = 'authenticated');

-- ── 11. Tiempo real ──────────────────────────────────────────
-- Lo que el muelle marca aparece en la oficina y en la isla sin que
-- nadie recargue.

alter publication supabase_realtime add table dias_operativos;
alter publication supabase_realtime add table registros;
alter publication supabase_realtime add table pasajeros;

-- Realtime necesita la fila anterior para poder comparar en el cliente.
alter table registros  replica identity full;
alter table pasajeros  replica identity full;

-- ── 12. Días de las reservas que ya existen ──────────────────

insert into dias_operativos (fecha)
select distinct fecha from registros
on conflict (fecha) do nothing;
