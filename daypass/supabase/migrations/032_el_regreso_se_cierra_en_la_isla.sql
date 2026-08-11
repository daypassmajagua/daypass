-- ════════════════════════════════════════════════════════════════════════════
-- 032 · El regreso se cierra en la isla
--
-- **Decisión del dueño:** «El regreso lo gestiona en la isla la asesora de
-- turno o el admin de isla.»
--
-- Y ahí aparece un bloqueo que no se veía: **hoy la isla puede marcar que la
-- gente bajó, pero no puede cerrar el zarpe de regreso.**
--
--   · `embarques_alta` (015) deja insertar a `puedo_operar_muelle()` **o**
--     `puedo_operar_isla()`, así que `admin_isla` y quien esté de guardia de
--     isla sí pueden registrar cada `desembarque`.
--   · `cerrar_zarpe()` (018) exige `puedo_operar_muelle()`, donde `admin_isla`
--     no está y la guardia de isla tampoco.
--
-- Resultado: la isla hace todo el trabajo y al final necesita que alguien del
-- muelle apriete el botón. Y ese cierre no es un trámite — es el que marca
-- `completada`, invalida los enlaces y deja en `en_isla` a quien no bajó, que
-- es **la alerta de que alguien se quedó en la isla**.
--
-- ── Qué cambia, exactamente ────────────────────────────────────────────────
--
-- Solo el permiso, y solo para el regreso:
--
--   ida      → sigue siendo del muelle. Es quien ve subir a la gente.
--   regreso  → el muelle **o** la isla. Los dos ven bajar a alguien: uno en el
--              muelle de La Bodeguita, el otro en el muelle de la isla.
--
-- No se toca ni una línea de lo que el cierre hace. Se toca quién lo puede
-- pedir, que es lo único que estaba mal.
--
-- ── Lo que esto NO resuelve ────────────────────────────────────────────────
--
-- Sigue pendiente con Daniela, y es de operación y no de permisos: **el
-- regreso hereda la lista de la ida sin confirmarla**. Quién se devuelve del
-- equipo no tiene por qué ser quien fue, y en el regreso puede subir gente que
-- no estaba en la ida —alojamiento que termina estadía— y eso hoy no tiene
-- dónde registrarse. Las dos afectan el manifiesto de la Capitanía.
--
-- ── El permiso, otra vez ───────────────────────────────────────────────────
--
-- `create or replace` **restablece el `EXECUTE` para PUBLIC** (lección de la
-- 012). Se vuelve a revocar y se comprueba leyendo `pg_proc`, sin llamar a la
-- función.
--
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Quién puede cerrar qué
--
-- La función es la misma de la 018 salvo la guarda de arriba, que ahora
-- depende del sentido del zarpe. Se lee el zarpe antes de decidir, así que el
-- `select ... for update` sube por encima de la comprobación.
-- ════════════════════════════════════════════════════════════

create or replace function cerrar_zarpe(p_zarpe_id uuid)
returns zarpes as $$
declare
  z zarpes;
begin
  select * into z from zarpes where id = p_zarpe_id for update;
  if z is null then
    raise exception 'No existe ese zarpe' using errcode = 'no_data_found';
  end if;

  -- La ida la cierra el muelle; el regreso, el muelle o la isla.
  if z.sentido = 'ida' then
    if not puedo_operar_muelle() then
      raise exception 'La ida la cierra quien opera el muelle'
        using errcode = '42501';
    end if;
  else
    if not (puedo_operar_muelle() or puedo_operar_isla()) then
      raise exception 'El regreso lo cierra el muelle o la isla'
        using errcode = '42501';
    end if;
  end if;

  perform set_config('daypass.operacion_sistema', 'on', true);

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

comment on function cerrar_zarpe(uuid) is
  'Cierra un zarpe y arrastra sus consecuencias. La ida la cierra el muelle; '
  'el regreso lo cierra el muelle o la isla, porque desde la 032 el regreso '
  'se gestiona allá — la isla hacía todo el trabajo y necesitaba que alguien '
  'del muelle apretara el botón.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · El permiso que `create or replace` acaba de regalar
-- ════════════════════════════════════════════════════════════

revoke all on function cerrar_zarpe(uuid) from public, anon;
grant execute on function cerrar_zarpe(uuid) to authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Comprobación
--
-- Se lee `pg_proc`. No se cierra un zarpe de mentira para ver qué pasa.
-- ════════════════════════════════════════════════════════════

do $$
declare
  abierta boolean;
  equipo  boolean;
begin
  select has_function_privilege('anon', p.oid, 'execute'),
         has_function_privilege('authenticated', p.oid, 'execute')
    into abierta, equipo
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'cerrar_zarpe';

  if abierta then
    raise exception 'cerrar_zarpe quedó ejecutable por anon';
  end if;
  if not equipo then
    raise exception 'cerrar_zarpe quedó sin permiso para el equipo';
  end if;

  raise notice 'El regreso ya lo puede cerrar la isla. La ida sigue siendo del muelle.';
end $$;
