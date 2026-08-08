-- ════════════════════════════════════════════════════════════════════════════
-- 010 · El cierre de cocina lo maneja la coordinadora, día por día
--
-- La 009 dejó una sola hora para todo: nombres, plato y firma cerraban juntos
-- cuando zarpaba la lancha. Sirve como regla general, pero la realidad de un
-- día concreto no siempre se parece a la regla:
--
--   · la lancha se atrasa y hay una hora más de check-in que aprovechar
--   · cocina pide el número temprano porque el grupo es grande
--
-- Así que la hora deja de ser una sola y de ser global.
--
-- Se separan en dos, y esto importa: si el cierre de cocina arrastrara los
-- nombres, adelantarlo a las 7 dejaría a la Capitanía sin la lista, que es
-- justo lo que la 009 vino a arreglar.
--
--   NOMBRES y FIRMA  →  hasta que zarpa la lancha. No se tocan.
--                       Un nombre no mueve ningún número y la firma es un
--                       papel legal, no un plato.
--
--   PLATO            →  hasta el cierre de cocina, que por defecto es la
--                       misma hora de zarpe, pero que la coordinadora puede
--                       mover ese día —antes o después— o cerrar de una vez.
--
-- Cuando cocina cierra, el cliente deja de ver el selector de almuerzo y el
-- servidor conserva el plato que ya tenía. Las dos cosas: la pantalla es
-- honesta y la base no depende de que la pantalla lo sea.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · La hora de cocina, con su excepción del día
-- ════════════════════════════════════════════════════════════

insert into ajustes (clave, valor, descripcion) values
  ('cocina_cierra_hora', '08:30',
   'Hora en que cocina deja de recibir cambios de almuerzo. Es el valor por '
   'defecto: la coordinadora puede moverlo para un día concreto desde la '
   'pantalla de Cocina.')
on conflict (clave) do nothing;

-- La excepción vive en el día, no en el ajuste global: mover la hora de un
-- martes no puede cambiar la de todos los martes.
alter table dias_operativos
  add column if not exists cocina_cierra_a   time,
  add column if not exists cocina_cierra_at  timestamptz,
  add column if not exists cocina_cierra_por uuid references auth.users(id),
  add column if not exists cocina_cierra_por_nombre text;

comment on column dias_operativos.cocina_cierra_a is
  'Excepción de este día. En null manda el ajuste global cocina_cierra_hora.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Cuándo cierra cocina
-- ════════════════════════════════════════════════════════════

/** La hora que aplica a un día: la suya si la tiene, si no la de siempre. */
create or replace function hora_cierre_cocina(p_fecha date)
returns time as $$
  select coalesce(
    (select d.cocina_cierra_a from dias_operativos d where d.fecha = p_fecha),
    nullif(ajuste('cocina_cierra_hora', ''), '')::time,
    nullif(ajuste('checkin_cierra_hora', ''), '')::time,
    '08:30'::time
  );
$$ language sql stable security definer;

/**
 * ¿Cocina todavía recibe cambios de almuerzo?
 *
 * Se apoya en checkin_abierto porque el plato nunca puede estar abierto si la
 * etapa 2 no lo está: elegir almuerzo con tres semanas no le sirve a nadie, y
 * después de zarpar tampoco.
 */
create or replace function cocina_abierta(p_fecha date)
returns boolean as $$
begin
  if not checkin_abierto(p_fecha) then return false; end if;
  if p_fecha = hoy_bogota() and ahora_bogota()::time >= hora_cierre_cocina(p_fecha) then
    return false;
  end if;
  return true;
end;
$$ language plpgsql stable security definer;

/**
 * La coordinadora mueve el cierre de cocina de un día.
 *
 * p_hora en null devuelve el día a la hora de siempre. Queda con nombre y
 * hora: si cocina reclama que le cambiaron el número, hay que poder decir
 * quién y cuándo.
 */
create or replace function fijar_cierre_cocina(p_fecha date, p_hora time default null)
returns json as $$
declare
  d dias_operativos;
begin
  insert into dias_operativos (fecha) values (p_fecha)
  on conflict (fecha) do nothing;

  update dias_operativos
     set cocina_cierra_a = p_hora,
         cocina_cierra_at = now(),
         cocina_cierra_por = auth.uid(),
         cocina_cierra_por_nombre = nombre_de_quien_actua()
   where fecha = p_fecha
   returning * into d;

  return json_build_object(
    'fecha', d.fecha,
    'cocina_cierra_a', hora_cierre_cocina(p_fecha),
    'es_excepcion', d.cocina_cierra_a is not null,
    'cambiada_por', d.cocina_cierra_por_nombre,
    'cambiada_at', d.cocina_cierra_at,
    'abierta', cocina_abierta(p_fecha)
  );
end;
$$ language plpgsql security definer;

grant execute on function fijar_cierre_cocina(date, time) to authenticated;
grant execute on function cocina_abierta(date) to authenticated;
grant execute on function hora_cierre_cocina(date) to authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · La puerta pública respeta el cierre de cocina
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
    'puede_registrar', registro_abierto(r.fecha),   -- nombres
    'puede_check_in', checkin_abierto(r.fecha),     -- firma
    'puede_elegir_plato', cocina_abierta(r.fecha),  -- almuerzo
    'cierra_a', ajuste('checkin_cierra_hora', '08:30'),
    'cocina_cierra_a', hora_cierre_cocina(r.fecha)::text,
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
  hay_cocina boolean;
  platos_previos jsonb;
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
  hay_cocina := cocina_abierta(r.fecha);

  -- Con cocina cerrada, el plato que ya estaba es el que se queda. La página
  -- esconde el selector, pero esconder no es prohibir: si llega un plato
  -- igual —enlace viejo, pestaña abierta desde anoche— aquí se ignora.
  if not hay_cocina then
    select coalesce(jsonb_object_agg(p.id::text, p.opcion_plato_id), '{}'::jsonb)
      into platos_previos
      from pasajeros p
     where p.registro_id = r.id and p.opcion_plato_id is not null;
  end if;

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
        case
          when hay_cocina then nullif(item ->> 'opcion_plato_id', '')::uuid
          -- Cerrada: se recupera por el id del pasajero. Quien no lo traiga es
          -- alguien que se agregó después, y ese no alcanzó a pedir almuerzo.
          else nullif(platos_previos ->> coalesce(item ->> 'id', ''), '')::uuid
        end,
        nullif(trim(item ->> 'restriccion_alimentaria'), '')
      );
    end if;
  end loop;

  -- Un nombre que llega tarde no mueve ningún número: la reserva ya decía
  -- cuántos son y el cupo de la lancha no cambia. No se marca, porque marcar
  -- todo enseña a ignorar la marca.
  --
  -- Una restricción alimentaria sí le cambia el trabajo a cocina, y una que
  -- llega con cocina ya cerrada hay que cantarla por voz. Esa se marca.
  if coalesce(dia.estado::text, 'planeando') <> 'planeando' or not hay_cocina then
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


-- ── Permisos: anon sigue con las cinco de siempre ───
revoke all on function cocina_abierta(date) from anon, public;
revoke all on function hora_cierre_cocina(date) from anon, public;
revoke all on function fijar_cierre_cocina(date, time) from anon, public;

grant execute on function fijar_cierre_cocina(date, time) to authenticated;
grant execute on function cocina_abierta(date) to authenticated;
grant execute on function hora_cierre_cocina(date) to authenticated;

grant execute on function reserva_publica(text) to anon;
grant execute on function guardar_pasajeros_por_token(text, json) to anon;
