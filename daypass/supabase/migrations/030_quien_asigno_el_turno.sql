-- ════════════════════════════════════════════════════════════════════════════
-- 030 · Quién asignó el turno
--
-- Encontrado al construir la pantalla de turnos: `guardias` tiene **dos
-- columnas para el mismo dato** y la que mejor se llama está siempre vacía.
--
--   · `asignada_por` / `asignada_at` — las de la 015. Nombres del negocio:
--     dicen exactamente lo que uno quiere saber cuando aparece en el turno del
--     sábado. Pero las tiene que mandar el cliente, y **nadie las manda**.
--   · `creado_por` / `actualizado_por` — las que la 024 le puso a las 29
--     tablas. Las sella el servidor con `auth.uid()`, así que son ciertas,
--     pero no dicen «asignada»: dicen «creada».
--
-- Una columna que se llama como la pregunta y siempre responde null es una
-- trampa para quien escriba el próximo informe: la va a usar, le va a dar
-- vacío, y va a concluir que nadie asigna turnos.
--
-- ── Qué se hace ────────────────────────────────────────────────────────────
--
-- Se queda la que mejor se llama y **la sella el servidor**, igual que la 024:
-- se ignora lo que mande el cliente, porque un autor que viaja desde el
-- aparato no es una firma. `asignada_at` se mueve con ella — reasignar un
-- turno es un hecho nuevo, no una edición del anterior.
--
-- No se borra nada (regla 5). `creado_por` y `actualizado_por` se quedan donde
-- están; lo que cambia es que `asignada_por` deja de mentir.
--
-- Y se rellena lo que ya había: las guardias creadas después de la 024 tienen
-- `creado_por` bueno, así que de ahí sale. Las de antes se quedan en null, que
-- es la verdad — en ese entonces no se registraba.
--
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · El sello
-- ════════════════════════════════════════════════════════════

create or replace function sellar_guardia()
returns trigger as $$
begin
  -- Se ignora lo que venga del cliente, como en la 024.
  new.asignada_por := auth.uid();
  new.asignada_at  := now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

comment on function sellar_guardia() is
  'Pone quién repartió el turno y cuándo, con la sesión del servidor. Va '
  'después del sello general de la 024 para que gane el nombre del negocio.';

-- El nombre lleva `z` adelante a propósito: PostgreSQL dispara los triggers
-- de la misma clase en orden alfabético, y este tiene que correr después de
-- `guardias_firma`, que es el de la 024.
drop trigger if exists z_guardias_asignacion on guardias;
create trigger z_guardias_asignacion before insert or update on guardias
  for each row execute function sellar_guardia();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Lo que ya estaba
-- ════════════════════════════════════════════════════════════

update guardias
   set asignada_por = creado_por
 where asignada_por is null
   and creado_por is not null;

comment on column guardias.asignada_por is
  'Quién repartió este turno. Lo sella el servidor desde la 030: hasta '
  'entonces la columna existía y nadie la llenaba, que es peor que no '
  'tenerla — parecía decir que nadie asigna turnos.';

comment on column guardias.asignada_at is
  'Cuándo se repartió. Se mueve al reasignar: poner a otra persona en el '
  'turno del sábado es un hecho nuevo, no una corrección del anterior.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Comprobación
--
-- Se leen los triggers en el catálogo; no se inserta una guardia de mentira
-- para ver qué pasa.
-- ════════════════════════════════════════════════════════════

do $$
declare
  cuantos integer;
  huerfanas integer;
begin
  select count(*) into cuantos
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
   where c.relname = 'guardias'
     and t.tgname = 'z_guardias_asignacion'
     and not t.tgisinternal;

  if cuantos <> 1 then
    raise exception 'El sello de la guardia no quedó puesto';
  end if;

  select count(*) into huerfanas
    from guardias where asignada_por is null and creado_por is not null;

  if huerfanas > 0 then
    raise exception 'Quedaron % guardias sin rellenar', huerfanas;
  end if;

  raise notice 'Las guardias ya dicen quién las repartió.';
end $$;
