-- ════════════════════════════════════════════════════════════════════════════
-- 012 · URGENTE · Cerrar la puerta de las funciones
--
-- Hallazgo verificado contra la base de producción con la clave anon —la que
-- viaja en el navegador y cualquiera puede sacar del bundle—:
--
--   · cerrar_dia            → un anónimo CIERRA el día operativo
--   · cerrar_tentativo      → un anónimo cierra el tentativo
--   · cerrar_zarpe          → un anónimo cierra un zarpe
--   · programar_zarpes      → un anónimo CREA zarpes
--   · programar_regresos    → un anónimo crea zarpes de regreso
--   · cambiar_estado_manual → un anónimo cambia el estado de una reserva
--   · conciliacion_del_dia  → un anónimo LEE nombres de clientes
--
-- La causa: en PostgreSQL toda función nace con EXECUTE concedido a PUBLIC.
-- Como estas son SECURITY DEFINER —corren con los permisos del dueño—, la RLS
-- de las tablas no las detiene: son un túnel por debajo de ella. Escribir
-- `grant execute ... to authenticated` no cierra nada, porque el problema no
-- es lo que falta conceder sino lo que ya viene concedido de fábrica.
--
-- Las cinco de la puerta pública (008) sí estaban bien, porque allí se escribió
-- el revoke explícito. Las de 003, 005 y 006 nunca lo tuvieron. La 011 —mía—
-- repitió el error y de paso reabrió cerrar_zarpe al reemplazarla, porque
-- create or replace restablece los permisos por defecto.
--
-- Qué hace: cierra todo para anon y para PUBLIC, deja abiertas las cinco de la
-- página del cliente, y le concede a authenticated el resto. Eso último es
-- amplio a propósito: hoy toda política de RLS es authenticated_full_access, y
-- apretar por rol es la Fase G. Aquí se cierra la puerta de la calle, que es
-- la que está abierta.
--
-- NO toca las funciones de trigger. Se ejecutan solas al insertar o
-- actualizar, y tocarles los permisos es arriesgar que deje de guardarse una
-- reserva por un candado que no hacía falta.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Cerrado por defecto, abierto a propósito
--
-- Se revoca de PUBLIC además de anon: authenticated hereda de PUBLIC, así que
-- quitarlo solo de anon dejaría la puerta abierta por el otro lado el día que
-- aparezca un rol nuevo.
-- ════════════════════════════════════════════════════════════

do $$
declare
  f record;
  -- Las cinco de la página del cliente, que vive fuera del login. anon TIENE
  -- que poder ejecutarlas: son la única razón por la que anon existe.
  publicas text[] := array[
    'reserva_publica',
    'marcar_token_abierto',
    'guardar_pasajeros_por_token',
    'firmar_por_token',
    'documento_vigente'
  ];
begin
  for f in
    select p.oid::regprocedure as firma, p.proname as nombre
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       -- Las de trigger se quedan como están: las llama el sistema.
       and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);

    if f.nombre = any(publicas) then
      execute format('grant execute on function %s to anon', f.firma);
    end if;
  end loop;
end $$;

-- _reserva_de_token resuelve un token a su reserva completa, con precios y
-- todo. La usan por dentro las cinco públicas, que corren como el dueño; nadie
-- más tiene por qué llamarla.
revoke all on function _reserva_de_token(text) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Que no vuelva a pasar
--
-- El default de PostgreSQL es conceder a PUBLIC. Se cambia para este esquema:
-- de aquí en adelante una función nueva nace cerrada y hay que abrirla a
-- propósito. Es lo único que evita que el error se repita la próxima vez que
-- alguien escriba una migración con prisa.
-- ════════════════════════════════════════════════════════════

alter default privileges in schema public revoke execute on functions from public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Comprobación
--
-- Tiene que decir exactamente cinco. Cualquier otra cosa es un hueco.
-- ════════════════════════════════════════════════════════════

do $$
declare
  abiertas text;
  cuantas integer;
begin
  select string_agg(p.proname, ', ' order by p.proname), count(*)
    into abiertas, cuantas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');

  raise notice 'anon puede ejecutar % funciones: %', cuantas, coalesce(abiertas, '(ninguna)');

  if cuantas <> 5 then
    raise exception 'Se esperaban 5 funciones abiertas a anon y hay %: %', cuantas, abiertas;
  end if;
end $$;
