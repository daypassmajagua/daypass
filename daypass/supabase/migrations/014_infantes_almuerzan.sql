-- ════════════════════════════════════════════════════════════════════════════
-- 014 · Bloque 0 · Los infantes almuerzan
--
-- Corrige un error de modelo, no un cálculo. El conteo de cocina asumía que
-- los infantes no almuerzan, y ese supuesto no salió de la operación: se
-- dedujo de la regla de precios —el infante no paga— y de ahí se concluyó que
-- no come. Confirmado con el hotel: **de 0 a 3 sí almuerzan**.
--
--     Quién paga y quién come son dos ejes distintos.
--
-- Es la misma lección que la regla 9 (plato ≠ plan): un eje no puede derivar
-- del otro. Cada infante que vino fue una porción que cocina no preparó.
--
-- Qué trae:
--
--   1. `pasajeros.almuerza` — el eje "quién come", explícito y editable, en
--      vez de deducido de la categoría dentro del código.
--
--   2. `ajustes.edad_max_infante` — la edad de corte deja de estar escrita a
--      mano en tres pantallas y en los textos ES/EN de la página del cliente.
--      Regla 22: toda constante operativa vive en base de datos y la edita
--      quien la usa.
--
-- Lo que NO trae: el infante sigue sin elegir plato en el check-in. Un niño de
-- 0 a 3 no elige y sus padres no van a decidirle un plan. Cocina lo ve como
-- línea aparte —"41 Gold · 25 Silver · 3 infantes"— porque son tres porciones
-- más aunque no sean un plato del menú. Qué se les sirve exactamente lo
-- confirma la isla.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Quién come, como campo propio
-- ════════════════════════════════════════════════════════════

alter table pasajeros
  add column if not exists almuerza boolean not null default true;

comment on column pasajeros.almuerza is
  'Si esta persona almuerza. Hoy comen todas las categorías, infantes '
  'incluidos: por eso el default es true y las filas que ya existían quedan '
  'en true, que es la respuesta correcta. Existe como campo y no como regla '
  'en el código porque quién paga y quién come son ejes distintos, y porque '
  'el caso de 3 a 6 años —donde depende de lo que los padres compraron— se '
  'resuelve marcando a la persona, no cambiando una fórmula.';

-- Índice parcial: la excepción es rara y lo que se busca es justamente esa.
create index if not exists pasajeros_no_almuerzan_idx
  on pasajeros (registro_id) where not almuerza;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · La edad de corte, editable
-- ════════════════════════════════════════════════════════════

insert into ajustes (clave, valor, descripcion) values
  ('edad_max_infante', '3',
   'Hasta qué edad una persona cuenta como infante. Aparece en la página del '
   'cliente ("Infante (menor de 3)") y en el conteo de cocina. Cambiarlo aquí '
   'lo cambia en todas partes.')
on conflict (clave) do nothing;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · La página del cliente lee la edad de ahí
--
-- Se redefine reserva_publica para que mande `edad_max_infante` junto con lo
-- demás. Sin esto la página seguiría diciendo "menor de 3" escrito a mano y
-- cambiar el ajuste no serviría de nada.
--
-- El resto del JSON queda igual que en la 013: se repite entero porque
-- create or replace no permite tocar solo una clave.
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
    -- Nuevo en la 014: la edad deja de estar escrita en el código.
    'edad_max_infante', ajuste('edad_max_infante', '3'),
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
        'almuerza', p.almuerza,
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


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · El check-in guarda quién come
--
-- La página no le pregunta al cliente si su hijo almuerza —no tendría por qué
-- saberlo— pero sí tiene que conservar la marca si alguien de la oficina la
-- puso: guardar_pasajeros_por_token borra y reinserta la lista entera, y sin
-- esto un check-in del cliente borraría la excepción registrada en la oficina.
-- ════════════════════════════════════════════════════════════

create or replace function guardar_pasajeros_por_token(p_token text, p_pasajeros json)
returns json as $$
declare
  r registros;
  dia dias_operativos;
  item json;
  come_previo jsonb;
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

  -- A quién le habían marcado que NO almuerza. Solo se guardan las
  -- excepciones: lo normal es que todos coman y eso es el default.
  select coalesce(jsonb_object_agg(p.id::text, p.almuerza), '{}'::jsonb)
    into come_previo
    from pasajeros p
   where p.registro_id = r.id and not p.almuerza;

  select string_agg(coalesce(restriccion_alimentaria, ''), '|' order by created_at)
    into restricciones_antes
    from pasajeros where registro_id = r.id;

  perform set_config('daypass.operacion_sistema', 'on', true);

  delete from pasajeros where registro_id = r.id;

  for item in select * from json_array_elements(p_pasajeros) loop
    if coalesce(trim(item ->> 'nombre'), '') <> '' then
      insert into pasajeros (
        registro_id, nombre, tipo_documento, documento, pais_id,
        categoria, opcion_plato_id, almuerza, restriccion_alimentaria
      ) values (
        r.id,
        trim(item ->> 'nombre'),
        nullif(item ->> 'tipo_documento', '')::tipo_documento,
        nullif(trim(item ->> 'documento'), ''),
        nullif(item ->> 'pais_id', '')::uuid,
        coalesce(nullif(item ->> 'categoria', ''), 'adulto')::categoria_pasajero,
        nullif(item ->> 'opcion_plato_id', '')::uuid,
        -- Si venía marcado que no almuerza, se respeta. Si no, come.
        coalesce((come_previo ->> coalesce(item ->> 'id', ''))::boolean, true),
        nullif(trim(item ->> 'restriccion_alimentaria'), '')
      );
    end if;
  end loop;

  -- Un nombre o un plato que llegan tarde no se marcan: el nombre no mueve
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
-- BLOQUE 5 · Permisos
--
-- create or replace restablece los permisos por defecto —es lo que causó el
-- agujero de la 012—, así que las dos redefinidas se cierran y se vuelve a
-- abrir solo lo que toca.
-- ════════════════════════════════════════════════════════════

revoke all on function reserva_publica(text)                   from public, anon;
revoke all on function guardar_pasajeros_por_token(text, json) from public, anon;

grant execute on function reserva_publica(text)                   to anon, authenticated;
grant execute on function guardar_pasajeros_por_token(text, json) to anon, authenticated;


-- ── Comprobación: anon sigue con exactamente cinco ──
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
  raise notice 'anon ejecuta % funciones: %', cuantas, abiertas;
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5: %', cuantas, abiertas;
  end if;
end $$;
