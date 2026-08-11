-- ════════════════════════════════════════════════════════════════════════════
-- 029 · Buscar a alguien por el número de su documento
--
-- Encontrado al probar la búsqueda global: **buscar por documento no
-- funcionaba**. No es que buscara mal — es que no encontraba a nadie.
--
-- ── Por qué ────────────────────────────────────────────────────────────────
--
-- `identificacion` se digita a mano y en la práctica se escribe con el tipo
-- adelante: «CC 1023456789», «PASS US-449821». De ahí sale
-- `personas.documento`, y `documento_norm` —la columna generada de la 020—
-- quita puntos y espacios pero **no las letras**: queda 'CC1023456789'.
--
-- `buscar_personas` comparaba con `like norm || '%'`, o sea *empieza por*. Y
-- nadie busca a una persona escribiendo «CC» primero: se escribe el número.
-- '1023456789' nunca empieza una cadena que arranca en 'CC'.
--
--   buscar «1023456789»  →  documento_norm like '1023456789%'  →  cero filas
--
-- ── El arreglo ─────────────────────────────────────────────────────────────
--
-- *Contiene* en vez de *empieza por*. Cubre los dos casos y uno más:
--
--   'CC1023456789'    ⊃ '1023456789'   ✓  el número solo
--   'CC1023456789'    ⊃ 'CC1023'       ✓  como se ve en pantalla
--   'PASSUS449821'    ⊃ '449821'       ✓  un pasaporte, donde recortar el
--                                          prefijo tampoco habría bastado
--
-- Se descartó quitar las letras del principio antes de comparar: con
-- 'PASSUS449821' dejaría 'US449821' y buscar '449821' seguiría fallando. El
-- prefijo no siempre es solo el tipo de documento.
--
-- El costo de *contiene* es que no usa índice. Con el volumen de este hotel
-- —miles de personas, nunca millones— y el resultado limitado a 25, es una
-- lectura secuencial de milisegundos. Cambiar eso por un índice trigram sería
-- pagar mantenimiento por una velocidad que nadie va a notar.
--
-- ── El permiso, otra vez ───────────────────────────────────────────────────
--
-- `create or replace` **restablece el `EXECUTE` para PUBLIC**. Es la lección
-- de la 012 y por eso esta migración vuelve a revocar y termina comprobando
-- que `anon` no la pueda ejecutar. La comprobación lee `pg_proc`; no llama a
-- la función a ver qué pasa.
--
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · La función
--
-- Igual que la de la 020 salvo la línea del documento. La condición de equipo
-- sigue dentro porque es DEFINER y se salta la RLS.
-- ════════════════════════════════════════════════════════════

create or replace function buscar_personas(p_texto text, p_limite integer default 8)
returns table (
  id uuid, nombre_completo text, tipo_documento tipo_documento, documento text,
  pais_id uuid, telefono text, email text, veces integer
) as $$
  select p.id, p.nombre_completo, p.tipo_documento, p.documento,
         p.pais_id, p.telefono, p.email,
         (select count(*)::integer from pasajeros pa where pa.persona_id = p.id)
    from personas p
   where soy_del_equipo()
     and length(coalesce(trim(p_texto), '')) >= 3
     and (
       -- Contiene, no empieza por: el número vive detrás del «CC».
       p.documento_norm like '%' || upper(regexp_replace(p_texto, '[^A-Za-z0-9]', '', 'g')) || '%'
       or lower(p.nombre_completo) like '%' || lower(trim(p_texto)) || '%'
     )
   order by (select count(*) from pasajeros pa where pa.persona_id = p.id) desc,
            p.nombre_completo
   limit least(coalesce(p_limite, 8), 25);
$$ language sql stable security definer set search_path = public;

comment on function buscar_personas(text, integer) is
  'Encuentra a una persona por nombre o por documento, desde tres letras. El '
  'documento se compara normalizado y por contenido: se digita «CC 1023456» y '
  'la gente busca «1023456», que hasta la 029 no encontraba nada.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · El permiso que `create or replace` acaba de regalar
-- ════════════════════════════════════════════════════════════

revoke all on function buscar_personas(text, integer) from public, anon;
grant execute on function buscar_personas(text, integer) to authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Comprobación
--
-- Se lee `pg_proc`, no se llama a la función: probar permisos ejecutando fue
-- lo que cerró el día operativo del 9 de agosto.
-- ════════════════════════════════════════════════════════════

do $$
declare
  abierta boolean;
  cerrada boolean;
begin
  select has_function_privilege('anon', p.oid, 'execute')
    into abierta
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'buscar_personas';

  if abierta then
    raise exception 'buscar_personas quedó ejecutable por anon';
  end if;

  select has_function_privilege('authenticated', p.oid, 'execute')
    into cerrada
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'buscar_personas';

  if not cerrada then
    raise exception 'buscar_personas quedó sin permiso para el equipo';
  end if;

  raise notice 'buscar_personas: cerrada a anon, abierta al equipo. Ya encuentra por el número.';
end $$;
