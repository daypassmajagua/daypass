-- ════════════════════════════════════════════════════════════════════════════
-- 015 · Fase 2 · Roles, guardias y bitácora
--
-- Hasta hoy toda política de RLS es la misma:
--
--     create policy "authenticated_full_access" on X for all
--       using (auth.role() = 'authenticated')
--
-- Es decir: cualquiera con sesión lee y escribe todo, incluidos precios,
-- folios y totales de cada reserva. Por eso `/isla` y `/cocina` —construidas
-- para el mesero y para la isla— no se les pueden dar todavía: sería
-- entregarles el negocio entero.
--
-- ── Lo que NO se puede hacer, y por qué esta migración se ve distinta ───────
--
-- El plan pedía excluir el dinero **a nivel de columna**. No se puede: en
-- PostgreSQL los permisos por columna son GRANT/REVOKE y van **por rol de base
-- de datos**, pero en Supabase todos los que inician sesión son el mismo rol,
-- `authenticated`. Revocar `precio_adulto` se lo quitaría también a Daniela. Y
-- la RLS es solo por FILAS: no sabe enmascarar una columna.
--
-- La solución que sí cumple en el servidor: **una vista que enmascara**. La
-- app deja de leer `registros` y lee `reservas`, que devuelve los precios en
-- null a quien no debe verlos. No es esconder en el front: quien consulte la
-- vista por PostgREST con su propia sesión recibe null igual.
--
-- ── El riesgo de esta migración, dicho de frente ────────────────────────────
--
-- En cuanto exista `perfiles`, un usuario sin perfil deja de ver nada. Si no
-- se sembraran las cuentas que ya existen, este archivo dejaría a TODO EL
-- MUNDO por fuera, Daniela incluida. Por eso el bloque 2 las siembra como
-- `directora` —el rol que administra usuarios— y desde la app se corrigen.
-- Es deliberado: preferible que alguien tenga de más un día a que nadie pueda
-- entrar el lunes.
--
-- Idempotente. lock_timeout por el worker de Realtime, que sostiene
-- AccessShareLock sobre registros, pasajeros, zarpes, embarques y
-- dias_operativos.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Quién es quién
-- ════════════════════════════════════════════════════════════

do $$ begin
  create type rol_usuario as enum (
    'super_admin',        -- AISA, el proveedor que mantiene el sistema
    'gerencia',
    'directora',
    'asesora',            -- Daniela, líder del pasadía
    'asesora_comercial',
    'admin_isla',
    'recepcion',
    'mesero'
  );
exception when duplicate_object then null; end $$;

create table if not exists perfiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        rol_usuario not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references auth.users(id)
);

comment on table perfiles is
  'Una fila por persona, con su nombre real. Sin cuentas compartidas '
  '(regla 24). El nombre vive aquí y NO en user_metadata: en Supabase el '
  'usuario puede editar su propio metadata, así que un nombre guardado ahí se '
  'puede falsificar — y con él, la firma de un cierre en la bitácora.';

drop trigger if exists perfiles_updated_at on perfiles;
create trigger perfiles_updated_at before update on perfiles
  for each row execute function set_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Sembrar a quien ya existe, para no bloquear a nadie
--
-- Se corre ANTES de las políticas a propósito: si algo fallara después, las
-- cuentas ya tienen perfil y nadie se queda afuera.
-- ════════════════════════════════════════════════════════════

insert into perfiles (user_id, nombre, rol)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'nombre', ''),
    split_part(u.email, '@', 1)
  ),
  'directora'::rol_usuario
from auth.users u
on conflict (user_id) do nothing;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Preguntar por el rol, barato y en un solo sitio
--
-- SECURITY DEFINER y STABLE: las políticas de RLS las llaman una vez por
-- consulta, y sin DEFINER cada llamada volvería a pasar por la RLS de
-- `perfiles` — recursión infinita.
-- ════════════════════════════════════════════════════════════

create or replace function mi_rol()
returns rol_usuario as $$
  select p.rol from perfiles p
   where p.user_id = auth.uid() and p.activo;
$$ language sql stable security definer set search_path = public;

create or replace function tiene_rol(variadic roles rol_usuario[])
returns boolean as $$
  select mi_rol() = any(roles);
$$ language sql stable security definer set search_path = public;

/** ¿Tengo sesión y perfil activo? Es la puerta de todo lo demás. */
create or replace function soy_del_equipo()
returns boolean as $$
  select mi_rol() is not null;
$$ language sql stable security definer set search_path = public;

/**
 * Quién puede ver plata.
 *
 * La isla, recepción y el mesero no. No es solo permisos: en el muelle y en la
 * isla la pantalla la ven el pasajero, el guía y la fila entera.
 */
create or replace function puedo_ver_dinero()
returns boolean as $$
  select tiene_rol('super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial');
$$ language sql stable security definer set search_path = public;

/** Quien administra catálogos, usuarios y tarifas. */
create or replace function puedo_administrar()
returns boolean as $$
  select tiene_rol('super_admin', 'gerencia', 'directora');
$$ language sql stable security definer set search_path = public;

-- El nombre de la bitácora deja de salir del JWT.
create or replace function nombre_de_quien_actua()
returns text as $$
  select coalesce(
    (select p.nombre from perfiles p where p.user_id = auth.uid()),
    nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''),
    'alguien'
  );
$$ language sql stable security definer set search_path = public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Las guardias
--
-- Al muelle no va siempre Daniela: puede ir cualquier asesora comercial o la
-- coordinadora de alojamiento, y puede ser una quien embarca en la mañana y
-- otra quien recibe en la tarde.
--
-- La guardia **habilita** acciones ese día; el rol base no cambia. Por eso no
-- es una columna en `perfiles` sino una fila por día.
-- ════════════════════════════════════════════════════════════

do $$ begin
  create type tipo_guardia as enum ('isla', 'embarque', 'recibimiento');
exception when duplicate_object then null; end $$;

create table if not exists guardias (
  fecha       date not null,
  tipo        tipo_guardia not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  asignada_por uuid references auth.users(id),
  asignada_at timestamptz not null default now(),
  primary key (fecha, tipo)
);

comment on table guardias is
  'Quién cubre cada turno cada día. La guardia de isla la asigna la directora '
  'o gerencia; embarque y recibimiento los coordina la asesora líder, pero las '
  'asesoras pueden tomarlos o cederlos entre ellas.';

create index if not exists guardias_persona_idx on guardias (user_id, fecha);

/** ¿Estoy de turno hoy en esto? */
create or replace function tengo_guardia(p_tipo tipo_guardia, p_fecha date default null)
returns boolean as $$
  select exists (
    select 1 from guardias g
     where g.tipo = p_tipo
       and g.fecha = coalesce(p_fecha, hoy_bogota())
       and g.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

/**
 * Quién puede operar la isla: el rol fijo, o quien esté de guardia hoy.
 * Se pregunta tanto que merece nombre propio.
 */
create or replace function puedo_operar_isla()
returns boolean as $$
  select tiene_rol('super_admin', 'gerencia', 'directora', 'asesora', 'admin_isla')
      or tengo_guardia('isla');
$$ language sql stable security definer set search_path = public;

/** Quién puede operar el muelle: embarcar por la mañana, recibir por la tarde. */
create or replace function puedo_operar_muelle()
returns boolean as $$
  select tiene_rol('super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial')
      or tengo_guardia('embarque')
      or tengo_guardia('recibimiento');
$$ language sql stable security definer set search_path = public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 · La bitácora
--
-- `cambios_estado` (003) se queda como está: tiene forma propia
-- —estado_anterior / estado_nuevo— y sirve para lo suyo. Esta es la general,
-- para lo que no es un cambio de estado: cierres, tarifas, cortesías, envío de
-- manifiesto, ajustes de inventario, anulaciones.
--
-- Append-only de verdad: un trigger impide UPDATE y DELETE, incluido para el
-- super_admin. Una bitácora que se puede editar no es una bitácora.
-- ════════════════════════════════════════════════════════════

create table if not exists bitacora (
  id          bigserial primary key,
  ocurrido_at timestamptz not null default now(),
  user_id     uuid references auth.users(id),
  nombre      text not null,          -- congelado: si la persona cambia de nombre, esto no
  rol         rol_usuario,            -- con qué rol lo hizo
  accion      text not null,          -- 'cerrar_dia', 'cambiar_tarifa', 'anular_reserva'…
  entidad     text,                   -- la tabla que tocó
  entidad_id  text,                   -- su id, como texto: no todas son uuid
  fecha_op    date,                   -- a qué día operativo afecta, si aplica
  detalle     jsonb                   -- lo que haga falta, sin inventar columnas
);

create index if not exists bitacora_cuando_idx on bitacora (ocurrido_at desc);
create index if not exists bitacora_accion_idx on bitacora (accion, ocurrido_at desc);
create index if not exists bitacora_dia_idx on bitacora (fecha_op) where fecha_op is not null;

create or replace function bitacora_es_inmutable()
returns trigger as $$
begin
  raise exception 'La bitácora no se edita ni se borra' using errcode = 'check_violation';
end;
$$ language plpgsql;

drop trigger if exists bitacora_sin_update on bitacora;
create trigger bitacora_sin_update before update or delete on bitacora
  for each row execute function bitacora_es_inmutable();

/** Anotar algo en la bitácora. La llaman las funciones, no las pantallas. */
create or replace function anotar(
  p_accion text,
  p_entidad text default null,
  p_entidad_id text default null,
  p_fecha_op date default null,
  p_detalle jsonb default null
)
returns void as $$
  insert into bitacora (user_id, nombre, rol, accion, entidad, entidad_id, fecha_op, detalle)
  values (auth.uid(), nombre_de_quien_actua(), mi_rol(),
          p_accion, p_entidad, p_entidad_id, p_fecha_op, p_detalle);
$$ language sql security definer set search_path = public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 · La vista que enmascara el dinero
--
-- La app deja de leer `registros` y lee `reservas`. Para quien no puede ver
-- plata, los precios llegan en null — decidido en el servidor, no en el
-- navegador.
--
-- `security_invoker` para que la RLS de `registros` siga aplicando por filas:
-- sin eso la vista correría como su dueño y se saltaría las políticas.
-- ════════════════════════════════════════════════════════════

create or replace view reservas
with (security_invoker = true) as
select
  r.id, r.fecha, r.tipo, r.estado,
  r.nombre_pasajero, r.identificacion, r.nombre_grupo,
  r.cliente_id, r.lancha_id, r.pais_id, r.plan_id, r.canal_id,
  r.agencia_id, r.agencia_nombre,
  r.temporada,
  r.adultos, r.ninos, r.infantes, r.cortesias,
  r.impuestos_puerto, r.voucher_os, r.folio_zeus, r.observaciones,
  r.generada_por, r.vendida_por, r.vendida_por_id,
  r.telefono, r.email,
  r.tipo_ingreso_id, r.cobra_cupo,
  r.check_in_at, r.check_in_desde,
  r.cambio_tardio, r.cambio_tardio_at, r.cambio_tardio_por, r.cambio_tardio_motivo,
  r.created_at, r.updated_at,

  -- La forma de pago no es un precio: dice cómo se paga, no cuánto. La isla la
  -- necesita para saber si a alguien se le carga el almuerzo o es cortesía del
  -- hotel, así que la ve todo el equipo.
  r.forma_pago,

  -- Esto sí es plata.
  case when puedo_ver_dinero() then r.precio_adulto  end as precio_adulto,
  case when puedo_ver_dinero() then r.precio_nino    end as precio_nino,
  case when puedo_ver_dinero() then r.precio_lancha  end as precio_lancha,
  case when puedo_ver_dinero() then r.total_calculado end as total_calculado,
  case when puedo_ver_dinero() then r.valor_cupo     end as valor_cupo
from registros r;

comment on view reservas is
  'Lo mismo que registros, con los precios en null para quien no puede verlos. '
  'La app lee esto; escribe contra registros. No es esconder en el front: '
  'quien consulte por PostgREST con su propia sesión recibe null igual.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 · Quién vendió, como catálogo y no como texto
--
-- `vendida_por` es text y guarda 'Camila Pedraza', 'Dirección'… Una persona es
-- un catálogo finito: la regla 2 no admite texto libre ahí. Se agrega la
-- referencia y se conserva el texto viejo, porque el pasado no se reescribe
-- (regla 4) y no hay forma fiable de casar nombres con cuentas.
-- ════════════════════════════════════════════════════════════

alter table registros
  add column if not exists vendida_por_id uuid references perfiles(user_id);

comment on column registros.vendida_por is
  'Histórico, texto libre. Las reservas nuevas usan vendida_por_id.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8 · Las políticas
--
-- Se reemplaza el `authenticated_full_access` de las 23 tablas. Tres formas,
-- según lo que sea cada tabla:
--
--   CATÁLOGO      lo lee todo el equipo; lo edita quien administra
--   OPERACIÓN     lo lee todo el equipo; lo escribe quien opera
--   SENSIBLE      solo quien tiene por qué
-- ════════════════════════════════════════════════════════════

-- ── Perfiles y guardias ──
alter table perfiles enable row level security;
alter table guardias enable row level security;
alter table bitacora enable row level security;

drop policy if exists perfiles_lectura on perfiles;
create policy perfiles_lectura on perfiles for select to authenticated
  using (soy_del_equipo());   -- saber quién es quién no es secreto dentro del equipo

drop policy if exists perfiles_escritura on perfiles;
create policy perfiles_escritura on perfiles for all to authenticated
  using (puedo_administrar()) with check (puedo_administrar());

drop policy if exists guardias_lectura on guardias;
create policy guardias_lectura on guardias for select to authenticated
  using (soy_del_equipo());

-- La de isla la asigna la directora o gerencia. Embarque y recibimiento los
-- coordina la asesora, pero las asesoras pueden tomarlos y cederlos.
drop policy if exists guardias_escritura on guardias;
create policy guardias_escritura on guardias for all to authenticated
  using (
    puedo_administrar()
    or (tipo <> 'isla' and tiene_rol('asesora', 'asesora_comercial'))
  )
  with check (
    puedo_administrar()
    or (tipo <> 'isla' and tiene_rol('asesora', 'asesora_comercial'))
  );

-- La bitácora se lee, no se escribe a mano: la llenan las funciones.
drop policy if exists bitacora_lectura on bitacora;
create policy bitacora_lectura on bitacora for select to authenticated
  using (puedo_administrar());

-- ── Catálogos: los lee el equipo, los edita quien administra ──
do $$
declare t text;
begin
  foreach t in array array[
    'planes', 'lanchas', 'canales', 'agencias', 'temporadas', 'paises',
    'opciones_plato', 'tipos_ingreso', 'pilotos', 'empleados',
    'documentos_legales', 'ajustes'
  ] loop
    execute format('drop policy if exists "authenticated_full_access" on %I', t);
    execute format('drop policy if exists %I_lectura on %I', t, t);
    execute format('drop policy if exists %I_escritura on %I', t, t);
    execute format(
      'create policy %I_lectura on %I for select to authenticated using (soy_del_equipo())', t, t);
    execute format(
      'create policy %I_escritura on %I for all to authenticated '
      'using (puedo_administrar()) with check (puedo_administrar())', t, t);
  end loop;
end $$;

-- Los ajustes tenían sus propias políticas de la 009: fuera, ya están arriba.
drop policy if exists ajustes_lectura on ajustes;
drop policy if exists ajustes_escritura on ajustes;
create policy ajustes_lectura on ajustes for select to authenticated
  using (soy_del_equipo());
create policy ajustes_escritura on ajustes for all to authenticated
  using (puedo_administrar()) with check (puedo_administrar());

-- ── La operación del día ──
-- Lo lee todo el equipo: el mesero necesita ver a quién tiene en la mesa, y la
-- vista `reservas` ya le quita los precios.
drop policy if exists "authenticated_full_access" on registros;
drop policy if exists registros_lectura on registros;
create policy registros_lectura on registros for select to authenticated
  using (soy_del_equipo());

-- Vender es de quien vende. La isla, recepción y el mesero no crean reservas.
drop policy if exists registros_alta on registros;
create policy registros_alta on registros for insert to authenticated
  with check (tiene_rol('super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial'));

drop policy if exists registros_cambio on registros;
create policy registros_cambio on registros for update to authenticated
  using (
    tiene_rol('super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial')
    -- La isla y el muelle sí mueven estados: quien embarca marca el no-show y
    -- quien recibe cierra. Eso pasa por funciones, pero la política tiene que
    -- dejarlo.
    or puedo_operar_muelle()
    or puedo_operar_isla()
  )
  with check (true);

-- Borrar una reserva no lo hace la operación: se cancela, que deja rastro.
drop policy if exists registros_baja on registros;
create policy registros_baja on registros for delete to authenticated
  using (puedo_administrar() or tiene_rol('asesora'));

-- Pasajeros, zarpes y lo del muelle: los escribe quien opera.
do $$
declare t text;
begin
  foreach t in array array[
    'pasajeros', 'zarpes', 'zarpe_empleados', 'zarpe_alojamiento',
    'dias_operativos', 'clientes', 'tokens_reserva'
  ] loop
    execute format('drop policy if exists "authenticated_full_access" on %I', t);
    execute format('drop policy if exists %I_lectura on %I', t, t);
    execute format('drop policy if exists %I_escritura on %I', t, t);
    execute format(
      'create policy %I_lectura on %I for select to authenticated using (soy_del_equipo())', t, t);
    execute format(
      'create policy %I_escritura on %I for all to authenticated '
      'using (soy_del_equipo() and not tiene_rol(''mesero'', ''recepcion'')) '
      'with check (soy_del_equipo() and not tiene_rol(''mesero'', ''recepcion''))', t, t);
  end loop;
end $$;

-- ── Lo append-only se queda append-only ──
-- embarques y firmas ya tenían su par lectura/inserción de la 006 y la 008; se
-- rehacen con el equipo en vez de con "cualquiera autenticado".
drop policy if exists "authenticated_read" on embarques;
drop policy if exists "authenticated_insert" on embarques;
drop policy if exists embarques_lectura on embarques;
drop policy if exists embarques_alta on embarques;
create policy embarques_lectura on embarques for select to authenticated
  using (soy_del_equipo());
create policy embarques_alta on embarques for insert to authenticated
  with check (puedo_operar_muelle() or puedo_operar_isla());

drop policy if exists "authenticated_full_access" on cambios_estado;
drop policy if exists cambios_estado_lectura on cambios_estado;
create policy cambios_estado_lectura on cambios_estado for select to authenticated
  using (soy_del_equipo());

-- ── Firmas: son un documento legal ──
-- Las escribe el cliente por la puerta pública (SECURITY DEFINER, que se salta
-- la RLS); desde adentro solo se leen.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where tablename = 'firmas' loop
    execute format('drop policy if exists %I on firmas', p.policyname);
  end loop;
end $$;
create policy firmas_lectura on firmas for select to authenticated
  using (puedo_administrar() or tiene_rol('asesora'));


-- ════════════════════════════════════════════════════════════
-- BLOQUE 9 · Permisos de las funciones
--
-- Las nuevas nacen cerradas por el default privileges de la 012. Se abre lo
-- que la app llama, y se comprueba que anon siga con exactamente cinco.
-- ════════════════════════════════════════════════════════════

grant select on reservas to authenticated;

grant execute on function mi_rol()                              to authenticated;
grant execute on function tiene_rol(rol_usuario[])              to authenticated;
grant execute on function soy_del_equipo()                      to authenticated;
grant execute on function puedo_ver_dinero()                    to authenticated;
grant execute on function puedo_administrar()                   to authenticated;
grant execute on function tengo_guardia(tipo_guardia, date)     to authenticated;
grant execute on function puedo_operar_isla()                   to authenticated;
grant execute on function puedo_operar_muelle()                 to authenticated;
grant execute on function anotar(text, text, text, date, jsonb) to authenticated;

-- nombre_de_quien_actua se redefinió: create or replace restablece permisos.
revoke all on function nombre_de_quien_actua() from public, anon;
grant execute on function nombre_de_quien_actua() to authenticated;

revoke all on function mi_rol()                          from public, anon;
revoke all on function tiene_rol(rol_usuario[])          from public, anon;
revoke all on function soy_del_equipo()                  from public, anon;
revoke all on function puedo_ver_dinero()                from public, anon;
revoke all on function puedo_administrar()               from public, anon;
revoke all on function tengo_guardia(tipo_guardia, date) from public, anon;
revoke all on function puedo_operar_isla()               from public, anon;
revoke all on function puedo_operar_muelle()             from public, anon;
revoke all on function anotar(text, text, text, date, jsonb) from public, anon;


-- ── Comprobaciones ──
do $$
declare
  cuantas integer;
  abiertas text;
  sin_perfil integer;
begin
  -- 1. La puerta pública sigue siendo de cinco.
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into cuantas, abiertas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5: %', cuantas, abiertas;
  end if;

  -- 2. Nadie se queda por fuera. Esto es lo que impide el bloqueo total.
  select count(*) into sin_perfil
    from auth.users u
   where not exists (select 1 from perfiles p where p.user_id = u.id);
  if sin_perfil > 0 then
    raise exception '% cuentas quedaron sin perfil: entrarían y no verían nada', sin_perfil;
  end if;

  raise notice 'Roles listos. % perfiles sembrados.', (select count(*) from perfiles);
end $$;
