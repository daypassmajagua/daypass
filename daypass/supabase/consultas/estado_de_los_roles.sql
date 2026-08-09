-- ════════════════════════════════════════════════════════════════════════════
-- ¿Quedó bien la 015?
--
-- Solo lectura. Todo sale de los catálogos del sistema: `pg_proc`, `pg_class`,
-- `pg_policies`. **Ninguna comprobación llama a una función para ver qué pasa**
-- — así se cerró por error un día operativo en producción el 9 de agosto.
--
-- Se puede correr cuando sea, y conviene después de cualquier migración que
-- redefina funciones: en PostgreSQL `create or replace` restablece los
-- permisos por defecto, y el defecto es que cualquiera pueda ejecutarlas.
--
-- La columna `bien` es la que se mira. Si alguna sale `false`, el detalle de
-- al lado dice qué falta.
-- ════════════════════════════════════════════════════════════════════════════

with
-- 1. La puerta pública. Solo estas cinco pueden llamarse sin sesión: son las
--    que usa el check-in del cliente desde su celular.
puerta as (
  select
    count(*) as cuantas,
    coalesce(string_agg(p.proname, ', ' order by p.proname), '(ninguna)') as cuales
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'execute')
),

-- 2. La vista que enmascara el dinero. `security_invoker` es lo que hace que
--    la RLS de `registros` siga aplicando por filas; sin eso la vista correría
--    como su dueño y se saltaría las políticas.
vista as (
  select
    to_regclass('public.reservas') is not null as existe,
    coalesce(
      (select true from pg_class c
        where c.relname = 'reservas' and c.relnamespace = 'public'::regnamespace
          and c.reloptions @> array['security_invoker=true']),
      false
    ) as con_invoker
),

-- 3. La política vieja: una sola para todo, "cualquiera con sesión puede
--    todo". Mientras quede una, esa tabla sigue abierta de par en par.
vieja as (
  select
    count(*) as cuantas,
    coalesce(string_agg(tablename, ', ' order by tablename), '') as donde
  from pg_policies
  where schemaname = 'public'
    and policyname in ('authenticated_full_access', 'authenticated_read', 'authenticated_insert')
),

-- 4. Nadie por fuera. Una cuenta sin perfil inicia sesión y no ve nada.
huerfanas as (
  select
    count(*) as cuantas,
    coalesce(string_agg(u.email, ', ' order by u.email), '') as cuales
  from auth.users u
  where not exists (select 1 from perfiles p where p.user_id = u.id)
),

-- 5. Quién hay y con qué rol.
equipo as (
  select
    count(*) filter (where activo) as activos,
    coalesce(string_agg(nombre || ' · ' || rol, ' | ' order by nombre)
             filter (where activo), '(nadie)') as quienes
  from perfiles
)

select * from (
  select 1 as n, 'Funciones abiertas a anon' as comprobacion,
         cuantas = 5 as bien,
         cuantas || ': ' || cuales as detalle
    from puerta
  union all
  select 2, 'La vista reservas existe',
         existe, case when existe then 'sí' else 'NO — la app no puede leer' end
    from vista
  union all
  select 3, 'La vista respeta la RLS por filas',
         con_invoker,
         case when con_invoker then 'security_invoker = true'
              else 'FALTA security_invoker: la vista se salta las políticas' end
    from vista
  union all
  select 4, 'Políticas viejas de acceso total',
         cuantas = 0,
         case when cuantas = 0 then 'ninguna' else cuantas || ' en: ' || donde end
    from vieja
  union all
  select 5, 'Cuentas sin perfil',
         cuantas = 0,
         case when cuantas = 0 then 'ninguna' else cuantas || ': ' || cuales end
    from huerfanas
  union all
  select 6, 'Gente en el equipo',
         activos > 0, activos || ' — ' || quienes
    from equipo
) t
order by n;
