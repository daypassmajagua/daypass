-- ════════════════════════════════════════════════════════════════════════════
-- 023 · Fase 5 · Pagos y cartera
--
-- Quién debe qué, y desde cuándo. Hoy eso vive en la cabeza de Daniela y en una
-- columna del Excel que dice `cxc`.
--
-- ── Lo que hay que cobrar NO es `total_calculado` ───────────────────────────
--
-- Es la trampa de este bloque y conviene dejarla escrita. `total_calculado` es
-- una columna generada (001):
--
--     (adultos * precio_adulto) + (ninos * precio_nino) + precio_lancha
--
-- y hay tres casos en que eso **no** es lo que se cobra:
--
--   · **Cortesía, alojamiento, empleado.** Su tipo de ingreso tiene
--     `genera_ingreso = false` (regla 11). Hay que cobrar cero, aunque la
--     fórmula dé un número.
--   · **Proveedor con `cobra_cupo`.** Se le cobra `valor_cupo`, no la tarifa.
--   · **Proveedor sin `cobra_cupo`.** No se le cobra nada.
--
-- Por eso el saldo pasa por `valor_a_cobrar()` y nadie suma `total_calculado`
-- directamente. Y como la columna es `generated always`, no se puede extender:
-- la función es la única salida.
--
-- ── Frontera con Zeus, dicha de frente ──────────────────────────────────────
--
-- La factura y el folio viven en Zeus. Esto **no es contabilidad**: es el libro
-- de control de la operación —quién quedó debiendo y hace cuánto— para que
-- Daniela pueda cobrar sin abrir el Excel. Si algún día no cuadra con Zeus,
-- manda Zeus.
--
-- ── Un pago no se borra ─────────────────────────────────────────────────────
--
-- Se anula, con motivo y con nombre. Un registro de plata que desaparece sin
-- rastro es exactamente lo que un libro de control no puede permitirse.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Los pagos
-- ════════════════════════════════════════════════════════════

do $$ begin
  create type medio_pago as enum (
    'efectivo', 'transferencia', 'tarjeta', 'datafono', 'anticipo', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pago as enum ('registrado', 'verificado', 'anulado');
exception when duplicate_object then null; end $$;

comment on type estado_pago is
  'Registrado es lo que alguien dijo que entró; verificado es lo que se vio en '
  'la cuenta. La diferencia importa: una transferencia que nadie confirmó no '
  'es plata todavía.';

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references registros(id) on delete cascade,

  fecha date not null,
  valor numeric(12,2) not null check (valor > 0),
  medio medio_pago not null,
  estado estado_pago not null default 'registrado',

  soporte text,          -- número de comprobante, referencia, o cómo llegue
  notas text,

  anulado_motivo text,
  anulado_por uuid references auth.users(id),
  anulado_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),

  -- Anular exige motivo. Sin esto, "anulado" no le dice nada a quien lo lea
  -- dentro de seis meses.
  constraint pago_anulado_con_motivo check (
    estado <> 'anulado' or nullif(trim(coalesce(anulado_motivo, '')), '') is not null
  )
);

create index if not exists pagos_registro_idx on pagos (registro_id);
create index if not exists pagos_fecha_idx on pagos (fecha desc);

comment on table pagos is
  'Lo que de verdad entró por cada reserva. `registros.forma_pago` dice cómo se '
  'acordó pagar; esto dice qué se pagó. Son cosas distintas y por eso conviven.';

drop trigger if exists pagos_updated_at on pagos;
create trigger pagos_updated_at before update on pagos
  for each row execute function set_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Cuánto hay que cobrarle a una reserva
--
-- La pieza central. Todo lo demás la usa; nadie suma total_calculado a mano.
-- ════════════════════════════════════════════════════════════

create or replace function valor_a_cobrar(p_registro_id uuid)
returns numeric as $$
  select case
    -- Lo que no se cobró nunca no se cobra ahora.
    when r.estado in ('cancelada', 'noshow') then 0

    -- Regla 11: cortesía, alojamiento y empleado no generan ingreso.
    when coalesce(ti.genera_ingreso, true) = false then 0

    -- El proveedor es el caso variable: se le cobra el cupo, o nada.
    when ti.codigo = 'proveedor' then
      case when coalesce(r.cobra_cupo, false) then coalesce(r.valor_cupo, 0) else 0 end

    else coalesce(r.total_calculado, 0)
  end
  from registros r
  left join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
 where r.id = p_registro_id;
$$ language sql stable security definer set search_path = public;

comment on function valor_a_cobrar(uuid) is
  'Lo que hay que cobrarle a esta reserva. NO es total_calculado: esa columna '
  'generada ignora que las cortesías no generan ingreso y que al proveedor se '
  'le cobra el cupo. Todo el bloque de dinero pasa por aquí.';


/** Lo que ya entró: los pagos que no están anulados. */
create or replace function pagado_de_reserva(p_registro_id uuid)
returns numeric as $$
  select coalesce(sum(p.valor), 0)
    from pagos p
   where p.registro_id = p_registro_id
     and p.estado <> 'anulado';
$$ language sql stable security definer set search_path = public;


-- ── La vista del saldo, por reserva ──
-- Corre como su dueña con el filtro de dinero adentro: son cifras, y la isla y
-- el mesero no tienen nada que hacer aquí.
create or replace view saldos_reserva as
select
  r.id as registro_id,
  r.fecha,
  r.estado,
  r.nombre_pasajero,
  r.nombre_grupo,
  r.agencia_id,
  r.agencia_nombre,
  r.forma_pago,
  valor_a_cobrar(r.id)      as a_cobrar,
  pagado_de_reserva(r.id)   as pagado,
  valor_a_cobrar(r.id) - pagado_de_reserva(r.id) as saldo,
  -- Días desde el día del pasadía, que es cuando nace la deuda. No desde que
  -- se creó la reserva: una reserva de diciembre hecha en agosto no lleva
  -- cuatro meses de mora.
  greatest((hoy_bogota() - r.fecha), 0) as dias
from registros r
where puedo_ver_dinero();

comment on view saldos_reserva is
  'Una fila por reserva con lo que se debe. La antigüedad se cuenta desde la '
  'fecha del pasadía —cuando nace la deuda— y no desde que se creó la reserva.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · La cartera por organización, con antigüedad
--
-- Los tramos son los que usa el hotel: 0-30, 31-60, 61-90 y más de 90.
-- ════════════════════════════════════════════════════════════

create or replace view cartera_por_organizacion as
select
  coalesce(o.id::text, 'sin-organizacion')                       as organizacion_id,
  coalesce(o.nombre, nullif(s.agencia_nombre, ''), 'Sin agencia') as organizacion,
  count(*)::integer                                              as reservas,
  sum(s.saldo)                                                   as total,
  sum(s.saldo) filter (where s.dias <= 30)                       as al_dia,
  sum(s.saldo) filter (where s.dias between 31 and 60)           as de_31_a_60,
  sum(s.saldo) filter (where s.dias between 61 and 90)           as de_61_a_90,
  sum(s.saldo) filter (where s.dias > 90)                        as mas_de_90,
  max(s.dias)::integer                                           as mas_viejo
from saldos_reserva s
left join organizaciones o on o.id = s.agencia_id
where s.saldo > 0
  and s.fecha <= hoy_bogota()      -- lo de mañana todavía no es cartera
group by 1, 2;

comment on view cartera_por_organizacion is
  'Quién debe cuánto y desde cuándo. Las reservas viejas que solo traen '
  '`agencia_nombre` en texto se agrupan por ese nombre: no se pierden, pero '
  'tampoco se mezclan con la organización real hasta que alguien las asocie.';


-- ── Tasa de no-show por organización ──
-- Para saber con quién se sobrevende y con quién no.
create or replace view noshow_por_organizacion as
select
  coalesce(o.nombre, nullif(r.agencia_nombre, ''), 'Directo') as organizacion,
  count(*)::integer                                            as reservas,
  count(*) filter (where r.estado = 'noshow')::integer         as no_llegaron,
  round(
    100.0 * count(*) filter (where r.estado = 'noshow') / nullif(count(*), 0)
  , 1)                                                         as tasa
from registros r
left join organizaciones o on o.id = r.agencia_id
where puedo_ver_dinero()
  and r.fecha <= hoy_bogota()
  and r.estado <> 'cancelada'     -- cancelar a tiempo no es no llegar
group by 1
having count(*) >= 5;             -- con menos de cinco, un porcentaje engaña

comment on view noshow_por_organizacion is
  'Cancelar a tiempo no cuenta como no llegar: son cosas distintas y solo una '
  'deja la silla vacía. Y por debajo de cinco reservas no se muestra tasa — un '
  'porcentaje sobre dos casos dice más de lo que sabe.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Anular un pago
-- ════════════════════════════════════════════════════════════

create or replace function anular_pago(p_pago_id uuid, p_motivo text)
returns pagos as $$
declare pg pagos;
begin
  if not (puedo_administrar() or tiene_rol('asesora')) then
    raise exception 'Anular un pago lo hace la dirección o la coordinación'
      using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Anular un pago necesita motivo' using errcode = 'check_violation';
  end if;

  update pagos set
    estado = 'anulado',
    anulado_motivo = trim(p_motivo),
    anulado_por = auth.uid(),
    anulado_at = now(),
    actualizado_por = auth.uid()
  where id = p_pago_id and estado <> 'anulado'
  returning * into pg;

  if pg is null then
    raise exception 'Ese pago no existe o ya estaba anulado' using errcode = 'no_data_found';
  end if;

  perform anotar('anular_pago', 'pagos', p_pago_id::text, pg.fecha,
    jsonb_build_object('valor', pg.valor, 'motivo', trim(p_motivo),
                       'registro_id', pg.registro_id));

  return pg;
end;
$$ language plpgsql security definer set search_path = public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 · RLS y permisos
-- ════════════════════════════════════════════════════════════

alter table pagos enable row level security;

drop policy if exists pagos_lectura on pagos;
create policy pagos_lectura on pagos for select to authenticated
  using (puedo_ver_dinero());

-- Registrar un pago lo hace quien vende y quien coordina. Borrarlo, nadie:
-- se anula, que deja rastro. Sin política de DELETE la RLS lo niega.
drop policy if exists pagos_alta on pagos;
create policy pagos_alta on pagos for insert to authenticated
  with check (tiene_rol('super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial'));

drop policy if exists pagos_cambio on pagos;
create policy pagos_cambio on pagos for update to authenticated
  using (puedo_administrar() or tiene_rol('asesora'))
  with check (puedo_administrar() or tiene_rol('asesora'));

drop policy if exists pagos_baja on pagos;

grant select, insert, update on pagos to authenticated;

revoke all on saldos_reserva            from public, anon;
revoke all on cartera_por_organizacion  from public, anon;
revoke all on noshow_por_organizacion   from public, anon;
grant select on saldos_reserva           to authenticated;
grant select on cartera_por_organizacion to authenticated;
grant select on noshow_por_organizacion  to authenticated;

revoke all on function valor_a_cobrar(uuid)       from public, anon;
revoke all on function pagado_de_reserva(uuid)    from public, anon;
revoke all on function anular_pago(uuid, text)    from public, anon;
grant execute on function valor_a_cobrar(uuid)    to authenticated;
grant execute on function pagado_de_reserva(uuid) to authenticated;
grant execute on function anular_pago(uuid, text) to authenticated;


-- ── Comprobaciones ──
do $$
declare
  cuantas integer;
  abiertas text;
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

  select count(*), string_agg(c.relname, ', ')
    into cuantas, abiertas
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'v'
     and has_table_privilege('anon', c.oid, 'select');
  if cuantas > 0 then
    raise exception 'anon puede leer % vista(s): %', cuantas, abiertas;
  end if;

  -- Nadie borra un pago: se anula.
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'pagos' and cmd = 'DELETE') then
    raise exception 'Los pagos no se borran: sobra una política de DELETE';
  end if;

  -- Y el saldo no puede volver a sumar total_calculado a secas.
  if position('genera_ingreso' in
       pg_get_functiondef('valor_a_cobrar(uuid)'::regprocedure)) = 0 then
    raise exception 'valor_a_cobrar dejó de mirar si el tipo de ingreso cobra';
  end if;

  raise notice 'Pagos y cartera listos. Lo que se cobra sale de valor_a_cobrar, no de la tarifa.';
end $$;
