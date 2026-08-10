-- ════════════════════════════════════════════════════════════════════════════
-- 025 · La ficha del cliente
--
-- **Decisión del dueño:** el sistema debe tener el registro de los clientes,
-- en formato CRM.
--
-- El modelo existe desde la 020 —`personas`, `organizaciones`, `vinculos`,
-- `etiquetas`— pero al ir a usarlo aparecieron dos huecos que lo dejaban como
-- un cascarón. Los dos son míos y conviene decirlos:
--
--   1. **`registros.persona_id` no lo llenaba nadie.** La 020 agregó la
--      columna y el trigger de enlace, pero el trigger va sobre `pasajeros`.
--      El titular de la reserva —quien contrata, quien firma, a quien se le
--      escribe— nunca quedaba enlazado a su persona.
--
--   2. **`personas.telefono` y `personas.email` estaban siempre vacíos.** El
--      teléfono y el correo se piden en la reserva y se guardan en
--      `registros`; nadie los subía a la ficha. Un CRM sin cómo contactar a la
--      gente no es un CRM.
--
-- Sin eso, la ficha de un cliente que vino cuatro veces mostraba cero visitas y
-- ningún dato de contacto.
--
-- ── Lo que este archivo agrega ──────────────────────────────────────────────
--
-- El enlace del titular, el contacto que sube desde la reserva, y la ficha:
-- cuántas veces vino, cuándo fue la última, cuánto ha dejado, con qué plan
-- suele venir y con quién viaja.
--
-- ── Las etiquetas calculadas no se guardan todavía ──────────────────────────
--
-- `persona_etiquetas` distingue `calculada` de `asignada` desde la 020. Las
-- calculadas se derivan aquí **al vuelo** en vez de materializarse: mantener
-- una tabla al día necesita quien la recalcule, y eso llega con los segmentos
-- de marketing. Guardarlas hoy sería tener etiquetas que envejecen sin que
-- nadie se entere, que es peor que no tenerlas.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · El enlace ahora también sube el contacto
--
-- Se completa lo que falte y **no se pisa lo que ya había**: alguien pudo
-- haber corregido un teléfono a mano, y el de la reserva de hoy no es más
-- cierto que ese.
-- ════════════════════════════════════════════════════════════

create or replace function enlazar_persona(
  p_nombre text,
  p_tipo_documento tipo_documento,
  p_documento text,
  p_pais_id uuid,
  p_telefono text default null,
  p_email text default null
)
returns uuid as $$
declare
  norm text;
  pid uuid;
begin
  norm := nullif(upper(regexp_replace(coalesce(p_documento, ''), '[^A-Za-z0-9]', '', 'g')), '');
  if norm is null or coalesce(trim(p_nombre), '') = '' then
    return null;
  end if;

  insert into personas (
    nombre_completo, tipo_documento, documento, pais_id, telefono, email, creado_por
  )
  values (
    trim(p_nombre), p_tipo_documento, trim(p_documento), p_pais_id,
    nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    auth.uid()
  )
  on conflict (documento_norm) where documento_norm is not null
  do update set
    tipo_documento  = coalesce(personas.tipo_documento, excluded.tipo_documento),
    pais_id         = coalesce(personas.pais_id, excluded.pais_id),
    telefono        = coalesce(personas.telefono, excluded.telefono),
    email           = coalesce(personas.email, excluded.email),
    actualizado_por = auth.uid()
  returning id into pid;

  return pid;
end;
$$ language plpgsql security definer set search_path = public;


-- El trigger de pasajeros sigue igual, con la firma nueva.
create or replace function pasajero_enlaza_persona()
returns trigger as $$
begin
  if nullif(trim(coalesce(new.documento, '')), '') is null then
    return new;
  end if;

  new.persona_id := coalesce(
    enlazar_persona(new.nombre, new.tipo_documento, new.documento, new.pais_id),
    new.persona_id
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;


/**
 * El titular de la reserva, que era el que faltaba.
 *
 * Sale de `identificacion` y `nombre_pasajero`, y de paso sube el teléfono y
 * el correo a la ficha — que es lo único que hace que después se le pueda
 * escribir.
 */
create or replace function registro_enlaza_titular()
returns trigger as $$
begin
  if nullif(trim(coalesce(new.identificacion, '')), '') is null then
    return new;
  end if;

  new.persona_id := coalesce(
    enlazar_persona(
      new.nombre_pasajero,
      'cc'::tipo_documento,   -- lo corriente; la ficha se corrige a mano si no
      new.identificacion,
      new.pais_id,
      new.telefono,
      new.email
    ),
    new.persona_id
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists registros_enlazan_titular on registros;
create trigger registros_enlazan_titular
  before insert or update of identificacion, nombre_pasajero, telefono, email, pais_id
  on registros
  for each row execute function registro_enlaza_titular();


-- ── Enlazar lo que ya existe ──
-- Las reservas de antes de esta migración también tienen titular. Se enlazan
-- una vez, sin tocar las que no traen documento.
do $$
declare
  r record;
  enlazadas integer := 0;
begin
  for r in
    select id, nombre_pasajero, identificacion, pais_id, telefono, email
      from registros
     where persona_id is null
       and nullif(trim(coalesce(identificacion, '')), '') is not null
       and nullif(trim(coalesce(nombre_pasajero, '')), '') is not null
  loop
    update registros
       set persona_id = enlazar_persona(
             r.nombre_pasajero, 'cc'::tipo_documento, r.identificacion,
             r.pais_id, r.telefono, r.email)
     where id = r.id;
    enlazadas := enlazadas + 1;
  end loop;
  raise notice '% reservas quedaron enlazadas a su titular.', enlazadas;
end $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · La ficha
--
-- Lo que uno quiere saber antes de contestarle el teléfono a alguien: si ya
-- vino, cuándo fue la última vez, y con qué suele venir.
-- ════════════════════════════════════════════════════════════

create or replace function ficha_persona(p_persona_id uuid)
returns jsonb as $$
declare
  p personas;
  visitas jsonb;
  n integer;
  gastado numeric;
  primera date;
  ultima date;
  plan_usual text;
  etiquetas text[] := '{}';
begin
  if not soy_del_equipo() then
    raise exception 'Hay que ser del equipo' using errcode = '42501';
  end if;

  select * into p from personas where id = p_persona_id;
  if p is null then
    raise exception 'No existe esa persona' using errcode = 'no_data_found';
  end if;

  -- Una visita es un día en que esa persona estuvo, sea como titular o como
  -- pasajero de la reserva de otro. Contar solo las reservas a su nombre
  -- dejaría por fuera a quien siempre viene con la familia.
  with dias as (
    select distinct r.fecha, r.id as registro_id
      from registros r
     where r.estado not in ('cancelada', 'noshow')
       and (r.persona_id = p_persona_id
         or exists (select 1 from pasajeros pa
                     where pa.registro_id = r.id and pa.persona_id = p_persona_id))
  )
  select
    count(*)::integer,
    min(d.fecha),
    max(d.fecha),
    coalesce(jsonb_agg(jsonb_build_object(
      'fecha', d.fecha,
      'registro_id', d.registro_id,
      'plan', (select pl.nombre from registros r2
                join planes pl on pl.id = r2.plan_id where r2.id = d.registro_id),
      'titular', (select r2.persona_id = p_persona_id from registros r2 where r2.id = d.registro_id)
    ) order by d.fecha desc), '[]'::jsonb)
    into n, primera, ultima, visitas
    from dias d;

  -- Lo que ha dejado: solo lo de las reservas que fueron suyas. Lo que pagó
  -- el titular de un grupo no es plata de ella.
  select coalesce(sum(valor_a_cobrar(r.id)), 0)
    into gastado
    from registros r
   where r.persona_id = p_persona_id
     and r.estado not in ('cancelada', 'noshow');

  select pl.nombre into plan_usual
    from registros r
    join planes pl on pl.id = r.plan_id
   where r.persona_id = p_persona_id
   group by pl.nombre
   order by count(*) desc
   limit 1;

  -- Etiquetas calculadas, al vuelo. Se derivan cada vez en vez de guardarse:
  -- una etiqueta guardada envejece sin que nadie se entere.
  if n >= 3 then etiquetas := etiquetas || 'viene seguido'; end if;
  if ultima is not null and ultima < hoy_bogota() - 365 then
    etiquetas := etiquetas || 'no vuelve hace más de un año';
  end if;
  if exists (
    select 1 from pasajeros pa
      join registros r on r.id = pa.registro_id
     where r.persona_id = p_persona_id and pa.categoria in ('nino', 'infante')
  ) then etiquetas := etiquetas || 'viaja con niños'; end if;
  if p.pais_id is not null and not exists (
    select 1 from paises pais where pais.id = p.pais_id and pais.codigo = 'CO'
  ) then etiquetas := etiquetas || 'del exterior'; end if;

  return jsonb_build_object(
    'persona', to_jsonb(p),
    'visitas', n,
    'primera', primera,
    'ultima', ultima,
    'gastado', case when puedo_ver_dinero() then gastado end,
    'plan_usual', plan_usual,
    'etiquetas_calculadas', to_jsonb(etiquetas),
    'etiquetas_puestas', coalesce((
      select jsonb_agg(e.nombre)
        from persona_etiquetas pe
        join etiquetas e on e.id = pe.etiqueta_id
       where pe.persona_id = p_persona_id and pe.origen = 'asignada'
    ), '[]'::jsonb),
    'organizaciones', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', o.nombre, 'tipo', v.tipo))
        from vinculos v join organizaciones o on o.id = v.organizacion_id
       where v.persona_id = p_persona_id
    ), '[]'::jsonb),
    'historial', visitas
  );
end;
$$ language plpgsql stable security definer set search_path = public;

comment on function ficha_persona(uuid) is
  'Todo lo que se sabe de alguien antes de contestarle el teléfono. Cuenta las '
  'visitas en que estuvo, no solo las reservas a su nombre: quien siempre '
  'viene con la familia figuraría en cero. El gasto sí es solo lo suyo — lo '
  'que pagó el titular de un grupo no es plata de ella.';


-- ── La lista, para la pantalla ──
create or replace view clientes_ficha as
select
  p.id,
  p.nombre_completo,
  p.tipo_documento,
  p.documento,
  p.telefono,
  p.email,
  p.pais_id,
  (select count(distinct r.fecha)::integer
     from registros r
    where r.estado not in ('cancelada', 'noshow')
      and (r.persona_id = p.id
        or exists (select 1 from pasajeros pa
                    where pa.registro_id = r.id and pa.persona_id = p.id))) as visitas,
  (select max(r.fecha)
     from registros r
    where r.estado not in ('cancelada', 'noshow')
      and (r.persona_id = p.id
        or exists (select 1 from pasajeros pa
                    where pa.registro_id = r.id and pa.persona_id = p.id))) as ultima
from personas p
where soy_del_equipo();

revoke all on clientes_ficha from public, anon;
grant select on clientes_ficha to authenticated;


-- ── La tabla `clientes` de la 001 queda retirada ──
-- Nunca se usó: ni una pantalla la lee y `registros.cliente_id` viaja siempre
-- en null. `personas` es lo que ella quería ser. No se borra —`registros` la
-- referencia y el pasado no se rompe— pero queda dicho para que nadie
-- construya encima.
comment on table clientes is
  'RETIRADA en la 025. Nunca se usó: cliente_id siempre fue null. La ficha del '
  'cliente es `personas` (020). No construir nada encima de esta tabla.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Permisos
-- ════════════════════════════════════════════════════════════

-- La firma de enlazar_persona cambió: se revoca la vieja si quedó y la nueva
-- se cierra igual. La llaman los triggers, que corren solos.
do $$ begin
  execute 'revoke all on function enlazar_persona(text, tipo_documento, text, uuid) from public, anon, authenticated';
exception when undefined_function then null; end $$;

revoke all on function enlazar_persona(text, tipo_documento, text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function registro_enlaza_titular() from public, anon, authenticated;

revoke all on function ficha_persona(uuid) from public, anon;
grant execute on function ficha_persona(uuid) to authenticated;


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

  -- El titular queda enlazado: si esto falla, la ficha del cliente vuelve a
  -- ser un cascarón.
  select count(*) into cuantas
    from registros r
   where nullif(trim(coalesce(r.identificacion, '')), '') is not null
     and nullif(trim(coalesce(r.nombre_pasajero, '')), '') is not null
     and r.persona_id is null;
  if cuantas > 0 then
    raise exception '% reservas con documento se quedaron sin titular enlazado', cuantas;
  end if;

  raise notice 'La ficha del cliente existe: % personas.', (select count(*) from personas);
end $$;
