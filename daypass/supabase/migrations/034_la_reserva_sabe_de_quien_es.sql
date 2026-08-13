-- ════════════════════════════════════════════════════════════════════════════
-- 034 · La reserva sabe de qué agencia es
--
-- `registros` tiene dos columnas para lo mismo desde la 001: `agencia_id` —una
-- referencia de verdad— y `agencia_nombre`, texto libre. **El formulario solo
-- escribía el texto.** La referencia existía, media app la leía, y nadie la
-- llenaba.
--
-- Eso no era cosmético. Con la reserva guardando un texto:
--
--   · La cartera agrupa deudores por cómo se escribió el nombre ese día. La
--     vista `cartera_por_organizacion` de la 023 lo dice en su propio
--     comentario: las reservas con nombre en texto «se agrupan por ese nombre:
--     no se pierden, pero» — y ahí «Aviatur» y «AVIATUR S.A.» son dos.
--   · Las comisiones de la 026 se liquidan por `organizacion_id`. Una reserva
--     sin `agencia_id` no entra en ninguna liquidación.
--   · Y las tarifas por tipo de cliente —lo que pidió Daniela el 12 de
--     agosto— no tienen de dónde colgarse: sin saber con qué agencia se trata,
--     no hay tarifa de esa agencia que aplicar.
--
-- El front ya quedó arreglado: al elegir una agencia del catálogo, la reserva
-- guarda su `id`. Esta migración arregla **lo que ya está guardado**.
--
-- ── Qué hace y qué NO hace ─────────────────────────────────────────────────
--
-- Empareja por nombre normalizado —sin tildes, sin mayúsculas, sin espacios
-- de más, sin los sufijos societarios que la gente escribe o no escribe— y
-- solo cuando el emparejamiento es **inequívoco**: si dos organizaciones
-- normalizan igual, no toca esa reserva. Un enlace equivocado mueve plata de
-- deudor: es peor que no enlazar.
--
-- **No borra `agencia_nombre`.** Se queda como estaba: es lo que se escribió,
-- y en las reservas que no se pudieron enlazar es el único dato que hay.
--
-- **No inventa organizaciones.** Un nombre que no está en el catálogo se queda
-- sin enlazar y sale en el informe del final para que alguien decida si esa
-- agencia existe de verdad.
--
-- Idempotente: correrla dos veces no cambia nada la segunda vez.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ── 1. Cómo se compara un nombre de agencia ──
-- Sin tildes, sin mayúsculas, sin puntuación, sin sufijos societarios y sin
-- espacios de más: «Aviatur S.A.S.» y «aviatur» son la misma casa.
create or replace function nombre_organizacion_norm(p_nombre text)
returns text as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        lower(translate(coalesce(p_nombre, ''),
          'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
        '\s+(s\.?a\.?s\.?|s\.?a\.?|ltda\.?|s\.?l\.?|e\.?u\.?|inc\.?|llc\.?)\s*$', '', 'g'),
      '[^a-z0-9]', '', 'g'),
    '');
$$ language sql immutable;

comment on function nombre_organizacion_norm(text) is
  'Nombre de organizacion comparable: sin tildes, mayusculas, puntuacion ni '
  'sufijo societario. Se usa para enlazar reservas viejas que guardaron el '
  'nombre en texto.';


-- ── 2. Enlazar lo que se pueda, sin adivinar ──
do $$
declare
  enlazadas integer;
  ambiguas integer;
begin
  -- Los nombres que normalizan igual en DOS organizaciones distintas: esos no
  -- se tocan. Enlazar mal mueve deuda de un deudor a otro.
  create temporary table _ambiguos on commit drop as
  select nombre_organizacion_norm(nombre) as norm
    from organizaciones
   where nombre_organizacion_norm(nombre) is not null
   group by 1
  having count(*) > 1;

  select count(*) into ambiguas from _ambiguos;

  update registros r
     set agencia_id = o.id
    from organizaciones o
   where r.agencia_id is null
     and nullif(trim(coalesce(r.agencia_nombre, '')), '') is not null
     and nombre_organizacion_norm(r.agencia_nombre) = nombre_organizacion_norm(o.nombre)
     and nombre_organizacion_norm(o.nombre) not in (select norm from _ambiguos);

  get diagnostics enlazadas = row_count;
  raise notice '% reservas quedaron enlazadas a su organizacion.', enlazadas;
  if ambiguas > 0 then
    raise notice '% nombres normalizan igual en varias organizaciones: esas se dejaron sin enlazar a proposito.', ambiguas;
  end if;
end $$;


-- ── 3. El índice que la memoria de agencia necesita ──
-- El formulario pregunta «las últimas 10 reservas de esta agencia» cada vez
-- que se elige una. Sin índice eso recorre la tabla entera.
create index if not exists registros_agencia_fecha_idx
  on registros (agencia_id, created_at desc)
  where agencia_id is not null;


-- ── Comprobaciones ──
do $$
declare
  sin_enlazar integer;
  con_nombre integer;
  ejemplos text;
  cuantas integer;
  abiertas text;
begin
  select count(*) into con_nombre
    from registros
   where nullif(trim(coalesce(agencia_nombre, '')), '') is not null;

  select count(*) into sin_enlazar
    from registros
   where agencia_id is null
     and nullif(trim(coalesce(agencia_nombre, '')), '') is not null;

  select string_agg(distinct agencia_nombre, ' · ') into ejemplos
    from (
      select agencia_nombre from registros
       where agencia_id is null
         and nullif(trim(coalesce(agencia_nombre, '')), '') is not null
       limit 12
    ) x;

  raise notice 'Reservas con nombre de agencia: %. Sin enlazar: %.', con_nombre, sin_enlazar;
  if sin_enlazar > 0 then
    raise notice 'Estos nombres no existen en el catalogo de organizaciones: %', ejemplos;
    raise notice 'No es un error: son agencias que nadie ha creado. Se crean en Configuracion y se vuelve a correr esta migracion.';
  end if;

  -- La casa: esta migración crea una función nueva y toda función nace con
  -- EXECUTE para PUBLIC.
  revoke all on function nombre_organizacion_norm(text) from public;
  grant execute on function nombre_organizacion_norm(text) to authenticated;

  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into cuantas, abiertas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberian ser 5: %', cuantas, abiertas;
  end if;

  raise notice 'La reserva ya sabe de quien es.';
end $$;
