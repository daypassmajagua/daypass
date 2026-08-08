-- ════════════════════════════════════════════════════════════════════════════
-- 013 · El plato del check-in es un pronóstico, no una orden
--
-- Cambia quién decide el almuerzo: lo comanda el mesero en la mesa, y esa
-- comanda es la que manda. Cocina deja de tener perfil propio.
--
-- Eso convierte lo que el cliente elige en su check-in en otra cosa. Antes era
-- un compromiso —cocina cocinaba eso— y por eso la 010 lo congelaba a una
-- hora: un número que se mueve después de que alguien cocinó es un problema.
--
-- Ahora es una estimación. Y una estimación no se protege congelándola: se
-- protege dejándola llegar. El cliente que elige a las nueve de la mañana suma
-- información; cerrarle la puerta a las 8:30 solo hacía el pronóstico peor.
--
-- Así que el plato pierde su candado y vuelve a seguir la ventana del
-- check-in: se puede elegir hasta que zarpa la lancha, igual que los nombres y
-- la firma. Una regla menos que explicar.
--
-- LO QUE SÍ HACÍA FALTA y el candado escondía: saber con qué número preparó
-- cocina. El mesero llega a la mesa a comandar, y necesita saber si lo que
-- cocina tiene enfrente se parece a lo que va a pedir la gente.
--
-- Eso no se puede deducir de las marcas de tiempo: guardar_pasajeros_por_token
-- borra y reinserta la lista completa, así que updated_at dice "ahora" para
-- todos en cuanto alguien toca su check-in. Se resuelve al revés: quien le
-- lleva el número a cocina lo marca, y esa marca guarda el conteo de ese
-- momento. Un hecho, no una hora adivinada.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · El plato sigue la ventana del check-in
-- ════════════════════════════════════════════════════════════

/**
 * Se mantiene la función —hay pantallas que la llaman— pero pierde el candado
 * propio: el plato está abierto mientras lo esté la etapa 2.
 */
create or replace function cocina_abierta(p_fecha date)
returns boolean as $$
  select checkin_abierto(p_fecha);
$$ language sql stable security definer;

comment on function cocina_abierta(date) is
  'El plato se puede elegir mientras el check-in esté abierto. Ya no se '
  'congela: lo que el cliente elige es un pronóstico y la comanda del mesero '
  'es la que manda.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Con qué número preparó cocina
--
-- Las columnas de la 010 se conservan: nunca se reescribe el pasado, y los
-- días que ya tienen una hora puesta a mano la mantienen. Simplemente dejan de
-- cerrar nada.
-- ════════════════════════════════════════════════════════════

alter table dias_operativos
  add column if not exists cocina_revisado_at         timestamptz,
  add column if not exists cocina_revisado_por        uuid references auth.users(id),
  add column if not exists cocina_revisado_por_nombre text,
  add column if not exists cocina_revisado_conteo     jsonb;

comment on column dias_operativos.cocina_revisado_conteo is
  'El conteo tal como estaba cuando alguien le pasó el número a cocina. '
  'Sirve para decirle al mesero cuánto se movió desde entonces.';

/**
 * "Ya le pasé este número a cocina."
 *
 * Lo marca quien se lo lleva —la isla o el mesero, que cocina ya no tiene
 * perfil—. Guarda el conteo de ese instante, con nombre y hora: si en la mesa
 * el número no cuadra, se puede decir con qué se preparó y quién lo llevó.
 *
 * Se puede volver a marcar: si cocina revisa dos veces, manda la última.
 */
create or replace function marcar_revision_cocina(p_fecha date, p_conteo jsonb)
returns json as $$
declare
  d dias_operativos;
begin
  insert into dias_operativos (fecha) values (p_fecha)
  on conflict (fecha) do nothing;

  update dias_operativos
     set cocina_revisado_at = now(),
         cocina_revisado_por = auth.uid(),
         cocina_revisado_por_nombre = nombre_de_quien_actua(),
         cocina_revisado_conteo = p_conteo
   where fecha = p_fecha
   returning * into d;

  return json_build_object(
    'fecha', d.fecha,
    'revisado_at', d.cocina_revisado_at,
    'revisado_por', d.cocina_revisado_por_nombre,
    'conteo', d.cocina_revisado_conteo
  );
end;
$$ language plpgsql security definer;

/** Lo que se marcó, para poder comparar contra lo que hay ahora. */
create or replace function revision_cocina(p_fecha date)
returns json as $$
  select json_build_object(
    'revisado_at', d.cocina_revisado_at,
    'revisado_por', d.cocina_revisado_por_nombre,
    'conteo', d.cocina_revisado_conteo
  )
  from dias_operativos d
 where d.fecha = p_fecha;
$$ language sql stable security definer;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Simplificar la puerta pública
--
-- Con el plato siguiendo la ventana del check-in, la rama que conservaba el
-- plato viejo cuando "cocina estaba cerrada" ya no se alcanza: si el check-in
-- está abierto el plato también, y si está cerrado la función rechaza antes de
-- llegar ahí. Se quita para que nadie tenga que razonar sobre código muerto.
-- ════════════════════════════════════════════════════════════

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

  -- Un nombre o un plato que llegan tarde ya no se marcan: el nombre no mueve
  -- ningún número y el plato es pronóstico, que el mesero confirma en la mesa.
  --
  -- Una restricción alimentaria sí. Esa puede obligar a comprar algo distinto,
  -- y si llega con el día cerrado hay que cantarla por voz.
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


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Permisos
--
-- Las funciones nuevas nacen cerradas gracias a la 012, pero create or replace
-- sobre una existente restablece los permisos por defecto. Se cierra
-- explícitamente y se vuelve a abrir solo lo que toca.
-- ════════════════════════════════════════════════════════════

revoke all on function cocina_abierta(date)                    from public, anon;
revoke all on function marcar_revision_cocina(date, jsonb)     from public, anon;
revoke all on function revision_cocina(date)                   from public, anon;
revoke all on function guardar_pasajeros_por_token(text, json) from public, anon;

grant execute on function cocina_abierta(date)                to authenticated;
grant execute on function marcar_revision_cocina(date, jsonb) to authenticated;
grant execute on function revision_cocina(date)               to authenticated;

-- Esta sí es de la página del cliente.
grant execute on function guardar_pasajeros_por_token(text, json) to anon, authenticated;


-- ── Comprobación: anon sigue con exactamente cinco ──
do $$
declare cuantas integer;
begin
  select count(*) into cuantas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5', cuantas;
  end if;
end $$;
