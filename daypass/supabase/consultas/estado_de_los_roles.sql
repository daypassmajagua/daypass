-- ════════════════════════════════════════════════════════════════════════════
-- ¿Quedó bien la seguridad? (015 a 018)
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

-- 2. La vista que enmascara el dinero. Desde la 018 corre como su DUEÑA
--    (la tabla cruda ya solo la lee quien ve plata) y trae el filtro de
--    equipo adentro: `where soy_del_equipo()`. Si todavía fuera
--    security_invoker, la isla se quedaría sin filas.
vista as (
  select
    to_regclass('public.reservas') is not null as existe,
    coalesce(
      (select true from pg_class c
        where c.relname = 'reservas' and c.relnamespace = 'public'::regnamespace
          and c.reloptions @> array['security_invoker=true']),
      false
    ) as con_invoker,
    coalesce(
      (select true from pg_views v
        where v.schemaname = 'public' and v.viewname = 'reservas'
          and v.definition like '%soy_del_equipo%'),
      false
    ) as filtra_equipo,
    -- estado_embarques es lo contrario: TIENE que ser security_invoker, porque
    -- las vistas no tienen RLS y como dueña se salta la de embarques.
    coalesce(
      (select true from pg_class c
        where c.relname = 'estado_embarques' and c.relnamespace = 'public'::regnamespace
          and c.reloptions @> array['security_invoker=true']),
      false
    ) as embarques_invoker
),

-- 2b. Ninguna vista puede ser legible por anon: Supabase concede select sobre
--     lo nuevo de public por defecto, y por ahí se fueron los nombres y
--     documentos de estado_embarques hasta la 018.
vistas_anon as (
  select
    count(*) as cuantas,
    coalesce(string_agg(c.relname, ', ' order by c.relname), '') as cuales
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'v'
    and has_table_privilege('anon', c.oid, 'select')
),

-- 3. El modelo viejo: "cualquiera con sesión puede". Mientras quede una de
--    esas, la tabla sigue abierta — las políticas permisivas se suman con O,
--    así que basta que una diga que sí.
--
--    Se busca por lo que la política DICE, no por cómo se llama. Buscar por
--    nombre fue lo que dejó pasar dos en la 015: se llamaban
--    `authenticated_read` y el borrado iba por `authenticated_full_access`.
vieja as (
  select
    count(*) as cuantas,
    coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename), '') as donde
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual, '') like '%auth.role()%'
      or coalesce(with_check, '') like '%auth.role()%')
),

-- 4. Ninguna tabla con RLS puede quedarse sin política de lectura: sería una
--    tabla que nadie puede leer, y la pantalla que la usa saldría vacía sin
--    decir por qué.
mudas as (
  select
    count(*) as cuantas,
    coalesce(string_agg(c.relname, ', ' order by c.relname), '') as cuales
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
    )
),

-- 5. Nadie por fuera. Una cuenta sin perfil inicia sesión y no ve nada.
huerfanas as (
  select
    count(*) as cuantas,
    coalesce(string_agg(u.email, ', ' order by u.email), '') as cuales
  from auth.users u
  where not exists (select 1 from perfiles p where p.user_id = u.id)
),

-- 6. Quién hay y con qué rol.
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
  select 3, 'reservas corre como dueña y filtra al equipo',
         (not con_invoker) and filtra_equipo,
         case
           when con_invoker then 'sigue security_invoker: falta correr la 018'
           when not filtra_equipo then 'SIN filtro soy_del_equipo(): la vista muestra todo a cualquiera con select'
           else 'como dueña, con soy_del_equipo() adentro' end
    from vista
  union all
  select 8, 'estado_embarques respeta la RLS de embarques',
         embarques_invoker,
         case when embarques_invoker then 'security_invoker = true'
              else 'FALTA security_invoker: corre como dueña y se salta la RLS (018)' end
    from vista
  union all
  select 9, 'Vistas legibles por anon',
         cuantas = 0,
         case when cuantas = 0 then 'ninguna' else cuantas || ': ' || cuales end
    from vistas_anon
  union all
  select 4, 'Acceso por sesión en vez de por rol',
         cuantas = 0,
         case when cuantas = 0 then 'ninguna' else cuantas || ': ' || donde end
    from vieja
  union all
  select 5, 'Tablas con RLS y sin lectura',
         cuantas = 0,
         case when cuantas = 0 then 'ninguna' else cuantas || ': ' || cuales end
    from mudas
  union all
  select 6, 'Cuentas sin perfil',
         cuantas = 0,
         case when cuantas = 0 then 'ninguna' else cuantas || ': ' || cuales end
    from huerfanas
  union all
  select 7, 'Gente en el equipo',
         activos > 0, activos || ' — ' || quienes
    from equipo
) t
order by n;
