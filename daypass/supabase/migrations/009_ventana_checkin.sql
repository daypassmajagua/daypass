-- ════════════════════════════════════════════════════════════════════════════
-- 009 · La ventana del check-in deja de depender del cierre
--
-- El problema: el check-in se cerraba cuando la coordinadora cerraba el día.
-- Ella cierra entre las 7 y las 10 de la noche; el cliente que abría su enlace
-- a las 10:05 se encontraba con una puerta cerrada, sin poder registrar
-- nombres, elegir almuerzo ni firmar.
--
-- Ese candado se puso para congelar el conteo de cocina. Pero cocina revisa
-- los platos el mismo día en la mañana, después del desayuno: el conteo se
-- estaba congelando doce horas antes de que alguien lo mirara.
--
-- El corte real es otro. La gente se cita a las 8 a.m. en La Bodeguita y
-- embarca entre 8:20 y 8:30. Cuando suben a la lancha dejan de poder tocar el
-- celular —y lo que haya en ese momento es lo que cocina ve después—. Así que
-- la regla queda en una sola frase:
--
--     El check-in cierra cuando zarpa la lancha.
--
-- Y el cierre del día pasa a hacer lo suyo: congelar el tentativo (pax,
-- lanchas, cupos), que sí lo consume el muelle esa misma noche.
--
-- Idempotente y en bloques: se puede correr entero o por partes, y volver a
-- correrlo no rompe nada. El lock_timeout evita el interbloqueo con el worker
-- de Realtime, que sostiene AccessShareLock sobre registros y pasajeros.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Dónde viven las horas
-- ════════════════════════════════════════════════════════════

create table if not exists ajustes (
  clave           text primary key,
  valor           text not null,
  descripcion     text,
  actualizado_at  timestamptz not null default now(),
  actualizado_por uuid references auth.users(id)
);

comment on table ajustes is
  'Parámetros de operación que cambian sin tocar código. Clave/valor a '
  'propósito: son pocos y de tipos distintos.';

insert into ajustes (clave, valor, descripcion) values
  ('checkin_cierra_hora', '08:30',
   'Hora de zarpe. El cliente puede registrar nombres, elegir almuerzo y '
   'firmar hasta esta hora del día de su Day Tour. Después ya está en la '
   'lancha y el conteo que vea cocina es el que quedó.'),
  ('checkin_abre_dias', '2',
   'Cuántos días antes se abre la etapa de plato y firma.')
on conflict (clave) do nothing;

alter table ajustes enable row level security;

drop policy if exists ajustes_lectura on ajustes;
create policy ajustes_lectura on ajustes
  for select to authenticated using (true);

drop policy if exists ajustes_escritura on ajustes;
create policy ajustes_escritura on ajustes
  for update to authenticated using (true) with check (true);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · El tiempo, en la hora de Cartagena
--
-- current_date es la fecha del servidor, que corre en UTC. Entre las 7 p.m. y
-- la medianoche de Colombia (UTC−5) ya es el día siguiente allá, que es
-- exactamente la franja en que la coordinadora trabaja. Todo lo que compare
-- fechas tiene que pasar por aquí.
-- ════════════════════════════════════════════════════════════

create or replace function hoy_bogota()
returns date as $$
  select (now() at time zone 'America/Bogota')::date;
$$ language sql stable;

create or replace function ahora_bogota()
returns timestamp as $$
  select (now() at time zone 'America/Bogota');
$$ language sql stable;

create or replace function ajuste(p_clave text, p_defecto text default null)
returns text as $$
  select coalesce((select valor from ajustes where clave = p_clave), p_defecto);
$$ language sql stable security definer;

/**
 * Son dos ventanas distintas y conviene no confundirlas.
 *
 * ETAPA 1 · Los nombres. Abierta desde que la reserva existe. Una agencia que
 * vende con tres semanas manda su listado cuando lo tiene, y no hay ninguna
 * razón para hacerla esperar: un nombre cargado temprano es un nombre que
 * nadie tiene que escribir en el muelle.
 */
create or replace function registro_abierto(p_fecha date)
returns boolean as $$
declare
  hora time := coalesce(ajuste('checkin_cierra_hora', '08:30')::time, '08:30'::time);
begin
  if p_fecha < hoy_bogota() then return false; end if;            -- ya pasó
  if p_fecha = hoy_bogota() and ahora_bogota()::time >= hora then
    return false;                                                 -- ya zarpó
  end if;
  return true;
end;
$$ language plpgsql stable security definer;

/**
 * ETAPA 2 · El plato y la firma. Solo desde N días antes: elegir almuerzo con
 * tres semanas de anticipación no le sirve a nadie y se olvida. Cierra igual
 * que la etapa 1, a la hora de zarpe.
 */
create or replace function checkin_abierto(p_fecha date)
returns boolean as $$
declare
  dias integer := coalesce(nullif(ajuste('checkin_abre_dias', '2'), '')::integer, 2);
begin
  return registro_abierto(p_fecha) and p_fecha <= hoy_bogota() + dias;
end;
$$ language plpgsql stable security definer;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Las funciones públicas, sin el candado del cierre
-- ════════════════════════════════════════════════════════════

create or replace function reserva_publica(p_token text)
returns json as $$
declare
  r registros;
  dia dias_operativos;
begin
  select * into r from _reserva_de_token(p_token);
  if r is null then return null; end if;

  select * into dia from dias_operativos where fecha = r.fecha;

  return json_build_object(
    'titular', r.nombre_pasajero,
    'grupo', r.nombre_grupo,
    'agencia', r.agencia_nombre,
    'fecha', r.fecha,
    'estado', r.estado,
    'adultos', r.adultos,
    'ninos', r.ninos,
    'infantes', r.infantes,
    'cortesias', r.cortesias,
    'plan', (select p.nombre from planes p where p.id = r.plan_id),
    'lancha', (select l.nombre from lanchas l where l.id = r.lancha_id),
    'estado_dia', coalesce(dia.estado::text, 'planeando'),
    -- El cierre del día ya no cierra nada de esto. Manda la hora de zarpe.
    'puede_registrar', registro_abierto(r.fecha),   -- nombres
    'puede_check_in', checkin_abierto(r.fecha),     -- plato y firma
    'cierra_a', ajuste('checkin_cierra_hora', '08:30'),
    'ya_zarpo', r.fecha = hoy_bogota() and not registro_abierto(r.fecha),
    'check_in_at', r.check_in_at,
    'tiene_firma', exists (select 1 from firmas f where f.registro_id = r.id),
    'opciones_plato', coalesce((
      select json_agg(json_build_object('id', o.id, 'es', o.nombre_es, 'en', o.nombre_en))
        from opciones_plato o where o.plan_id = r.plan_id and o.activo
    ), '[]'::json),
    'pasajeros', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'nombre', p.nombre, 'documento', p.documento,
        'tipo_documento', p.tipo_documento, 'pais_id', p.pais_id,
        'categoria', p.categoria, 'opcion_plato_id', p.opcion_plato_id,
        'restriccion_alimentaria', p.restriccion_alimentaria
      ) order by p.created_at)
        from pasajeros p where p.registro_id = r.id
    ), '[]'::json),
    'paises', coalesce((
      select json_agg(json_build_object('id', pa.id, 'nombre', pa.nombre) order by pa.nombre)
        from paises pa
    ), '[]'::json)
  );
end;
$$ language plpgsql stable security definer;


create or replace function guardar_pasajeros_por_token(p_token text, p_pasajeros json)
returns json as $$
declare
  r registros;
  dia dias_operativos;
  item json;
  restricciones_antes text;
  restricciones_despues text;
begin
  select * into r from _reserva_de_token(p_token);
  if r is null then
    raise exception 'Este enlace ya no está disponible' using errcode = 'no_data_found';
  end if;

  -- Los nombres se reciben hasta que zarpa, aunque el día ya esté cerrado.
  if not registro_abierto(r.fecha) then
    raise exception 'El registro en línea de este Day Tour ya se cerró'
      using errcode = 'check_violation';
  end if;

  select * into dia from dias_operativos where fecha = r.fecha;

  -- Lo que cocina ya tenía anotado, para saber después si cambió.
  select string_agg(coalesce(restriccion_alimentaria, ''), '|' order by created_at)
    into restricciones_antes
    from pasajeros where registro_id = r.id;

  perform set_config('daypass.operacion_sistema', 'on', true);

  delete from pasajeros where registro_id = r.id;

  for item in select * from json_array_elements(p_pasajeros) loop
    if coalesce(trim(item ->> 'nombre'), '') <> '' then
      insert into pasajeros (
        registro_id, nombre, tipo_documento, documento, pais_id,
        categoria, opcion_plato_id, restriccion_alimentaria
      ) values (
        r.id,
        trim(item ->> 'nombre'),
        nullif(item ->> 'tipo_documento', '')::tipo_documento,
        nullif(trim(item ->> 'documento'), ''),
        nullif(item ->> 'pais_id', '')::uuid,
        coalesce(nullif(item ->> 'categoria', ''), 'adulto')::categoria_pasajero,
        nullif(item ->> 'opcion_plato_id', '')::uuid,
        nullif(trim(item ->> 'restriccion_alimentaria'), '')
      );
    end if;
  end loop;

  -- Un nombre que llega tarde no mueve ningún número: la reserva ya decía
  -- cuántos son y el cupo de la lancha no cambia. No se marca, porque marcar
  -- todo enseña a ignorar la marca.
  --
  -- Una restricción alimentaria sí le cambia el trabajo a cocina. Esa se
  -- marca, y solo cuando el día ya estaba cerrado.
  if coalesce(dia.estado::text, 'planeando') <> 'planeando' then
    select string_agg(coalesce(restriccion_alimentaria, ''), '|' order by created_at)
      into restricciones_despues
      from pasajeros where registro_id = r.id;

    if coalesce(restricciones_despues, '') is distinct from coalesce(restricciones_antes, '')
       and coalesce(restricciones_despues, '') <> '' then
      update registros
         set cambio_tardio = true,
             cambio_tardio_at = now(),
             cambio_tardio_motivo = 'Restricción alimentaria registrada en el check-in'
       where id = r.id;
    end if;
  end if;

  perform set_config('daypass.operacion_sistema', 'off', true);
  return reserva_publica(p_token);
end;
$$ language plpgsql security definer;


create or replace function firmar_por_token(
  p_token text,
  p_documento_legal_id uuid,
  p_firmante_nombre text,
  p_firmante_documento text,
  p_trazo text,
  p_client_id uuid,
  p_dispositivo text default null
)
returns json as $$
declare
  r registros;
  el_hash text;
begin
  select * into r from _reserva_de_token(p_token);
  if r is null then
    raise exception 'Este enlace ya no está disponible' using errcode = 'no_data_found';
  end if;

  if not checkin_abierto(r.fecha) then
    raise exception 'El registro en línea de este Day Tour ya se cerró'
      using errcode = 'check_violation';
  end if;

  -- El hash prueba que el conjunto no se alteró después. sha256() es
  -- nativo de Postgres: no depende de en qué esquema quedó pgcrypto.
  el_hash := encode(sha256(convert_to(
    coalesce(p_firmante_documento, '') || '|' ||
    p_documento_legal_id::text || '|' ||
    now()::text || '|' ||
    coalesce(p_dispositivo, '') || '|' ||
    coalesce(p_trazo, ''),
    'UTF8')), 'hex');

  insert into firmas (
    registro_id, documento_legal_id, firmante_nombre, firmante_documento,
    trazo_datos, dispositivo, hash, client_id
  ) values (
    r.id, p_documento_legal_id, p_firmante_nombre, nullif(trim(p_firmante_documento), ''),
    p_trazo, p_dispositivo, el_hash, p_client_id
  )
  on conflict (client_id) do nothing;

  perform set_config('daypass.operacion_sistema', 'on', true);
  update registros
     set check_in_at = coalesce(check_in_at, now()),
         check_in_desde = 'publico'
   where id = r.id;
  update tokens_reserva set estado = 'check_in_abierto' where registro_id = r.id;
  perform set_config('daypass.operacion_sistema', 'off', true);

  return reserva_publica(p_token);
end;
$$ language plpgsql security definer;


-- ── Los permisos, otra vez: create or replace no los conserva si la
--    firma de la función cambió, y más vale sobrar que faltar ───
-- anon sigue pudiendo ejecutar únicamente las cinco de la puerta pública. Los
-- ayudantes quedan cerrados: reserva_publica los llama por dentro, y como es
-- SECURITY DEFINER esas llamadas se evalúan con el dueño, no con anon.
revoke all on function _reserva_de_token(text) from anon, public;
revoke all on function ajuste(text, text) from anon, public;
revoke all on function hoy_bogota() from anon, public;
revoke all on function ahora_bogota() from anon, public;
revoke all on function registro_abierto(date) from anon, public;
revoke all on function checkin_abierto(date) from anon, public;

grant execute on function reserva_publica(text) to anon;
grant execute on function marcar_token_abierto(text) to anon;
grant execute on function guardar_pasajeros_por_token(text, json) to anon;
grant execute on function firmar_por_token(text, uuid, text, text, text, uuid, text) to anon;
grant execute on function documento_vigente(text) to anon;
