-- ============================================================
-- DayPASS — 004 · Arreglo: la bitácora bloqueaba el guardado
-- Ejecutar DESPUÉS de 003_dia_operativo.sql
--
-- Qué pasaba: en 003 la tabla cambios_estado quedó con RLS activo y
-- solo política de lectura. El trigger que la escribe corre con los
-- permisos de quien hace el UPDATE, así que Postgres rechazaba el
-- INSERT en la bitácora y tumbaba el UPDATE entero. Editar una
-- reserva y cambiarle el estado fallaba con
-- "new row violates row-level security policy".
--
-- Cómo se arregla: la bitácora la escribe el sistema, no el usuario.
-- La función pasa a SECURITY DEFINER, que es además la propiedad que
-- se quiere: nadie puede falsificar ni borrar su propio rastro.
-- ============================================================

create or replace function registrar_cambio_estado()
returns trigger as $$
begin
  if new.estado is distinct from old.estado then
    insert into cambios_estado (
      registro_id, estado_anterior, estado_nuevo, origen, registrado_por
    ) values (
      new.id, old.estado, new.estado,
      case when coalesce(current_setting('daypass.operacion_sistema', true), 'off') = 'on'
           then 'sistema'::origen_cambio
           else 'manual'::origen_cambio end,
      auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Por la misma razón, el día se abre solo aunque quien cree la reserva
-- no tenga permiso de escribir en dias_operativos. Hoy la política es
-- abierta para todo autenticado, pero en 008_roles.sql deja de serlo.
create or replace function abrir_dia_si_no_existe()
returns trigger as $$
begin
  insert into dias_operativos (fecha)
  values (new.fecha)
  on conflict (fecha) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Y el marcado de cambios tardíos, que solo toca la fila que ya se
-- está actualizando pero necesita leer dias_operativos.
create or replace function marcar_cambio_tardio()
returns trigger as $$
declare
  estado_del_dia estado_dia;
  cambio_relevante boolean;
begin
  if coalesce(current_setting('daypass.operacion_sistema', true), 'off') = 'on' then
    return new;
  end if;

  select estado into estado_del_dia
  from dias_operativos where fecha = new.fecha;

  if estado_del_dia is null or estado_del_dia = 'planeando' then
    return new;
  end if;

  cambio_relevante :=
       new.adultos     is distinct from old.adultos
    or new.ninos       is distinct from old.ninos
    or new.infantes    is distinct from old.infantes
    or new.cortesias   is distinct from old.cortesias
    or new.plan_id     is distinct from old.plan_id
    or new.lancha_id   is distinct from old.lancha_id
    or new.fecha       is distinct from old.fecha
    or new.nombre_grupo is distinct from old.nombre_grupo
    or (new.estado is distinct from old.estado and new.estado = 'cancelada');

  if cambio_relevante then
    new.cambio_tardio    := true;
    new.cambio_tardio_at := now();
    new.cambio_tardio_por := auth.uid();
  end if;

  return new;
end;
$$ language plpgsql security definer;
