-- ============================================================
-- DayPASS — 005 · El sello del cierre lleva nombre
-- Ejecutar DESPUÉS de 004_arreglo_bitacora.sql
--
-- Después de cerrar, la pantalla del día muestra un sello visible:
-- "Cerrado a las 7:42 p.m. por Rafa". El uuid de auth.users no sirve
-- para eso —el cliente no puede leer esa tabla— así que el nombre se
-- guarda junto al cierre, tomado del token de quien lo hizo.
--
-- Queda denormalizado a propósito: el sello debe seguir diciendo
-- quién cerró aunque esa persona cambie de nombre o deje el hotel.
-- ============================================================

alter table dias_operativos
  add column cerrado_tentativo_por_nombre text,
  add column cerrado_por_nombre text;

-- Nombre legible de quien hace la acción, con lo que traiga el token.
create or replace function nombre_de_quien_actua()
returns text as $$
  select coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'nombre', ''),
    nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''),
    'alguien'
  );
$$ language sql stable;

create or replace function cerrar_tentativo(p_fecha date)
returns dias_operativos as $$
declare
  dia dias_operativos;
begin
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

create or replace function cerrar_dia(p_fecha date)
returns dias_operativos as $$
declare
  dia dias_operativos;
begin
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
