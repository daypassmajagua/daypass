-- ════════════════════════════════════════════════════════════════════════════
-- 011 · El manifiesto de Capitanía y el regreso como cierre real
--
-- Dos cosas que faltaban para que un día se cierre sin abrir el Excel.
--
-- EL MANIFIESTO. La Capitanía de Puerto exige una lista nominal por zarpe:
-- nombre, identificación y país de cada persona a bordo, pasajeros y
-- tripulación. El modelo ya estaba completo desde la 007 —pilotos, empleados,
-- zarpe_empleados, zarpe_alojamiento—; lo que faltaba era el país en la vista
-- de embarques y el tipo de documento del walk-in.
--
-- El armado del documento NO vive aquí a propósito. El manifiesto se imprime
-- en el muelle, minutos antes de zarpar, donde puede no haber señal: si
-- dependiera de una función del servidor no saldría justo cuando se necesita.
-- Se arma en el navegador sobre la copia local (src/lib/manifiesto.js) y esta
-- migración solo se encarga de que los datos estén completos y bajen.
--
-- EL REGRESO. Hasta ahora la rama de regreso de cerrar_zarpe solo ponía la
-- hora. El regreso es el cierre de verdad: quien bajó terminó su pasadía, y su
-- enlace deja de servir para editar y pasa a durar siete días más —la ventana
-- del agradecimiento y la reseña—. Hoy `tokens_reserva.expira_at` no se
-- escribe nunca y ningún token llega a 'finalizado', así que todos los enlaces
-- son eternos. _reserva_de_token ya filtra por ambos: la puerta estaba puesta,
-- faltaba quien la cerrara.
--
-- Lo que NO hace: cerrar el día solo. Ese sello lleva nombre y hora de quien lo
-- puso (005), y con dos lanchas cerrar en la primera que vuelve sería mentira.
-- El día lo cierra una persona, cuando todas están de vuelta.
--
-- Idempotente. lock_timeout por el worker de Realtime, que sostiene
-- AccessShareLock sobre zarpes y embarques.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · La hora del regreso
-- ════════════════════════════════════════════════════════════

insert into ajustes (clave, valor, descripcion) values
  ('hora_regreso', '15:30',
   'Hora a la que la lancha sale de la isla de vuelta a La Bodeguita. Es la '
   'hora con que se programan los zarpes de regreso.')
on conflict (clave) do nothing;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Lo que le faltaba al walk-in
--
-- Un walk-in aparece en el muelle sin reserva y sube igual. Pero va en el
-- manifiesto como todos, y la Capitanía pide país y tipo de documento: hoy el
-- formulario solo pedía nombre, documento y categoría.
-- ════════════════════════════════════════════════════════════

alter table embarques
  add column if not exists tipo_documento tipo_documento;

-- Los mismos huecos, en las otras dos poblaciones que van a bordo. La
-- Capitanía pide nombre, identificación Y país de todos, sin distinguir quién
-- paga: el piloto y el huésped de alojamiento van en la lista igual que el
-- pasadía, y a ellos les faltaban columnas.
alter table pilotos
  add column if not exists tipo_documento tipo_documento,
  add column if not exists pais_id uuid references paises(id);

alter table zarpe_alojamiento
  add column if not exists tipo_documento tipo_documento;

-- Por defecto cédula: es lo que tiene un piloto colombiano, y dejarlo en
-- blanco obligaría a rellenar a mano un dato que ya se sabe.
update pilotos set tipo_documento = 'cc'
 where tipo_documento is null and documento is not null;

-- La vista deriva el estado actual del último evento. Gana el país y el tipo
-- de documento, que el manifiesto necesita y no estaban proyectados.
--
-- Las dos van AL FINAL: create or replace view solo permite añadir columnas
-- después de las que ya había. Meterlas en medio, junto a `documento`, donde
-- se leerían mejor, falla con "cannot change name of view column".
create or replace view estado_embarques as
select distinct on (e.zarpe_id, coalesce(e.pasajero_id::text, e.client_id::text))
  e.zarpe_id,
  e.pasajero_id,
  e.registro_id,
  e.client_id,
  e.evento as estado,
  e.nombre,
  e.documento,
  e.categoria,
  e.ocurrido_at,
  e.tipo_documento,
  e.pais_id
from embarques e
order by e.zarpe_id,
         coalesce(e.pasajero_id::text, e.client_id::text),
         e.ocurrido_at desc;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Programar los regresos
--
-- Solo vuelven las lanchas que fueron. Programar el regreso de una lancha que
-- nunca zarpó llenaría el muelle de zarpes vacíos que alguien tendría que
-- cerrar a mano.
-- ════════════════════════════════════════════════════════════

create or replace function programar_regresos(p_fecha date, p_hora time default null)
returns setof zarpes as $$
declare
  hora time := coalesce(
    p_hora,
    nullif(ajuste('hora_regreso', ''), '')::time,
    '15:30'::time
  );
begin
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

grant execute on function programar_regresos(date, time) to authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Cerrar el regreso es cerrar el día de esa gente
-- ════════════════════════════════════════════════════════════

create or replace function cerrar_zarpe(p_zarpe_id uuid)
returns zarpes as $$
declare
  z zarpes;
begin
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


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 · Quién se quedó en la isla
--
-- Subieron contra bajaron, por reserva. La pantalla del regreso lo pinta y la
-- coordinadora decide; el sistema no inventa que alguien volvió.
-- ════════════════════════════════════════════════════════════

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
  where r.fecha = p_fecha
    and coalesce(ida.n, 0) > 0
  order by (coalesce(ida.n, 0) - coalesce(vuelta.n, 0)) desc, r.nombre_pasajero;
$$ language sql stable security definer;

grant execute on function conciliacion_del_dia(date) to authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 · Que el manifiesto baje a la copia local
--
-- Sin esto el muelle no puede imprimir sin señal: los empleados y los alojados
-- de un zarpe viven en tablas que la precarga no leía.
-- ════════════════════════════════════════════════════════════

do $$ begin
  alter publication supabase_realtime add table zarpe_empleados;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table zarpe_alojamiento;
exception when duplicate_object then null; end $$;
