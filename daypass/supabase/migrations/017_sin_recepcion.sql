-- ════════════════════════════════════════════════════════════════════════════
-- 017 · Fuera el rol de recepción
--
-- **Decisión del dueño (8 ago):** todo lo de la isla lo hace `admin_isla` o
-- quien esté de guardia ese día. `recepcion` existía por la regla 18 —recepción
-- cobra el tiquete de las cortesías directamente— pero en la práctica eso pasa
-- en la isla, no en un puesto aparte.
--
-- Un rol que nadie usa no es inofensivo: es un rol que alguien va a asignar por
-- error, y quien lo reciba verá menos de lo que necesita sin entender por qué.
--
-- ── Por qué el valor sigue en el enum ───────────────────────────────────────
--
-- PostgreSQL **no puede quitar un valor de un enum**. Se puede renombrar, no
-- borrar. Quitarlo de verdad obligaría a crear un tipo nuevo, migrar las
-- columnas y **borrar antes todo lo que dependa del tipo** — y de `tiene_rol()`
-- dependen las políticas de RLS de las 26 tablas. Habría que desmontar y volver
-- a montar la seguridad entera para un cambio cosmético.
--
-- Así que el valor se queda huérfano y **se cierra la puerta con un CHECK**: la
-- base rechaza asignarlo, que es lo que de verdad importa. El front ya no lo
-- ofrece; esto es lo que lo hace cumplir aunque alguien escriba directo contra
-- PostgREST.
--
-- ── Qué pasa con quien ya lo tuviera ────────────────────────────────────────
--
-- Pasa a `admin_isla`, que es quien hace ese trabajo ahora. No se le quita el
-- acceso a nadie: `admin_isla` ve todo lo que veía recepción y además Almuerzos.
--
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ── 1. Mover a quien lo tenga, antes de cerrar la puerta ──
do $$
declare movidos integer;
begin
  update perfiles
     set rol = 'admin_isla'::rol_usuario
   where rol = 'recepcion'::rol_usuario;

  get diagnostics movidos = row_count;
  if movidos > 0 then
    raise notice '% perfil(es) de recepción pasaron a admin_isla.', movidos;
  end if;
end $$;


-- ── 2. Cerrar la puerta ──
-- El CHECK va sobre la columna, no sobre el tipo: es lo único que PostgreSQL
-- deja hacer sin desmontar todo lo que depende del enum.
alter table perfiles drop constraint if exists perfiles_rol_vigente;
alter table perfiles add constraint perfiles_rol_vigente
  check (rol <> 'recepcion'::rol_usuario);

comment on constraint perfiles_rol_vigente on perfiles is
  'El rol de recepción se retiró el 8 de agosto de 2026: todo lo de la isla lo '
  'hace admin_isla o quien esté de guardia. El valor sigue en el enum porque '
  'PostgreSQL no deja quitarlo sin rehacer las políticas de las 26 tablas.';

comment on type rol_usuario is
  'Siete roles vigentes. `recepcion` está retirado y la restricción '
  'perfiles_rol_vigente impide asignarlo — no se pudo borrar del enum sin '
  'desmontar toda la RLS.';


-- ── 3. La bitácora conserva el rol con el que se actuó ──
-- Ahí NO se pone restricción: si alguien hizo algo siendo recepción, eso pasó y
-- el rastro lo dice. Una bitácora que se corrige deja de ser una bitácora.


-- ── Comprobaciones ──
do $$
declare
  quedan integer;
  cuantas integer;
  abiertas text;
begin
  select count(*) into quedan from perfiles where rol = 'recepcion'::rol_usuario;
  if quedan > 0 then
    raise exception 'Quedan % perfiles con recepción', quedan;
  end if;

  -- La casa: esta migración no redefine funciones, pero se comprueba igual.
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into cuantas, abiertas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5: %', cuantas, abiertas;
  end if;

  raise notice 'Siete roles. La isla la opera admin_isla o quien esté de guardia.';
end $$;
