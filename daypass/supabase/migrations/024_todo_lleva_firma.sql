-- ════════════════════════════════════════════════════════════════════════════
-- 024 · Todo lleva firma
--
-- **Decisión del dueño:** «Todo debe quedar registrado de quién lo hizo, por
-- eso existen los perfiles, las cuentas.» Es la regla 24, y se estaba
-- cumpliendo a medias.
--
-- ── Lo que se encontró al contar ────────────────────────────────────────────
--
-- De las 30 tablas, **6 guardaban quién creó la fila y 3 quién la modificó**.
-- Faltaba en las que más importan:
--
--   · `planes` y `temporadas` — las tarifas. Nadie sabía quién cambió un
--     precio, y el precio de mañana sale de ahí.
--   · `registros` — hay `generada_por`, pero **no había `actualizado_por`**:
--     quién tocó una reserva de último era información perdida.
--   · `pasajeros`, `zarpes`, `pilotos`, `empleados`, `lanchas`,
--     `organizaciones`, `documentos_legales`, `guardias`…
--
-- ── Y un matiz peor que la ausencia ─────────────────────────────────────────
--
-- `ajustes` sí tenía `actualizado_por`, pero **lo mandaba el navegador**. Un
-- autor que viaja desde el aparato no es una firma: es un campo más que
-- cualquiera puede escribir con lo que quiera desde la API. Aquí lo sella el
-- servidor con `auth.uid()` y se **ignora** lo que venga del cliente.
--
-- Esa es la parte que hace que esto sirva de algo. Agregar columnas y confiar
-- en que alguien las llene termina en columnas vacías; sellarlas en un trigger
-- hace que no se puedan olvidar ni falsificar.
--
-- ── Dónde el autor es null, y por qué está bien ─────────────────────────────
--
-- El check-in público escribe `pasajeros` y `firmas` sin sesión: ahí
-- `auth.uid()` es null y la firma queda vacía. **Es la verdad**: eso no lo hizo
-- nadie del equipo, lo hizo el cliente desde su enlace. Inventarle un autor
-- sería peor que dejarlo en null.
--
-- ── La bitácora, que solo cubría tres acciones ──────────────────────────────
--
-- Anotaban `unir_personas`, `atender_ticket` y `anular_pago`. Faltaban las que
-- el plan nombra: tarifas, ajustes, cierres del día, cierre de zarpe e
-- inventario de tiquetes. Se agregan.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · El sello
-- ════════════════════════════════════════════════════════════

create or replace function sellar_autoria()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    -- Se ignora lo que venga del cliente a propósito: si el autor se pudiera
    -- mandar, no sería una firma.
    new.creado_por := auth.uid();
    new.actualizado_por := auth.uid();
  else
    new.creado_por := old.creado_por;   -- el pasado no se reescribe
    new.actualizado_por := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

comment on function sellar_autoria() is
  'Pone quién en cada fila, con la sesión del servidor. Va como trigger para '
  'que no se pueda olvidar, y sobreescribe lo que mande el cliente para que no '
  'se pueda falsear. En la puerta pública queda null, que es la verdad: eso lo '
  'escribió el cliente, no el equipo.';


/**
 * `registros` ya tenía autor con otro nombre: `generada_por`. Se reusa en vez
 * de agregar una segunda columna que diga lo mismo — dos columnas para un solo
 * dato es exactamente el desorden que este proyecto viene limpiando.
 */
create or replace function sellar_autoria_registro()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.generada_por := coalesce(auth.uid(), new.generada_por);
    new.actualizado_por := auth.uid();
  else
    new.generada_por := old.generada_por;
    new.actualizado_por := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Las columnas y sus triggers
--
-- Se recorren las tablas y a cada una se le agrega lo que le falte. Quedan
-- fuera, con razón:
--
--   · `bitacora` y `cambios_estado` — son la bitácora; ya llevan quién.
--   · `embarques` — append-only con `registrado_por`, y su UPDATE está
--     bloqueado: un `actualizado_por` ahí nunca se llenaría.
--   · `firmas` — documento legal con su propia identidad (quién firmó, con
--     qué documento y desde qué aparato).
--   · `tickets` — su autor lo sella la 021 con el mismo criterio.
-- ════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tablas text[] := array[
    'paises', 'lanchas', 'canales', 'planes', 'temporadas', 'clientes',
    'pasajeros', 'dias_operativos', 'zarpes', 'opciones_plato', 'tipos_ingreso',
    'pilotos', 'empleados', 'tokens_reserva', 'zarpe_empleados',
    'zarpe_alojamiento', 'documentos_legales', 'ajustes', 'guardias',
    'perfiles', 'personas', 'organizaciones', 'organizacion_correos',
    'vinculos', 'etiquetas', 'persona_etiquetas',
    'tiquetes_lotes', 'movimientos_tiquete', 'pagos'
  ];
begin
  foreach t in array tablas loop
    if to_regclass('public.' || t) is null then
      raise notice 'No existe %, se salta', t;
      continue;
    end if;

    execute format(
      'alter table %I add column if not exists creado_por uuid references auth.users(id)', t);
    execute format(
      'alter table %I add column if not exists actualizado_por uuid references auth.users(id)', t);

    execute format('drop trigger if exists %I_firma on %I', t, t);
    execute format(
      'create trigger %I_firma before insert or update on %I '
      'for each row execute function sellar_autoria()', t, t);
  end loop;
end $$;

-- Y la reserva, con su propia variante.
alter table registros add column if not exists actualizado_por uuid references auth.users(id);

drop trigger if exists registros_firma on registros;
create trigger registros_firma before insert or update on registros
  for each row execute function sellar_autoria_registro();

comment on column registros.generada_por is
  'Quién creó la reserva. Lo sella el servidor desde la 024: antes venía del '
  'navegador o se quedaba vacío.';
comment on column registros.actualizado_por is
  'Quién la tocó de último. No existía: quién cambió una reserva era '
  'información perdida.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · La cortesía dice quién la autorizó
--
-- Es lo que faltaba para el reporte mensual de cortesías, y es de las cosas
-- que más justifican la regla: una cortesía es plata que el hotel regala.
-- «Las cortesías de la directora no piden aprobación» (regla 20) — pero que no
-- pidan aprobación no significa que no quede escrito quién la dio.
-- ════════════════════════════════════════════════════════════

alter table registros
  add column if not exists cortesia_autorizada_por uuid references auth.users(id),
  add column if not exists cortesia_motivo text;

comment on column registros.cortesia_autorizada_por is
  'Quién autorizó la cortesía. Se llena solo con quien crea la reserva cuando '
  'el tipo de ingreso es cortesía: no se pregunta, se deduce (regla 23), y '
  'queda editable si la autorizó alguien más.';

create or replace function sellar_cortesia()
returns trigger as $$
declare codigo text;
begin
  select ti.codigo into codigo from tipos_ingreso ti where ti.id = new.tipo_ingreso_id;

  if codigo = 'cortesia' then
    new.cortesia_autorizada_por := coalesce(new.cortesia_autorizada_por, auth.uid());
  else
    -- Deja de ser cortesía: el autorizante deja de tener sentido.
    new.cortesia_autorizada_por := null;
    new.cortesia_motivo := null;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists registros_cortesia on registros;
create trigger registros_cortesia before insert or update of tipo_ingreso_id on registros
  for each row execute function sellar_cortesia();


-- ── El reporte mensual de cortesías ──
-- Con quién autorizó y cuánto costó el servicio, que es lo que el plan pide.
create or replace view cortesias_del_mes as
select
  date_trunc('month', r.fecha)::date as mes,
  r.id as registro_id,
  r.fecha,
  r.nombre_pasajero,
  r.nombre_grupo,
  coalesce(p.nombre, 'sin registrar')          as autorizada_por,
  r.cortesia_motivo,
  r.adultos + r.ninos + r.infantes + r.cortesias as personas,
  -- Lo que habría costado: la tarifa congelada de esa reserva. No es lo que se
  -- cobró —una cortesía no se cobra— es lo que el hotel dejó de recibir.
  (r.adultos * r.precio_adulto) + (r.ninos * r.precio_nino) as costo_servicio
from registros r
join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
left join perfiles p on p.user_id = r.cortesia_autorizada_por
where puedo_ver_dinero()
  and ti.codigo = 'cortesia'
  and r.estado not in ('cancelada', 'noshow');

comment on view cortesias_del_mes is
  'Qué se regaló, a quién y quién lo autorizó. El costo es la tarifa congelada '
  'de esa reserva: no es lo que se cobró —una cortesía no se cobra— sino lo '
  'que el hotel dejó de recibir.';

revoke all on cortesias_del_mes from public, anon;
grant select on cortesias_del_mes to authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · La bitácora cubre lo que el plan nombra
--
-- Anotaban tres acciones. Faltaban las tarifas, los ajustes, los cierres y el
-- inventario. Se anotan con triggers para que no dependan de que alguien se
-- acuerde de llamar a `anotar()`.
-- ════════════════════════════════════════════════════════════

create or replace function anotar_cambio_de_tarifa()
returns trigger as $$
begin
  -- Solo si de verdad cambió un precio: anotar cada vez que alguien renombra
  -- un plan llenaría la bitácora de ruido.
  if tg_op = 'UPDATE' and (
       old.precio_adulto_baja is distinct from new.precio_adulto_baja
    or old.precio_adulto_alta is distinct from new.precio_adulto_alta
    or old.precio_nino_baja   is distinct from new.precio_nino_baja
    or old.precio_nino_alta   is distinct from new.precio_nino_alta
  ) then
    perform anotar('cambiar_tarifa', 'planes', new.id::text, null,
      jsonb_build_object(
        'plan', new.nombre,
        'antes', jsonb_build_object(
          'adulto_baja', old.precio_adulto_baja, 'adulto_alta', old.precio_adulto_alta,
          'nino_baja', old.precio_nino_baja, 'nino_alta', old.precio_nino_alta),
        'ahora', jsonb_build_object(
          'adulto_baja', new.precio_adulto_baja, 'adulto_alta', new.precio_adulto_alta,
          'nino_baja', new.precio_nino_baja, 'nino_alta', new.precio_nino_alta)));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists planes_anotan_tarifa on planes;
create trigger planes_anotan_tarifa after update on planes
  for each row execute function anotar_cambio_de_tarifa();


create or replace function anotar_cambio_de_ajuste()
returns trigger as $$
begin
  if tg_op = 'UPDATE' and old.valor is distinct from new.valor then
    perform anotar('cambiar_ajuste', 'ajustes', new.clave, null,
      jsonb_build_object('clave', new.clave, 'antes', old.valor, 'ahora', new.valor));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists ajustes_anotan on ajustes;
create trigger ajustes_anotan after update on ajustes
  for each row execute function anotar_cambio_de_ajuste();


create or replace function anotar_cierre_de_dia()
returns trigger as $$
begin
  if tg_op = 'UPDATE' and old.estado is distinct from new.estado
     and new.estado in ('tentativo_cerrado', 'cerrado') then
    perform anotar(
      case when new.estado = 'cerrado' then 'cerrar_dia' else 'cerrar_tentativo' end,
      'dias_operativos', new.fecha::text, new.fecha,
      jsonb_build_object('antes', old.estado, 'ahora', new.estado));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists dias_anotan_cierre on dias_operativos;
create trigger dias_anotan_cierre after update on dias_operativos
  for each row execute function anotar_cierre_de_dia();


create or replace function anotar_cierre_de_zarpe()
returns trigger as $$
begin
  if tg_op = 'UPDATE' and old.estado is distinct from new.estado
     and new.estado in ('zarpado', 'regresado', 'cancelado') then
    perform anotar('cerrar_zarpe', 'zarpes', new.id::text, new.fecha,
      jsonb_build_object('sentido', new.sentido, 'estado', new.estado));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists zarpes_anotan_cierre on zarpes;
create trigger zarpes_anotan_cierre after update on zarpes
  for each row execute function anotar_cierre_de_zarpe();


create or replace function anotar_ajuste_de_inventario()
returns trigger as $$
begin
  -- El consumo diario NO se anota: lo calcula el sistema y se recalcula solo.
  -- Lo que importa es lo que alguien decidió a mano.
  if new.clase in ('saldo_inicial', 'compra', 'ajuste') then
    perform anotar('mover_tiquetes', 'movimientos_tiquete', new.id::text, new.fecha,
      jsonb_build_object('tipo', new.tipo, 'clase', new.clase,
                         'cantidad', new.cantidad, 'motivo', new.motivo));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists movimientos_anotan on movimientos_tiquete;
create trigger movimientos_anotan after insert on movimientos_tiquete
  for each row execute function anotar_ajuste_de_inventario();


-- ── Y la bitácora se puede leer entera ──
-- Estaba limitada a `puedo_administrar()`. La coordinadora del pasadía cierra
-- días y mueve inventario: no poder ver su propio rastro es un candado sin
-- puerta.
drop policy if exists bitacora_lectura on bitacora;
create policy bitacora_lectura on bitacora for select to authenticated
  using (puedo_administrar() or tiene_rol('asesora'));


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 · Permisos
-- ════════════════════════════════════════════════════════════

-- Las de trigger no se le abren a nadie: las llama el sistema.
revoke all on function sellar_autoria()           from public, anon, authenticated;
revoke all on function sellar_autoria_registro()  from public, anon, authenticated;
revoke all on function sellar_cortesia()          from public, anon, authenticated;
revoke all on function anotar_cambio_de_tarifa()  from public, anon, authenticated;
revoke all on function anotar_cambio_de_ajuste()  from public, anon, authenticated;
revoke all on function anotar_cierre_de_dia()     from public, anon, authenticated;
revoke all on function anotar_cierre_de_zarpe()   from public, anon, authenticated;
revoke all on function anotar_ajuste_de_inventario() from public, anon, authenticated;


-- ── Comprobaciones ──
do $$
declare
  cuantas integer;
  faltan text;
begin
  -- 1. La puerta pública no se movió.
  select count(*) into cuantas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5', cuantas;
  end if;

  -- 2. Ninguna tabla de negocio sin firma. Las excluidas llevan la suya.
  select count(*), string_agg(c.relname, ', ' order by c.relname)
    into cuantas, faltan
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'r'
     and c.relname not in ('bitacora', 'cambios_estado', 'embarques', 'firmas', 'tickets')
     and not exists (
       select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'actualizado_por' and not a.attisdropped)
     and not exists (
       select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'registrado_por' and not a.attisdropped);
  if cuantas > 0 then
    raise exception '% tabla(s) sin quién: %', cuantas, faltan;
  end if;

  -- 3. Y el sello está puesto donde tiene que estar.
  select count(*) into cuantas
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where c.relnamespace = 'public'::regnamespace
     and not t.tgisinternal
     and t.tgname like '%_firma';
  if cuantas < 25 then
    raise exception 'Solo % tablas tienen el sello puesto', cuantas;
  end if;

  raise notice 'Todo lleva firma: % tablas selladas por el servidor.', cuantas;
end $$;
