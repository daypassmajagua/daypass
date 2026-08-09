-- ════════════════════════════════════════════════════════════════════════════
-- 022 · Fase 5 · Tiquetes
--
-- El inventario combinado: el tiquete de zarpe (autoridad portuaria) y el del
-- parque (Parques Nacionales). Se compran por lote, se consumen embarcando, y
-- si un día se acaban **la lancha no sale**. Por eso esta parte va primero de
-- las tres del bloque: pagos y metas informan, esto detiene la operación.
--
-- ── El error que la planilla arrastra y que aquí NO se repite ───────────────
--
-- El kardex del Excel no suma los huéspedes de alojamiento, y por eso sus
-- saldos vienen quedando cortos. Pero el plan decía "consumo derivado del
-- embarque", y derivarlo solo de `embarques` habría copiado el mismo error:
--
--   · La regla 11 dice que alojamiento **sí consume tiquete** (S/S/N).
--   · Los huéspedes de alojamiento **no están en `embarques`**: viajan por
--     `zarpe_alojamiento` (007), que es otra tabla y solo alimenta el
--     manifiesto.
--
-- Así que el consumo se cuenta de **las dos fuentes**. Es la corrección que
-- justifica sola construir esto: cuando se digite el saldo inicial no va a
-- cuadrar con la planilla, y estará bien.
--
-- ── Por qué el consumo es un movimiento por día y no uno por persona ────────
--
-- `embarques` es append-only y se sincroniza desde iPads que pueden reenviar
-- la cola. Un trigger que descontara un tiquete por cada embarque descontaría
-- de más en cuanto algo se reenviara, y el inventario dejaría de ser
-- confiable justo donde más importa.
--
-- En vez de eso el día se **recuenta** y se guarda un solo movimiento por día
-- y por tipo, que se puede volver a calcular las veces que haga falta —un
-- cambio tardío mueve el número y el movimiento se actualiza—. El kardex
-- queda corto de leer y siempre cuadra con lo que de verdad embarcó.
--
-- ── Lo que este archivo NO hace ─────────────────────────────────────────────
--
-- **No inventa el saldo inicial.** Se digita una vez, con la fecha de corte, y
-- de ahí en adelante el kardex se lleva solo. Migrar la planilla sería
-- heredar sus errores.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Los tipos
-- ════════════════════════════════════════════════════════════

do $$ begin
  create type tipo_tiquete as enum ('zarpe', 'parque');
exception when duplicate_object then null; end $$;

comment on type tipo_tiquete is
  'Zarpe es el de la autoridad portuaria; parque es el de Parques Nacionales. '
  'Se compran y se cuentan aparte porque se pagan a entidades distintas.';

do $$ begin
  create type clase_movimiento_tiquete as enum (
    'saldo_inicial',  -- una sola vez, con su fecha de corte
    'compra',         -- un lote
    'consumo',        -- lo que embarcó ese día
    'ajuste'          -- un conteo físico que no cuadra, con motivo
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type responsable_tiquete as enum ('hotel', 'agencia', 'cliente', 'empresa');
exception when duplicate_object then null; end $$;


-- ── Quién paga el tiquete de esta reserva ──
-- No siempre lo pone el hotel: hay agencias que compran su bloque y clientes
-- que lo pagan aparte. Sin esto no se puede saber cuánto del inventario es
-- costo propio.
alter table registros
  add column if not exists tiquete_responsable responsable_tiquete;

comment on column registros.tiquete_responsable is
  'Quién paga el tiquete de esta reserva. En null se asume el hotel, que es '
  'el caso corriente — pero se deja explícito para poder cobrarlo aparte.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Las compras
-- ════════════════════════════════════════════════════════════

create table if not exists tiquetes_lotes (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_tiquete not null,
  fecha date not null,
  cantidad integer not null check (cantidad > 0),
  valor_unitario numeric(12,2),
  proveedor_id uuid references organizaciones(id),
  numero_soporte text,          -- factura o recibo, como venga
  notas text,
  created_at timestamptz not null default now(),
  creado_por uuid references auth.users(id)
);

create index if not exists tiquetes_lotes_fecha_idx on tiquetes_lotes (fecha desc);

comment on table tiquetes_lotes is
  'Cada compra de tiquetes. El movimiento del kardex se crea solo con un '
  'trigger: comprar y anotar la compra son el mismo hecho, y separarlos '
  'garantiza que algún día uno de los dos se olvide.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · El kardex
-- ════════════════════════════════════════════════════════════

create table if not exists movimientos_tiquete (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_tiquete not null,
  clase clase_movimiento_tiquete not null,
  fecha date not null,

  -- Positivo entra, negativo sale. El saldo es la suma, sin más.
  cantidad integer not null check (cantidad <> 0),

  lote_id uuid references tiquetes_lotes(id) on delete cascade,
  motivo text,
  detalle jsonb,               -- de dónde salió el conteo, para poder auditarlo

  created_at timestamptz not null default now(),
  creado_por uuid references auth.users(id)
);

create index if not exists movimientos_tiquete_fecha_idx on movimientos_tiquete (fecha desc);
create index if not exists movimientos_tiquete_tipo_idx on movimientos_tiquete (tipo, fecha);

-- Un solo consumo por día y por tipo: es lo que hace que recontar sea seguro.
create unique index if not exists movimientos_tiquete_consumo_unico
  on movimientos_tiquete (tipo, fecha) where clase = 'consumo';

-- Y un solo saldo inicial por tipo, que es lo que significa "inicial".
create unique index if not exists movimientos_tiquete_inicial_unico
  on movimientos_tiquete (tipo) where clase = 'saldo_inicial';

comment on table movimientos_tiquete is
  'El kardex. Positivo entra, negativo sale; el saldo es la suma. El consumo '
  'es UN movimiento por día y por tipo, recalculable: `embarques` se '
  'sincroniza desde iPads que reenvían su cola, y descontar por evento habría '
  'descontado de más en el primer reenvío.';


-- El movimiento de una compra lo pone la compra.
create or replace function lote_mueve_el_kardex()
returns trigger as $$
begin
  insert into movimientos_tiquete (tipo, clase, fecha, cantidad, lote_id, creado_por)
  values (new.tipo, 'compra', new.fecha, new.cantidad, new.id, new.creado_por);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists tiquetes_lotes_mueven on tiquetes_lotes;
create trigger tiquetes_lotes_mueven after insert on tiquetes_lotes
  for each row execute function lote_mueve_el_kardex();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Cuánto se consumió un día
--
-- Aquí está la corrección. Tres poblaciones, no una:
--
--   1. Quien embarcó con reserva, si su tipo de ingreso consume tiquete.
--   2. El walk-in, que no tiene reserva: llegó a hacer el pasadía y paga
--      como tal, así que consume.
--   3. **Los huéspedes de alojamiento**, que la regla 11 marca S/S/N y que
--      NO están en `embarques` — es exactamente lo que la planilla no suma.
--
-- Los empleados no consumen (S/N/N), y por eso `zarpe_empleados` no aparece.
-- ════════════════════════════════════════════════════════════

create or replace function consumo_tiquetes_del_dia(p_fecha date)
returns jsonb as $$
  with ida as (
    select z.id from zarpes z
     where z.fecha = p_fecha and z.sentido = 'ida'
  ),
  con_reserva as (
    select count(*)::integer as n
      from estado_embarques ee
      join ida on ida.id = ee.zarpe_id
      join registros r on r.id = ee.registro_id
      left join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
     where ee.estado in ('check_in', 'walk_in')
       -- Ante un tipo sin definir se cae a lo seguro: se cuenta. Un tiquete
       -- de más en el conteo se nota; uno de menos deja a alguien en tierra.
       and coalesce(ti.consume_tiquete, true)
  ),
  sin_reserva as (
    select count(*)::integer as n
      from estado_embarques ee
      join ida on ida.id = ee.zarpe_id
     where ee.estado = 'walk_in' and ee.registro_id is null
  ),
  alojados as (
    select count(*)::integer as n
      from zarpe_alojamiento za
      join ida on ida.id = za.zarpe_id
  )
  select jsonb_build_object(
    'fecha', p_fecha,
    'con_reserva', con_reserva.n,
    'walk_in_sin_reserva', sin_reserva.n,
    'alojamiento', alojados.n,
    'total', con_reserva.n + sin_reserva.n + alojados.n
  )
  from con_reserva, sin_reserva, alojados;
$$ language sql stable security definer set search_path = public;

comment on function consumo_tiquetes_del_dia(date) is
  'Cuántas personas consumieron tiquete ese día, contando las tres '
  'poblaciones. El desglose viaja en el resultado para poder auditarlo: si el '
  'número no cuadra, dice de dónde salió cada parte.';


/**
 * Deja el consumo del día en el kardex. Se puede correr las veces que haga
 * falta: si el día cambió después de cerrar, el movimiento se actualiza en vez
 * de duplicarse.
 */
create or replace function registrar_consumo_tiquetes(p_fecha date)
returns jsonb as $$
declare
  conteo jsonb;
  total integer;
  t tipo_tiquete;
begin
  if not (puedo_administrar() or tiene_rol('asesora')) then
    raise exception 'El inventario de tiquetes lo lleva la coordinación'
      using errcode = '42501';
  end if;

  conteo := consumo_tiquetes_del_dia(p_fecha);
  total := (conteo ->> 'total')::integer;

  -- Los dos tipos se consumen a la vez y en la misma cantidad: es la misma
  -- persona la que sube a la lancha y entra al parque.
  foreach t in array array['zarpe', 'parque']::tipo_tiquete[] loop
    if total = 0 then
      delete from movimientos_tiquete
       where clase = 'consumo' and fecha = p_fecha and tipo = t;
    else
      insert into movimientos_tiquete (tipo, clase, fecha, cantidad, detalle, creado_por)
      values (t, 'consumo', p_fecha, -total, conteo, auth.uid())
      on conflict (tipo, fecha) where clase = 'consumo'
      do update set cantidad = -total, detalle = conteo, creado_por = auth.uid();
    end if;
  end loop;

  return conteo;
end;
$$ language plpgsql security definer set search_path = public;


-- ── Saldo y alerta ──

create or replace function saldo_tiquetes()
returns table (tipo tipo_tiquete, saldo integer) as $$
  select t.tipo, coalesce(sum(m.cantidad), 0)::integer
    from unnest(array['zarpe', 'parque']::tipo_tiquete[]) as t(tipo)
    left join movimientos_tiquete m on m.tipo = t.tipo
   where puedo_ver_dinero()
   group by t.tipo
   order by t.tipo;
$$ language sql stable security definer set search_path = public;


/**
 * «Quedan 30 y mañana van 87.»
 *
 * La alerta que se mira al cerrar el día. Cuenta las personas de las reservas
 * confirmadas de mañana que consumen tiquete, y las compara con el saldo. Un
 * día que arranca sin tiquetes es un día que no zarpa.
 */
create or replace function alerta_tiquetes(p_fecha date default null)
returns jsonb as $$
declare
  dia date := coalesce(p_fecha, hoy_bogota());
  manana date := dia + 1;
  necesita integer;
  saldos jsonb;
  minimo integer;
begin
  select coalesce(sum(
           r.adultos + r.ninos + r.infantes + r.cortesias
         ), 0)::integer
    into necesita
    from registros r
    left join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
   where r.fecha = manana
     and r.estado not in ('cancelada', 'noshow')
     and coalesce(ti.consume_tiquete, true);

  select jsonb_object_agg(s.tipo, s.saldo), min(s.saldo)
    into saldos, minimo
    from saldo_tiquetes() s;

  return jsonb_build_object(
    'fecha', manana,
    'necesita', necesita,
    'saldos', coalesce(saldos, '{}'::jsonb),
    'alcanza', coalesce(minimo, 0) >= necesita,
    'faltan', greatest(necesita - coalesce(minimo, 0), 0)
  );
end;
$$ language plpgsql stable security definer set search_path = public;


-- ── El kardex mensual, que SÍ suma alojamiento ──
create or replace view kardex_tiquetes as
select
  m.tipo,
  date_trunc('month', m.fecha)::date as mes,
  sum(m.cantidad) filter (where m.clase = 'saldo_inicial')::integer as saldo_inicial,
  sum(m.cantidad) filter (where m.clase = 'compra')::integer         as compras,
  -sum(m.cantidad) filter (where m.clase = 'consumo')::integer       as consumo,
  sum(m.cantidad) filter (where m.clase = 'ajuste')::integer         as ajustes,
  sum(m.cantidad)::integer as neto_del_mes
from movimientos_tiquete m
group by m.tipo, date_trunc('month', m.fecha);

comment on view kardex_tiquetes is
  'El mes, por tipo. Su consumo sale de consumo_tiquetes_del_dia, que suma los '
  'huéspedes de alojamiento — la planilla no lo hacía, así que estos números '
  'NO van a cuadrar con ella, y esa es justamente la corrección.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 · RLS
--
-- El inventario tiene costo: lo ve quien ve plata. La isla y el mesero no
-- tienen nada que hacer aquí.
-- ════════════════════════════════════════════════════════════

alter table tiquetes_lotes       enable row level security;
alter table movimientos_tiquete  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tiquetes_lotes', 'movimientos_tiquete'] loop
    execute format('drop policy if exists %I_lectura on %I', t, t);
    execute format('drop policy if exists %I_escritura on %I', t, t);
    execute format(
      'create policy %I_lectura on %I for select to authenticated '
      'using (puedo_ver_dinero())', t, t);
    execute format(
      'create policy %I_escritura on %I for all to authenticated '
      'using (puedo_administrar() or tiene_rol(''asesora'')) '
      'with check (puedo_administrar() or tiene_rol(''asesora''))', t, t);
  end loop;
end $$;

-- La vista corre como su dueña —agrega, no expone filas— con el filtro dentro.
create or replace view kardex_tiquetes as
select
  m.tipo,
  date_trunc('month', m.fecha)::date as mes,
  sum(m.cantidad) filter (where m.clase = 'saldo_inicial')::integer as saldo_inicial,
  sum(m.cantidad) filter (where m.clase = 'compra')::integer         as compras,
  -sum(m.cantidad) filter (where m.clase = 'consumo')::integer       as consumo,
  sum(m.cantidad) filter (where m.clase = 'ajuste')::integer         as ajustes,
  sum(m.cantidad)::integer as neto_del_mes
from movimientos_tiquete m
where puedo_ver_dinero()
group by m.tipo, date_trunc('month', m.fecha);

revoke all on kardex_tiquetes from public, anon;
grant select on kardex_tiquetes to authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 · Permisos
-- ════════════════════════════════════════════════════════════

grant select, insert, update, delete on tiquetes_lotes      to authenticated;
grant select, insert, update, delete on movimientos_tiquete to authenticated;

revoke all on function consumo_tiquetes_del_dia(date)     from public, anon;
revoke all on function registrar_consumo_tiquetes(date)   from public, anon;
revoke all on function saldo_tiquetes()                   from public, anon;
revoke all on function alerta_tiquetes(date)              from public, anon;

grant execute on function consumo_tiquetes_del_dia(date)   to authenticated;
grant execute on function registrar_consumo_tiquetes(date) to authenticated;
grant execute on function saldo_tiquetes()                 to authenticated;
grant execute on function alerta_tiquetes(date)            to authenticated;


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

  -- El conteo mira las tres poblaciones. Si algún día alguien lo simplifica a
  -- `embarques` a secas, esto lo dice antes de que el saldo empiece a mentir.
  if position('zarpe_alojamiento' in
       pg_get_functiondef('consumo_tiquetes_del_dia(date)'::regprocedure)) = 0 then
    raise exception 'El consumo dejó de contar a los huéspedes de alojamiento';
  end if;

  raise notice 'Tiquetes listos. El consumo suma alojamiento: no va a cuadrar con la planilla.';
end $$;
