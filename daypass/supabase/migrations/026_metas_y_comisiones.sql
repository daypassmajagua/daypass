-- ════════════════════════════════════════════════════════════════════════════
-- 026 · Fase 5 (3 de 3) · Metas y comisiones
--
-- Lo último del bloque del dinero. **Las pone gerencia** —decisión del dueño—
-- y las ve también la coordinación: una meta que solo ve quien la fija no
-- cambia el comportamiento de nadie.
--
-- ── La meta de Daniela incluye lo que venden las demás ──────────────────────
--
-- La regla 20 lo dice: *«Las ventas de otras asesoras suman a su meta.»* Eso no
-- es un detalle de cálculo, es cómo funciona el cargo: ella responde por el
-- pasadía completo, no por lo que vendió con sus manos. Por eso la meta lleva
-- `incluye_equipo`: la de la coordinación cuenta todo, la de una asesora
-- comercial cuenta lo suyo.
--
-- Si eso se dejara al criterio de quien lee el informe, cada mes se calcularía
-- distinto.
--
-- ── Las comisiones se versionan, no se corrigen ─────────────────────────────
--
-- Un porcentaje que cambia en marzo no puede reescribir lo que se liquidó en
-- febrero. Misma lógica que las tarifas (regla 4): cada porcentaje tiene desde
-- cuándo rige, y la liquidación usa el que estaba vigente **el día del
-- pasadía**, no el de hoy.
--
-- ── Sobre qué se comisiona ──────────────────────────────────────────────────
--
-- Sobre `valor_a_cobrar()` (023), no sobre la tarifa: a una cortesía no se le
-- comisiona nada aunque la fórmula del plan dé un número. Y solo sobre lo que
-- de verdad ocurrió — lo cancelado y lo que no llegó no se comisiona.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Las metas
-- ════════════════════════════════════════════════════════════

do $$ begin
  create type periodo_meta as enum ('anual', 'trimestre', 'mes');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unidad_meta as enum ('ingresos', 'personas');
exception when duplicate_object then null; end $$;

comment on type unidad_meta is
  'En plata o en gente. Las dos importan y no siempre van juntas: un mes de '
  'muchos grupos con tarifa de mayorista mueve mucha gente y poca plata.';

create table if not exists metas (
  id uuid primary key default gen_random_uuid(),

  anio integer not null check (anio between 2020 and 2100),
  periodo periodo_meta not null default 'mes',
  -- 1..12 para mes, 1..4 para trimestre, null para anual.
  numero integer,

  unidad unidad_meta not null default 'ingresos',
  valor numeric(14,2) not null check (valor > 0),

  -- Null = la meta del pasadía completo, sin dueño personal.
  responsable_id uuid references perfiles(user_id) on delete set null,

  /**
   * Si cuenta lo que venden las demás. La de la coordinación sí (regla 20);
   * la de una asesora comercial, no.
   */
  incluye_equipo boolean not null default false,

  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),

  constraint meta_numero_coherente check (
    (periodo = 'anual' and numero is null)
    or (periodo = 'mes' and numero between 1 and 12)
    or (periodo = 'trimestre' and numero between 1 and 4)
  )
);

-- Una meta por combinación: dos metas para el mismo mes y la misma persona no
-- son un matiz, son un error de captura.
create unique index if not exists metas_unicas
  on metas (anio, periodo, coalesce(numero, 0), unidad,
            coalesce(responsable_id, '00000000-0000-0000-0000-000000000000'::uuid));

drop trigger if exists metas_updated_at on metas;
create trigger metas_updated_at before update on metas
  for each row execute function set_updated_at();

drop trigger if exists metas_firma on metas;
create trigger metas_firma before insert or update on metas
  for each row execute function sellar_autoria();

comment on table metas is
  'Las fija gerencia y las ve también la coordinación: una meta que solo ve '
  'quien la puso no cambia el comportamiento de nadie.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · El avance
-- ════════════════════════════════════════════════════════════

/** Los dos días que abarca un periodo. */
create or replace function rango_de_meta(p_anio integer, p_periodo periodo_meta, p_numero integer)
returns table (desde date, hasta date) as $$
  select
    case p_periodo
      when 'anual' then make_date(p_anio, 1, 1)
      when 'mes' then make_date(p_anio, p_numero, 1)
      when 'trimestre' then make_date(p_anio, (p_numero - 1) * 3 + 1, 1)
    end,
    case p_periodo
      when 'anual' then make_date(p_anio, 12, 31)
      when 'mes' then (make_date(p_anio, p_numero, 1) + interval '1 month - 1 day')::date
      when 'trimestre' then
        (make_date(p_anio, (p_numero - 1) * 3 + 1, 1) + interval '3 months - 1 day')::date
    end;
$$ language sql immutable;


create or replace view avance_metas as
select
  m.id,
  m.anio, m.periodo, m.numero, m.unidad, m.valor,
  m.responsable_id,
  coalesce(p.nombre, 'Todo el pasadía') as responsable,
  m.incluye_equipo,
  r.desde, r.hasta,
  coalesce((
    select case m.unidad
      when 'ingresos' then sum(valor_a_cobrar(reg.id))
      when 'personas' then sum(reg.adultos + reg.ninos)
    end
    from registros reg
   where reg.fecha between r.desde and r.hasta
     and reg.estado not in ('cancelada', 'noshow')
     -- Sin dueño o con `incluye_equipo`, cuenta todo. Con dueño y sin la
     -- bandera, solo lo que esa persona vendió.
     and (m.responsable_id is null
       or m.incluye_equipo
       or reg.vendida_por_id = m.responsable_id)
  ), 0) as logrado
from metas m
left join perfiles p on p.user_id = m.responsable_id
cross join lateral rango_de_meta(m.anio, m.periodo, m.numero) r
where puedo_ver_dinero() or tiene_rol('asesora');

comment on view avance_metas is
  'Cuánto va de cada meta. La de la coordinación cuenta lo que venden todas '
  '(regla 20); la de una asesora, solo lo suyo. Dejarlo al criterio de quien '
  'lee el informe haría que cada mes se calculara distinto.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Las comisiones
--
-- Versionadas: el porcentaje que rige es el del **día del pasadía**, no el de
-- hoy. Cambiar una comisión en marzo no puede reescribir febrero.
-- ════════════════════════════════════════════════════════════

create table if not exists comisiones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  porcentaje numeric(5,2) not null check (porcentaje >= 0 and porcentaje <= 100),
  desde date not null,
  hasta date,                    -- null = vigente
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),

  constraint comision_rango_valido check (hasta is null or hasta >= desde)
);

create index if not exists comisiones_org_idx on comisiones (organizacion_id, desde desc);

drop trigger if exists comisiones_updated_at on comisiones;
create trigger comisiones_updated_at before update on comisiones
  for each row execute function set_updated_at();

drop trigger if exists comisiones_firma on comisiones;
create trigger comisiones_firma before insert or update on comisiones
  for each row execute function sellar_autoria();

comment on table comisiones is
  'El porcentaje de cada agencia, con desde cuándo rige. Se versiona como las '
  'tarifas (regla 4): la liquidación usa el vigente el día del pasadía.';


/** El porcentaje que regía ese día. */
create or replace function comision_vigente(p_organizacion_id uuid, p_fecha date)
returns numeric as $$
  select c.porcentaje
    from comisiones c
   where c.organizacion_id = p_organizacion_id
     and c.desde <= p_fecha
     and (c.hasta is null or c.hasta >= p_fecha)
   order by c.desde desc
   limit 1;
$$ language sql stable security definer set search_path = public;


/**
 * La liquidación de un periodo.
 *
 * Solo lo que ocurrió: lo cancelado y lo que no llegó no se comisiona. Y la
 * base es `valor_a_cobrar()`, no la tarifa — a una cortesía no se le comisiona
 * nada aunque el plan dé un número.
 */
create or replace function liquidacion_comisiones(p_desde date, p_hasta date)
returns table (
  organizacion_id uuid,
  organizacion text,
  reservas integer,
  base numeric,
  porcentaje numeric,
  comision numeric
) as $$
  select
    o.id,
    o.nombre,
    count(*)::integer,
    sum(valor_a_cobrar(r.id)),
    -- El porcentaje del último día del rango, solo como referencia visible:
    -- la comisión se suma reserva por reserva con el vigente de cada día.
    comision_vigente(o.id, p_hasta),
    sum(valor_a_cobrar(r.id) * coalesce(comision_vigente(o.id, r.fecha), 0) / 100)
  from registros r
  join organizaciones o on o.id = r.agencia_id
 where puedo_ver_dinero()
   and r.fecha between p_desde and p_hasta
   and r.estado not in ('cancelada', 'noshow')
 group by o.id, o.nombre
having sum(valor_a_cobrar(r.id)) > 0
 order by 6 desc;
$$ language sql stable security definer set search_path = public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · RLS
--
-- **Las pone gerencia** (decisión del dueño), y las ve la coordinación.
-- ════════════════════════════════════════════════════════════

alter table metas      enable row level security;
alter table comisiones enable row level security;

drop policy if exists metas_lectura on metas;
create policy metas_lectura on metas for select to authenticated
  using (puedo_ver_dinero() or tiene_rol('asesora'));

drop policy if exists metas_escritura on metas;
create policy metas_escritura on metas for all to authenticated
  using (puedo_administrar()) with check (puedo_administrar());

drop policy if exists comisiones_lectura on comisiones;
create policy comisiones_lectura on comisiones for select to authenticated
  using (puedo_ver_dinero());

drop policy if exists comisiones_escritura on comisiones;
create policy comisiones_escritura on comisiones for all to authenticated
  using (puedo_administrar()) with check (puedo_administrar());

grant select, insert, update, delete on metas      to authenticated;
grant select, insert, update, delete on comisiones to authenticated;

revoke all on avance_metas from public, anon;
grant select on avance_metas to authenticated;

revoke all on function rango_de_meta(integer, periodo_meta, integer) from public, anon;
revoke all on function comision_vigente(uuid, date)                  from public, anon;
revoke all on function liquidacion_comisiones(date, date)            from public, anon;
grant execute on function rango_de_meta(integer, periodo_meta, integer) to authenticated;
grant execute on function comision_vigente(uuid, date)                  to authenticated;
grant execute on function liquidacion_comisiones(date, date)            to authenticated;


-- ── Comprobaciones ──
do $$
declare
  cuantas integer;
  abiertas text;
  d date; h date;
begin
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into cuantas, abiertas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5: %', cuantas, abiertas;
  end if;

  select count(*) into cuantas
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'v'
     and has_table_privilege('anon', c.oid, 'select');
  if cuantas > 0 then
    raise exception 'anon puede leer % vista(s)', cuantas;
  end if;

  -- Los rangos, que es donde un error se ve solo al cerrar el trimestre.
  select desde, hasta into d, h from rango_de_meta(2026, 'mes', 2);
  if d <> '2026-02-01' or h <> '2026-02-28' then
    raise exception 'El rango de febrero salió mal: % a %', d, h;
  end if;
  select desde, hasta into d, h from rango_de_meta(2026, 'trimestre', 4);
  if d <> '2026-10-01' or h <> '2026-12-31' then
    raise exception 'El rango del cuarto trimestre salió mal: % a %', d, h;
  end if;

  raise notice 'Metas y comisiones listas. Las pone gerencia; las ve la coordinación.';
end $$;
