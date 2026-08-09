-- ════════════════════════════════════════════════════════════════════════════
-- 016 · Las dos políticas que se le escaparon a la 015
--
-- ── Qué pasó ────────────────────────────────────────────────────────────────
--
-- La 015 reemplazó el acceso total por políticas de rol, y para hacerlo
-- recorrió las tablas borrando políticas **por nombre**: `authenticated_full_
-- access`, `<tabla>_lectura`, `<tabla>_escritura`. Dos no se llamaban así:
--
--   · cambios_estado    → "authenticated_read"   (003:275)
--   · documentos_legales → "authenticated_read"   (008:140)
--
-- Y sobrevivieron.
--
-- ── Por qué importa ─────────────────────────────────────────────────────────
--
-- Las políticas permisivas se **suman con O**. Que la 015 haya puesto
--
--     create policy cambios_estado_lectura ... using (soy_del_equipo())
--
-- no restringe nada mientras al lado siga
--
--     create policy "authenticated_read" ... using (auth.role() = 'authenticated')
--
-- Basta que una diga que sí. Hoy no se nota, porque todo el que tiene sesión
-- tiene perfil activo y las dos condiciones dan lo mismo. Se notaría el primer
-- día que alguien se desactive desde la pantalla de Usuarios: `soy_del_equipo()`
-- diría que no y `auth.role()` diría que sí. Le quitas el acceso y sigue
-- leyendo el rastro de cambios de estado de todas las reservas.
--
-- Las dos son de solo lectura, así que no hubo hueco de escritura.
--
-- ── Por qué se borra por forma y no por nombre ──────────────────────────────
--
-- Borrar por nombre es justo lo que falló. Aquí se borra por lo que la política
-- **dice**: cualquiera cuya condición mencione `auth.role()`, que es la marca
-- del modelo viejo —"cualquiera con sesión puede"—. Después de la 015 ninguna
-- política legítima usa eso: las nuevas preguntan por el rol.
--
-- ── Por qué es seguro ───────────────────────────────────────────────────────
--
-- Las 26 tablas quedaron cubiertas por la 015, así que ninguna se queda sin
-- política al borrar estas. Aun así el bloque final lo comprueba y hace fallar
-- la migración entera si alguna tabla con RLS se quedara sin forma de leerse:
-- una tabla sin políticas no es una tabla protegida, es una tabla muerta.
--
-- Y `cambios_estado` no pierde su escritura: la hace el trigger
-- `registrar_cambio_estado`, que es SECURITY DEFINER desde la 004 justamente
-- para que nadie pueda falsificar ni borrar su propio rastro.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ── Borrar lo que quede del modelo viejo ──
do $$
declare
  p record;
  cuantas integer := 0;
begin
  for p in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') like '%auth.role()%'
         or coalesce(with_check, '') like '%auth.role()%')
     order by tablename, policyname
  loop
    execute format('drop policy if exists %I on %I', p.policyname, p.tablename);
    raise notice 'Fuera: %.% (acceso por sesión, no por rol)', p.tablename, p.policyname;
    cuantas := cuantas + 1;
  end loop;

  if cuantas = 0 then
    raise notice 'No quedaba ninguna. Nada que hacer.';
  end if;
end $$;


-- ── Comprobaciones ──
do $$
declare
  quedan text;
  sin_lectura text;
  cuantas integer;
  abiertas text;
begin
  -- 1. Ninguna política vive ya del "cualquiera con sesión".
  select string_agg(tablename || '.' || policyname, ', ' order by tablename)
    into quedan
    from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') like '%auth.role()%'
       or coalesce(with_check, '') like '%auth.role()%');
  if quedan is not null then
    raise exception 'Todavía hay políticas por sesión: %', quedan;
  end if;

  -- 2. Ninguna tabla se quedó sin forma de leerse. Sin esto, borrar de más
  --    dejaría una tabla con RLS y cero políticas: nadie lee nada y la
  --    pantalla que la usa aparece vacía sin decir por qué.
  select string_agg(c.relname, ', ' order by c.relname)
    into sin_lectura
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity
     and not exists (
       select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = c.relname
          and p.cmd in ('ALL', 'SELECT')
     );
  if sin_lectura is not null then
    raise exception 'Sin política de lectura: %', sin_lectura;
  end if;

  -- 3. La puerta pública sigue siendo de cinco. Esta migración no redefine
  --    funciones, pero la comprobación es la casa: en PostgreSQL
  --    `create or replace` restablece los permisos por defecto, y el defecto
  --    es que cualquiera pueda ejecutar.
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

  raise notice 'Listo. Todo acceso pasa por el rol.';
end $$;
