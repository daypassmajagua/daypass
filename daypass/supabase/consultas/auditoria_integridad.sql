-- ════════════════════════════════════════════════════════════════════════════
-- Auditoría del 8 de agosto de 2026 · Consultas de verificación
--
-- TODO ES SOLO LECTURA. Nada aquí modifica un dato, un permiso ni un estado.
-- Se corre bloque por bloque en el SQL Editor de Supabase y se pegan los
-- resultados en la conversación. Cada bloque dice qué revela y qué significa
-- que devuelva filas.
--
-- Los permisos se leen de pg_proc / pg_class — nunca se llama a una función a
-- ver qué pasa (así se cerró por error el día operativo del 9 de agosto).
--
-- "Hoy" se calcula aquí mismo con la zona de Colombia, para no depender de
-- hoy_bogota() ni de sus permisos:
--     (now() at time zone 'America/Bogota')::date
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════
-- A · SEGURIDAD
-- ════════════════════════════════════════════════════════════

-- ── A1 · Qué puede ejecutar anon hoy ──
-- Deben ser EXACTAMENTE cinco: reserva_publica, marcar_token_abierto,
-- guardar_pasajeros_por_token, firmar_por_token, documento_vigente.
-- Una de más es un hueco; una de menos es la página del cliente rota.
select p.proname as funcion
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prokind = 'f'
   and p.prorettype <> 'trigger'::regtype
   and has_function_privilege('anon', p.oid, 'execute')
 order by p.proname;


-- ── A2 · Qué puede ejecutar cualquier usuario del equipo ──
-- La 012 le concedió a `authenticated` TODAS las funciones de golpe (era lo
-- correcto entonces: urgía cerrarle la puerta a anon). La 015 apretó las
-- tablas por rol, pero nunca volvió sobre estas: como son SECURITY DEFINER,
-- pasan por debajo de la RLS. Esta lista dice qué puede disparar un mesero
-- con sesión, llamando la API directo: se esperan aquí cerrar_dia,
-- cerrar_tentativo, cambiar_estado_manual, programar_zarpes, cerrar_zarpe,
-- programar_regresos, fijar_cierre_cocina, marcar_revision_cocina — ninguna
-- comprueba rol por dentro (verificado en el código de las migraciones).
select p.proname as funcion,
       case when p.prosecdef then 'definer' else 'invoker' end as corre_como
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prokind = 'f'
   and p.prorettype <> 'trigger'::regtype
   and has_function_privilege('authenticated', p.oid, 'execute')
 order by p.proname;


-- ── A3 · Las vistas: quién las lee y cómo corren ──
-- Las vistas NO tienen RLS. Una vista sin `security_invoker` corre con los
-- permisos de su dueño (postgres), que se salta la RLS de las tablas de abajo.
--
-- `reservas` (015) es security_invoker: aunque anon tuviera el grant, la RLS
-- de registros le devuelve cero filas. Pero `estado_embarques` (006, ampliada
-- en 011) NO lo es, y Supabase concede select sobre lo nuevo de `public` a
-- anon y authenticated por defecto. Si la primera columna sale `true` para
-- estado_embarques, un anónimo con la clave del navegador puede leer nombres,
-- documentos y país de cada persona embarcada. Eso sería CRÍTICO.
select c.relname as vista,
       has_table_privilege('anon', c.oid, 'select')          as anon_puede_leer,
       has_table_privilege('authenticated', c.oid, 'select') as equipo_puede_leer,
       coalesce(array_to_string(c.reloptions, ', '), '(corre como el dueño)') as opciones
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relkind = 'v'
 order by c.relname;


-- ── A4 · RLS: que ninguna tabla quede sin candado ni con candado vacío ──
-- Primera consulta: tablas de public SIN RLS activa (deberían ser cero).
-- Segunda: tablas con RLS activa pero sin ninguna política — RLS sin política
-- niega todo, que es seguro pero delata algo a medio hacer.
select c.relname as tabla_sin_rls
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
   and not c.relrowsecurity
 order by c.relname;

select c.relname as tabla_con_rls_sin_politicas
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
   and c.relrowsecurity
   and not exists (select 1 from pg_policies p
                    where p.schemaname = 'public' and p.tablename = c.relname)
 order by c.relname;


-- ── A5 · Qué expone realmente cada política ──
-- Para leerlas todas de una vez: tabla, operación, y la condición textual.
-- Lo que hay que buscar al leerla: (1) que ninguna diga auth.role() —eso lo
-- barrió la 016—; (2) los `with check (true)`, que dejan escribir cualquier
-- contenido a quien pase el `using`.
select tablename as tabla, policyname as politica, cmd as operacion,
       qual as condicion_para_ver, with_check as condicion_para_escribir
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;


-- ── A6 · Que las funciones nuevas sigan naciendo cerradas ──
-- La 012 cambió el default. Si esto no devuelve una fila con "=X*/postgres"
-- (execute quitado a PUBLIC en funciones), el candado por defecto se perdió.
select pg_get_userbyid(d.defaclrole) as dueno,
       n.nspname as esquema,
       case d.defaclobjtype when 'f' then 'funciones' else d.defaclobjtype::text end as sobre,
       d.defaclacl as acl_por_defecto
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
 where n.nspname = 'public';


-- ════════════════════════════════════════════════════════════
-- B · INTEGRIDAD DE DATOS
-- ════════════════════════════════════════════════════════════

-- ── B1 · Pasadías pagadas "de cortesía" ──
-- El tipo de ingreso dice por qué entró (pasadía = pagando); la forma de pago
-- dice cómo paga. `pasadia` + `forma_pago = 'cortesia'` es una contradicción:
-- o era una cortesía mal capturada, o es una pasadía a la que nadie le va a
-- cobrar. /isla las muestra como "revisar antes de cobrar"; esto dice cuántas
-- son y cuáles, para decidir si es error de captura o costumbre que corregir.
select r.id, r.fecha, r.nombre_pasajero, r.estado, r.folio_zeus,
       r.adultos + r.ninos + r.infantes as pax
  from registros r
  join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
 where ti.codigo = 'pasadia'
   and r.forma_pago = 'cortesia'
 order by r.fecha desc;


-- ── B2 · Cortesías con folio (regla 18) ──
-- Las cortesías van SIN folio: recepción cobra el tiquete directamente. Una
-- cortesía con folio_zeus es o un folio fantasma en Zeus o una cortesía que
-- alguien va a intentar cobrar dos veces.
select r.id, r.fecha, r.nombre_pasajero, r.estado, r.folio_zeus
  from registros r
  join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
 where ti.codigo = 'cortesia'
   and nullif(trim(r.folio_zeus), '') is not null
 order by r.fecha desc;


-- ── B3 · Confirmadas de días pasados sin un solo nombre ──
-- La lista nominal es obligatoria por norma (Capitanía). Una reserva
-- confirmada de un día que ya pasó y sin ninguna fila en pasajeros significa
-- que ese día el manifiesto se completó por fuera del sistema — o no se
-- completó. Sirve para dimensionar cuánto se usa el conteo rápido sin nombres.
select r.id, r.fecha, r.nombre_pasajero, r.estado,
       r.adultos + r.ninos + r.infantes as pax_declarados
  from registros r
 where r.estado = 'confirmada'
   and r.fecha < (now() at time zone 'America/Bogota')::date
   and not exists (select 1 from pasajeros p where p.registro_id = r.id)
 order by r.fecha desc;

-- De paso: confirmadas de días pasados que se quedaron en 'confirmada' para
-- siempre. El regreso debería haberlas llevado a completada / noshow /
-- cancelada. Si esto devuelve muchas, el ciclo de estados no se está cerrando.
select r.fecha, count(*) as reservas_congeladas_en_confirmada
  from registros r
 where r.estado in ('confirmada', 'en_isla')
   and r.fecha < (now() at time zone 'America/Bogota')::date
 group by r.fecha
 order by r.fecha desc;


-- ── B4 · Tokens eternos ──
-- El enlace del cliente debe finalizar con el regreso (estado 'finalizado',
-- expira_at = fecha + 7 días — lo hace cerrar_zarpe del regreso desde la 011).
-- Un token de un día pasado que sigue 'activo' o 'check_in_abierto' y sin
-- expira_at es un enlace eterno: quien lo tenga sigue entrando a esa reserva.
select t.estado, count(*) as cuantos,
       count(*) filter (where t.expira_at is null) as sin_expira_at,
       min(r.fecha) as desde, max(r.fecha) as hasta
  from tokens_reserva t
  join registros r on r.id = t.registro_id
 where r.fecha < (now() at time zone 'America/Bogota')::date
   and t.estado not in ('finalizado', 'expirado')
 group by t.estado;


-- ── B5 · Zarpes y días que nadie cerró ──
-- Un zarpe de ida termina en 'zarpado'; uno de regreso, en 'regresado'. Todo
-- lo demás en un día pasado quedó a medio camino. Y un día operativo pasado
-- que no esté 'cerrado' dejó folios y agradecimientos sin disparar.
select z.fecha, z.sentido, z.estado, count(*) as zarpes
  from zarpes z
 where z.fecha < (now() at time zone 'America/Bogota')::date
   and z.estado <> 'cancelado'
   and not (z.sentido = 'ida'     and z.estado = 'zarpado')
   and not (z.sentido = 'regreso' and z.estado = 'regresado')
 group by z.fecha, z.sentido, z.estado
 order by z.fecha desc;

select d.fecha, d.estado
  from dias_operativos d
 where d.fecha < (now() at time zone 'America/Bogota')::date
   and d.estado <> 'cerrado'
 order by d.fecha desc;


-- ── B6 · Embarques que no apuntan a nadie ──
-- Todo embarque que no es walk-in debe señalar un pasajero o una reserva; la
-- restricción embarques_identifican_a_alguien lo exige desde la 006. Pero los
-- dos FK son `on delete set null`: si alguna vez un borrado pasó por encima,
-- quedaron filas anónimas en el registro de hechos del muelle. Deberían ser
-- cero; cada fila aquí es una persona que subió y ya no se sabe quién era.
select e.id, z.fecha, e.evento, e.ocurrido_at
  from embarques e
  join zarpes z on z.id = e.zarpe_id
 where e.evento <> 'walk_in'
   and e.pasajero_id is null
   and e.registro_id is null
 order by e.ocurrido_at desc;


-- ── B7 · Los infantes: el tamaño del error de cocina ──
-- Hasta la 014 el conteo asumía que los infantes no almuerzan (se dedujo de
-- que no pagan — regla 10: quién paga ≠ quién come). Cada infante de un día
-- ya operado es un almuerzo que la cocina no tuvo en el pronóstico. Esto
-- dimensiona cuántos platos faltaron históricamente y cuántos vienen.
select
  case when r.fecha < (now() at time zone 'America/Bogota')::date
       then 'días pasados (el error ya ocurrido)'
       else 'hoy y futuro (ya corregido en el conteo)' end as periodo,
  sum(r.infantes) as infantes_en_contadores,
  count(*) filter (where r.infantes > 0) as reservas_con_infantes
  from registros r
 where r.estado not in ('cancelada', 'noshow')
 group by 1;

-- Y los que tienen nombre propio en la lista:
select count(*) as pasajeros_marcados_infante
  from pasajeros p
 where p.categoria = 'infante';

-- Solapamiento pendiente de la Fase 3: pasajeros con categoria = 'cortesia',
-- el valor que mezcla el eje de edad con el de pago. Si hay filas aquí (o en
-- embarques), el enum no se puede apretar sin dejar el valor huérfano.
select 'pasajeros' as tabla, count(*) as filas_con_categoria_cortesia
  from pasajeros where categoria = 'cortesia'
union all
select 'embarques', count(*)
  from embarques where categoria = 'cortesia';
