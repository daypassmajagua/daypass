-- ════════════════════════════════════════════════════════════════════════════
-- Darle super_admin a una cuenta, desde el editor SQL
--
-- ── Cuándo se usa ───────────────────────────────────────────────────────────
--
-- Casi nunca. Los roles se reparten desde la pantalla Usuarios de la app, que
-- es donde tienen que vivir: queda claro quién lo hizo y no hace falta abrir
-- Supabase para una tarea de todos los días.
--
-- Esto es para el huevo y la gallina:
--
--   · la primera cuenta, cuando la 015 ya corrió y la cuenta se creó después,
--     así que la siembra no la alcanzó;
--   · el día que nadie con `super_admin` pueda entrar y haya que abrir la
--     puerta desde afuera.
--
-- No es una migración. Una migración describe la forma de la base; esto asigna
-- un rol a una persona, que es dato de operación — como una reserva. Por eso
-- vive aquí y no en `migrations/`.
--
-- ── Cómo se usa ─────────────────────────────────────────────────────────────
--
-- Cambiar las dos líneas marcadas y correr entero. Se puede repetir sin daño:
-- si la persona ya tiene perfil, le cambia el rol y la reactiva.
--
-- El editor SQL de Supabase corre como `postgres`, que es dueño de la tabla y
-- por eso se salta la RLS. Desde la app esto mismo lo bloquearía la política
-- `perfiles_escritura`, que exige `puedo_administrar()`.
-- ════════════════════════════════════════════════════════════════════════════

with quien as (
  select
    'rafael@aisacreative.com'::text as email,   -- ← la cuenta
    'Rafael'::text                  as nombre,  -- ← el nombre real y completo
    'super_admin'::rol_usuario      as rol      -- ← qué hace
)
insert into perfiles (user_id, nombre, rol)
select
  u.id,
  -- El nombre escrito arriba manda. Si se deja vacío, se cae a lo que haya en
  -- la cuenta y, en último caso, a la parte del correo antes de la arroba.
  coalesce(
    nullif(q.nombre, ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'nombre', ''),
    split_part(u.email, '@', 1)
  ),
  q.rol
from quien q
join auth.users u on lower(u.email) = lower(q.email)
on conflict (user_id) do update
   set rol    = excluded.rol,
       nombre = excluded.nombre,
       -- Reactivar es parte del rescate: si la cuenta se había desactivado,
       -- devolverle el rol sin esto no la dejaría entrar. `mi_rol()` solo
       -- responde para perfiles activos.
       activo = true;

-- Comprobar. Si esto sale vacío, el correo no coincide con ninguna cuenta:
-- revisar que esté bien escrito en Authentication → Users.
select p.nombre, p.rol, p.activo, u.email
  from perfiles p
  join auth.users u on u.id = p.user_id
 where lower(u.email) = lower('rafael@aisacreative.com');   -- ← la cuenta
