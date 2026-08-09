-- ════════════════════════════════════════════════════════════════════════════
-- 018 · Los roles se cumplen también en las funciones y en las vistas
--
-- Sale de la auditoría del 8 de agosto (docs/auditoria-2026-08-08.md). La 015
-- apretó las TABLAS por rol, pero dejó tres puertas por donde el rol no se
-- pregunta:
--
--   1. Las RPC sensibles. La 012 le concedió EXECUTE a `authenticated` sobre
--      todas las funciones —correcto entonces: urgía cerrarle la calle a anon—
--      y como son SECURITY DEFINER, la RLS no las toca. Resultado: un mesero
--      con sesión podía cerrar el día operativo llamando la API directo.
--      Aquí cada una pregunta el rol en la primera línea.
--
--   2. La tabla `registros` cruda. La vista `reservas` enmascara el dinero,
--      pero PostgREST también expone la tabla, y su política de lectura era
--      `soy_del_equipo()`: el mesero podía pedir `precio_adulto` por REST y
--      recibirlo — y por el canal de Realtime le llegaba la fila entera.
--      Ahora la tabla cruda solo la lee quien puede ver plata; el resto lee
--      la vista, que para eso existe.
--
--   3. La vista `estado_embarques`. Las vistas no tienen RLS; esta corría con
--      los permisos de su dueño y conservaba el grant por defecto de Supabase:
--      nombres y documentos de cada embarcado, legibles con la clave anon del
--      navegador. Pasa a `security_invoker` y se le revoca anon.
--
-- Y una cuarta cosa que no es de permisos sino de comportamiento:
--
--   4. `guardar_pasajeros_por_token` borraba y reinsertaba la lista completa.
--      Borrar un pasajero que ya embarcó dispara el `on delete set null` de
--      `embarques`, cuyo trigger de inmutabilidad revienta TODO el guardado —
--      y el choque ocurre justo en la ventana 8:20–8:30, con el cliente
--      delante. Ahora empareja por id: actualiza, inserta lo nuevo y borra
--      solo a quien de verdad salió de la lista (con mensaje claro si ya
--      embarcó).
--
-- De paso, `programar_zarpes` deja de tener las 09:00 escritas: la hora sale
-- del ajuste `checkin_cierra_hora` (la hora de zarpe, regla 13), como
-- `programar_regresos` ya hacía con `hora_regreso`.
--
-- Toda función redefinida se vuelve a revocar (create or replace restablece
-- los permisos) y al final se comprueba que anon siga con exactamente cinco.
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · El candado de rol de cada RPC sensible
--
-- El cuerpo de cada función es el vigente, copiado tal cual; lo único nuevo
-- es la pregunta del rol al entrar. El mensaje dice quién sí puede, porque
-- se lo va a leer una persona en un toast.
-- ════════════════════════════════════════════════════════════

-- ── 1a. Cerrar el tentativo: coordinación ──
create or replace function cerrar_tentativo(p_fecha date)
returns dias_operativos as $$
declare
  dia dias_operativos;
begin
  if not tiene_rol('super_admin', 'directora', 'asesora') then
    raise exception 'El tentativo lo cierra la coordinación del pasadía'
      using errcode = '42501';
  end if;

  perform set_config('daypass.operacion_sistema', 'on', true);

  insert into dias_operativos (fecha) values (p_fecha)
  on conflict (fecha) do nothing;

  select * into dia from dias_operativos where fecha = p_fecha for update;

  if dia.estado <> 'planeando' then
    raise exception 'El día % ya no está en planeación (está en %)', p_fecha, dia.estado
      using errcode = 'check_violation';
  end if;

  update registros
     set estado = 'confirmada'
   where fecha = p_fecha
     and estado = 'tentativa';

  update dias_operativos
     set estado = 'tentativo_cerrado',
         cerrado_tentativo_at = now(),
         cerrado_tentativo_por = auth.uid(),
         cerrado_tentativo_por_nombre = nombre_de_quien_actua()
   where fecha = p_fecha
  returning * into dia;

  perform set_config('daypass.operacion_sistema', 'off', true);
  return dia;
end;
$$ language plpgsql security definer;

-- ── 1b. Cerrar el día: coordinación ──
create or replace function cerrar_dia(p_fecha date)
returns dias_operativos as $$
declare
  dia dias_operativos;
begin
  if not tiene_rol('super_admin', 'directora', 'asesora') then
    raise exception 'El día lo cierra la coordinación del pasadía'
      using errcode = '42501';
  end if;

  perform set_config('daypass.operacion_sistema', 'on', true);

  update dias_operativos
     set estado = 'cerrado',
         cerrado_at = now(),
         cerrado_por = auth.uid(),
         cerrado_por_nombre = nombre_de_quien_actua()
   where fecha = p_fecha
  returning * into dia;

  if dia is null then
    raise exception 'No existe el día %', p_fecha using errcode = 'no_data_found';
  end if;

  perform set_config('daypass.operacion_sistema', 'off', true);
  return dia;
end;
$$ language plpgsql security definer;

-- ── 1c. Cambio de estado a mano: quien vende y la coordinación ──
-- Gerencia mira el negocio, no lo opera: queda por fuera a propósito, aunque
-- tenga El día en su menú.
create or replace function cambiar_estado_manual(
  p_registro_id uuid,
  p_estado text,
  p_motivo text default null
)
returns registros as $$
declare
  reg registros;
begin
  if not tiene_rol('super_admin', 'directora', 'asesora', 'asesora_comercial') then
    raise exception 'Los estados los cambia la oficina; en el muelle y la isla los mueve la operación'
      using errcode = '42501';
  end if;

  update registros set estado = p_estado
   where id = p_registro_id
  returning * into reg;

  if reg is null then
    raise exception 'No existe la reserva %', p_registro_id using errcode = 'no_data_found';
  end if;

  update cambios_estado
     set motivo = p_motivo
   where registro_id = p_registro_id
     and id = (select id from cambios_estado
                where registro_id = p_registro_id
                order by ocurrido_at desc limit 1);

  return reg;
end;
$$ language plpgsql security definer;

-- ── 1d. Programar los zarpes: quien opera el muelle ──
-- Y la hora deja de estar escrita: sale del ajuste `checkin_cierra_hora`, que
-- es la hora de zarpe (el check-in cierra cuando zarpa la lancha, regla 13).
-- Antes decía `default '09:00'` y el front nunca mandaba otra cosa: los
-- zarpes de un muelle que sale a las 8:30 quedaban programados a las 9.
create or replace function programar_zarpes(p_fecha date, p_hora time default null)
returns setof zarpes as $$
declare
  hora time := coalesce(
    p_hora,
    nullif(ajuste('checkin_cierra_hora', ''), '')::time,
    '08:30'::time
  );
begin
  if not puedo_operar_muelle() then
    raise exception 'Los zarpes los programa quien opera el muelle'
      using errcode = '42501';
  end if;

  insert into zarpes (fecha, lancha_id, sentido, hora_programada)
  select distinct p_fecha, r.lancha_id, 'ida'::sentido_zarpe, hora
    from registros r
   where r.fecha = p_fecha
     and r.estado not in ('cancelada', 'noshow')
  on conflict do nothing;

  return query select * from zarpes where fecha = p_fecha order by hora_programada, created_at;
end;
$$ language plpgsql security definer;

-- ── 1e. Programar los regresos: quien opera el muelle ──
create or replace function programar_regresos(p_fecha date, p_hora time default null)
returns setof zarpes as $$
declare
  hora time := coalesce(
    p_hora,
    nullif(ajuste('hora_regreso', ''), '')::time,
    '15:30'::time
  );
begin
  if not puedo_operar_muelle() then
    raise exception 'Los regresos los programa quien opera el muelle'
      using errcode = '42501';
  end if;

  insert into zarpes (fecha, lancha_id, sentido, hora_programada, piloto_id)
  select distinct on (z.lancha_id)
         p_fecha, z.lancha_id, 'regreso'::sentido_zarpe, hora, z.piloto_id
    from zarpes z
   where z.fecha = p_fecha
     and z.sentido = 'ida'
     and z.estado in ('zarpado', 'regresado')
   order by z.lancha_id, z.created_at
  on conflict do nothing;

  return query
    select * from zarpes
     where fecha = p_fecha and sentido = 'regreso'
     order by hora_programada, created_at;
end;
$$ language plpgsql security definer;

-- ── 1f. Cerrar un zarpe: quien opera el muelle ──
create or replace function cerrar_zarpe(p_zarpe_id uuid)
returns zarpes as $$
declare
  z zarpes;
begin
  if not puedo_operar_muelle() then
    raise exception 'Los zarpes los cierra quien opera el muelle'
      using errcode = '42501';
  end if;

  perform set_config('daypass.operacion_sistema', 'on', true);

  select * into z from zarpes where id = p_zarpe_id for update;
  if z is null then
    raise exception 'No existe ese zarpe' using errcode = 'no_data_found';
  end if;
  if z.estado in ('zarpado', 'regresado', 'cancelado') then
    raise exception 'Ese zarpe ya está %', z.estado using errcode = 'check_violation';
  end if;

  if z.sentido = 'ida' then
    update zarpes
       set estado = 'zarpado',
           hora_real_salida = coalesce(hora_real_salida, now()),
           cerrado_por = auth.uid(), cerrado_at = now()
     where id = p_zarpe_id
    returning * into z;

    -- Los que subieron ya están en la isla.
    update registros r
       set estado = 'en_isla'
     where r.fecha = z.fecha
       and r.estado in ('confirmada', 'tentativa')
       and exists (
         select 1 from estado_embarques ee
          where ee.zarpe_id = p_zarpe_id
            and ee.registro_id = r.id
            and ee.estado in ('check_in', 'walk_in')
       );

    -- El muelle marca el no llegó, no la oficina.
    update registros r
       set estado = 'noshow'
     where r.fecha = z.fecha
       and r.estado in ('confirmada', 'tentativa')
       and exists (
         select 1 from estado_embarques ee
          where ee.zarpe_id = p_zarpe_id and ee.registro_id = r.id and ee.estado = 'no_show'
       )
       and not exists (
         select 1 from estado_embarques ee
          where ee.zarpe_id = p_zarpe_id and ee.registro_id = r.id
            and ee.estado in ('check_in', 'walk_in')
       );

    -- El día entra en operación con el primer zarpe que sale.
    update dias_operativos
       set estado = 'en_operacion'
     where fecha = z.fecha and estado = 'tentativo_cerrado';

  else
    update zarpes
       set estado = 'regresado',
           hora_real_regreso = coalesce(hora_real_regreso, now()),
           cerrado_por = auth.uid(), cerrado_at = now()
     where id = p_zarpe_id
    returning * into z;

    -- Quien bajó terminó su pasadía. Quien no bajó se queda en 'en_isla' a
    -- propósito: esa es la alerta de faltantes, y no se apaga sola.
    update registros r
       set estado = 'completada'
     where r.fecha = z.fecha
       and r.estado = 'en_isla'
       and exists (
         select 1 from estado_embarques ee
          where ee.zarpe_id = p_zarpe_id
            and ee.registro_id = r.id
            and ee.estado = 'desembarque'
       );

    -- El enlace deja de editar y pasa a ser recuerdo: siete días para el
    -- agradecimiento y la reseña, y después no abre más.
    update tokens_reserva t
       set estado = 'finalizado',
           expira_at = coalesce(t.expira_at, (z.fecha + interval '7 days'))
      from registros r
     where r.id = t.registro_id
       and r.fecha = z.fecha
       and r.estado = 'completada'
       and t.estado <> 'expirado';
  end if;

  perform set_config('daypass.operacion_sistema', 'off', true);
  return z;
end;
$$ language plpgsql security definer;

-- ── 1g. Mover el cierre de cocina: coordinación y administración ──
create or replace function fijar_cierre_cocina(p_fecha date, p_hora time default null)
returns json as $$
declare
  d dias_operativos;
begin
  if not (puedo_administrar() or tiene_rol('asesora')) then
    raise exception 'El cierre de cocina lo mueve la coordinación'
      using errcode = '42501';
  end if;

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

-- ── 1h. Marcar la revisión de cocina: la isla o el mesero ──
-- La 013 lo dice: "lo marca quien se lo lleva — la isla o el mesero". El
-- mesero entra al candado aunque hoy no tenga la pantalla, porque esa es la
-- intención escrita. `revision_cocina` (la lectura) se queda como está: un
-- conteo de platos no es secreto para nadie del equipo.
create or replace function marcar_revision_cocina(p_fecha date, p_conteo jsonb)
returns json as $$
declare
  d dias_operativos;
begin
  if not (puedo_operar_isla() or tiene_rol('mesero')) then
    raise exception 'La revisión de cocina la marca quien está en la isla'
      using errcode = '42501';
  end if;

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

-- ── 1i. La conciliación del regreso: nombres, solo para quien recibe ──
-- Mismo truco que cuentas_sin_perfil en la 015: la condición va en el WHERE y
-- a quien no le toca le responde vacío, sin reventar.
create or replace function conciliacion_del_dia(p_fecha date)
returns table (
  registro_id uuid,
  titular text,
  grupo text,
  lancha text,
  subieron integer,
  bajaron integer,
  faltan integer
) as $$
  select
    r.id,
    r.nombre_pasajero,
    r.nombre_grupo,
    l.nombre,
    coalesce(ida.n, 0)::integer,
    coalesce(vuelta.n, 0)::integer,
    (coalesce(ida.n, 0) - coalesce(vuelta.n, 0))::integer
  from registros r
  join lanchas l on l.id = r.lancha_id
  left join lateral (
    select count(*) as n
      from estado_embarques ee
      join zarpes z on z.id = ee.zarpe_id
     where ee.registro_id = r.id
       and z.fecha = p_fecha and z.sentido = 'ida'
       and ee.estado in ('check_in', 'walk_in')
  ) ida on true
  left join lateral (
    select count(*) as n
      from estado_embarques ee
      join zarpes z on z.id = ee.zarpe_id
     where ee.registro_id = r.id
       and z.fecha = p_fecha and z.sentido = 'regreso'
       and ee.estado = 'desembarque'
  ) vuelta on true
  where puedo_operar_muelle()
    and r.fecha = p_fecha
    and coalesce(ida.n, 0) > 0
  order by (coalesce(ida.n, 0) - coalesce(vuelta.n, 0)) desc, r.nombre_pasajero;
$$ language sql stable security definer;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · El check-in deja de borrar y reinsertar
--
-- El delete masivo chocaba con la inmutabilidad de embarques: en cuanto el
-- muelle marcaba el primer check_in, TODO guardado posterior de esa reserva
-- fallaba con el error crudo del trigger. Ahora se empareja por id:
--
--   · item con id de esta reserva  → UPDATE (y `almuerza` ni se toca: la
--     excepción marcada se conserva sola, sin el malabar de come_previo)
--   · item sin id                  → INSERT (almuerza usa su default: come)
--   · fila que salió de la lista   → DELETE, y solo si no tiene embarque;
--     si ya embarcó, mensaje claro en vez del error del trigger
-- ════════════════════════════════════════════════════════════

create or replace function guardar_pasajeros_por_token(p_token text, p_pasajeros json)
returns json as $$
declare
  r registros;
  dia dias_operativos;
  item json;
  pid uuid;
  ids_recibidos uuid[] := '{}';
  embarcado text;
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

  for item in select * from json_array_elements(p_pasajeros) loop
    if coalesce(trim(item ->> 'nombre'), '') = '' then
      continue;
    end if;

    -- El id viene del propio reserva_publica; cualquier otra cosa se ignora.
    pid := null;
    if coalesce(item ->> 'id', '')
       ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select p.id into pid from pasajeros p
       where p.id = (item ->> 'id')::uuid
         and p.registro_id = r.id;   -- de ESTA reserva, no de otra
    end if;

    if pid is not null then
      update pasajeros set
        nombre = trim(item ->> 'nombre'),
        tipo_documento = nullif(item ->> 'tipo_documento', '')::tipo_documento,
        documento = nullif(trim(item ->> 'documento'), ''),
        pais_id = nullif(item ->> 'pais_id', '')::uuid,
        categoria = coalesce(nullif(item ->> 'categoria', ''), 'adulto')::categoria_pasajero,
        opcion_plato_id = nullif(item ->> 'opcion_plato_id', '')::uuid,
        restriccion_alimentaria = nullif(trim(item ->> 'restriccion_alimentaria'), '')
      where id = pid;
    else
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
      )
      returning id into pid;
    end if;

    ids_recibidos := ids_recibidos || pid;
  end loop;

  -- Quitar de la lista a alguien que ya subió a la lancha no se hace desde el
  -- teléfono: el hecho del embarque queda. Se avisa con nombre propio.
  select p.nombre into embarcado
    from pasajeros p
   where p.registro_id = r.id
     and p.id <> all (ids_recibidos)
     and exists (select 1 from embarques e where e.pasajero_id = p.id)
   limit 1;
  if embarcado is not null then
    raise exception '% ya embarcó y no se puede quitar de la lista desde aquí. En el muelle te ayudan con el cambio.', embarcado
      using errcode = 'check_violation';
  end if;

  delete from pasajeros p
   where p.registro_id = r.id
     and p.id <> all (ids_recibidos);

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
-- BLOQUE 3 · La tabla registros deja de mostrar la plata
--
-- Leer la tabla cruda es leer precios: solo quien puede ver plata. El resto
-- del equipo lee la vista `reservas` — que es lo que la app hace desde la 015.
--
-- Efecto lateral asumido: Realtime respeta la RLS, así que la isla y el
-- mesero dejan de recibir eventos de `registros` por el canal. El front lo
-- compensa escuchando también `embarques` (los callbacks solo refrescan, no
-- usan el payload — que era justamente por donde se les filtraba la fila
-- entera con precios).
-- ════════════════════════════════════════════════════════════

drop policy if exists registros_lectura on registros;
create policy registros_lectura on registros for select to authenticated
  using (puedo_ver_dinero());

-- Escribir la tabla es de quien vende. El muelle y la isla mueven estados a
-- través de las funciones de arriba, que son DEFINER y no pasan por aquí —
-- el `puedo_operar_*` que había en esta política no protegía: abría.
drop policy if exists registros_cambio on registros;
create policy registros_cambio on registros for update to authenticated
  using (tiene_rol('super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial'))
  with check (tiene_rol('super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial'));


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Las vistas
-- ════════════════════════════════════════════════════════════

-- ── reservas: pasa a correr como su dueño, con el filtro adentro ──
-- Antes era security_invoker y se apoyaba en la RLS de registros; con la
-- lectura de la tabla restringida a quien ve plata, eso dejaría a la isla sin
-- filas. Como dueña se salta la RLS, así que el filtro de equipo va aquí
-- mismo — y el enmascaramiento sigue siendo por fila, con puedo_ver_dinero().
create or replace view reservas as
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
from registros r
where soy_del_equipo();

alter view reservas reset (security_invoker);

comment on view reservas is
  'Lo mismo que registros, con los precios en null para quien no puede verlos '
  'y filtrada al equipo. Corre como su dueña (018): la tabla cruda ya solo la '
  'lee quien ve plata, así que el filtro vive aquí. La app lee esto; escribe '
  'contra registros.';

revoke all on reservas from public, anon;
grant select on reservas to authenticated;

-- ── estado_embarques: se acabó el túnel ──
-- Con security_invoker la RLS de embarques aplica a quien consulta: el equipo
-- la sigue leyendo igual (tiene select sobre embarques desde la 015) y anon
-- se queda sin nada — que además pierde el grant.
alter view estado_embarques set (security_invoker = true);

revoke all on estado_embarques from public, anon;
grant select on estado_embarques to authenticated;

comment on view estado_embarques is
  'El último evento de cada persona por zarpe. security_invoker desde la 018: '
  'las vistas no tienen RLS y esta corría como su dueño con el grant por '
  'defecto — nombres y documentos legibles con la clave anon del navegador.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 · anotar() vuelve a ser de las funciones
--
-- Estaba concedida a authenticated y el front nunca la llama: cualquier
-- usuario podía escribir acciones arbitrarias en la bitácora (con su propio
-- nombre — no suplanta, pero ensucia). La llaman las funciones DEFINER, que
-- corren como el dueño y no necesitan el grant.
-- ════════════════════════════════════════════════════════════

revoke all on function anotar(text, text, text, date, jsonb) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 · Permisos de lo redefinido
--
-- create or replace restablece los permisos: todo lo tocado arriba se vuelve
-- a cerrar y se abre solo lo que corresponde.
-- ════════════════════════════════════════════════════════════

revoke all on function cerrar_tentativo(date)                  from public, anon;
revoke all on function cerrar_dia(date)                        from public, anon;
revoke all on function cambiar_estado_manual(uuid, text, text) from public, anon;
revoke all on function programar_zarpes(date, time)            from public, anon;
revoke all on function programar_regresos(date, time)          from public, anon;
revoke all on function cerrar_zarpe(uuid)                      from public, anon;
revoke all on function fijar_cierre_cocina(date, time)         from public, anon;
revoke all on function marcar_revision_cocina(date, jsonb)     from public, anon;
revoke all on function conciliacion_del_dia(date)              from public, anon;

grant execute on function cerrar_tentativo(date)                  to authenticated;
grant execute on function cerrar_dia(date)                        to authenticated;
grant execute on function cambiar_estado_manual(uuid, text, text) to authenticated;
grant execute on function programar_zarpes(date, time)            to authenticated;
grant execute on function programar_regresos(date, time)          to authenticated;
grant execute on function cerrar_zarpe(uuid)                      to authenticated;
grant execute on function fijar_cierre_cocina(date, time)         to authenticated;
grant execute on function marcar_revision_cocina(date, jsonb)     to authenticated;
grant execute on function conciliacion_del_dia(date)              to authenticated;

-- La del check-in es de la puerta pública: anon TIENE que poder ejecutarla.
revoke all on function guardar_pasajeros_por_token(text, json) from public;
grant execute on function guardar_pasajeros_por_token(text, json) to anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- Comprobaciones. Cualquier fallo revierte la migración entera.
-- ════════════════════════════════════════════════════════════

do $$
declare
  cuantas integer;
  abiertas text;
  filtro text;
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

  -- 2. Ninguna vista legible por anon.
  select count(*), string_agg(c.relname, ', ')
    into cuantas, abiertas
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'v'
     and has_table_privilege('anon', c.oid, 'select');
  if cuantas > 0 then
    raise exception 'anon puede leer % vista(s): %', cuantas, abiertas;
  end if;

  -- 3. estado_embarques quedó security_invoker; reservas quedó como dueña.
  if not exists (
    select 1 from pg_class
     where relname = 'estado_embarques'
       and relnamespace = 'public'::regnamespace
       and 'security_invoker=true' = any(coalesce(reloptions, '{}'))
  ) then
    raise exception 'estado_embarques sigue corriendo como su dueño';
  end if;
  if exists (
    select 1 from pg_class
     where relname = 'reservas'
       and relnamespace = 'public'::regnamespace
       and 'security_invoker=true' = any(coalesce(reloptions, '{}'))
  ) then
    raise exception 'reservas sigue siendo security_invoker: la isla se quedó sin filas';
  end if;

  -- 4. La tabla cruda quedó detrás de puedo_ver_dinero().
  select qual into filtro
    from pg_policies
   where schemaname = 'public' and tablename = 'registros'
     and policyname = 'registros_lectura';
  if filtro is null or position('puedo_ver_dinero' in filtro) = 0 then
    raise exception 'registros_lectura no quedó restringida a quien ve plata: %',
      coalesce(filtro, '(sin política)');
  end if;

  -- 5. anotar() quedó cerrada para authenticated.
  if has_function_privilege('authenticated',
       'anotar(text, text, text, date, jsonb)'::regprocedure, 'execute') then
    raise exception 'anotar() sigue abierta para authenticated';
  end if;

  raise notice 'Los roles se cumplen: funciones con candado, tabla sin plata, vistas sin túnel.';
end $$;
