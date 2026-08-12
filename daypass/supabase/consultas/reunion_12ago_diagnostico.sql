-- ════════════════════════════════════════════════════════════════════════════
-- Diagnóstico de la reunión del 12 de agosto — SOLO LECTURAS
--
-- Tres síntomas reportados por Daniela y las asesoras, y cada bloque de aquí
-- separa sus causas posibles. Se puede correr entero con gente trabajando:
-- no escribe nada, no llama funciones, no toca candados.
--
--   · Síntoma 10: «los nombres se borran al guardar la reserva»
--   · Síntoma  9: «no aparecen los almuerzos en el check-in»
--   · Síntoma  6: «no permite hacer el check-in / no envía el QR»
--
-- Cada bloque dice qué número sería malo. Pégame la salida completa.
-- ════════════════════════════════════════════════════════════════════════════


-- ── BLOQUE A · ¿Los nombres SÍ están en la base? (síntoma 10) ────────────────
--
-- Es la pregunta que separa las dos hipótesis:
--   · Si las reservas recientes TIENEN filas de pasajeros pero la pantalla las
--     muestra vacías → el fallo era de LECTURA (la consulta con el join de
--     países fallaba en silencio). Ya quedó blindado en el front: ahora avisa
--     y se niega a guardar encima.
--   · Si NO tienen filas → el fallo es de ESCRITURA (algo rechaza el insert)
--     y el bloque E dice quién puede ser.
select
  r.fecha,
  r.nombre_pasajero,
  r.tipo,
  (r.adultos + r.ninos + r.infantes + r.cortesias) as pax_planeados,
  count(p.id)                                      as nombres_guardados,
  r.created_at::date                               as creada
from registros r
left join pasajeros p on p.registro_id = r.id
where r.created_at > now() - interval '14 days'
group by r.id
order by r.created_at desc
limit 25;
-- MALO: reservas de grupo con pax_planeados > 1 y nombres_guardados = 0
--       DESPUÉS de que la asesora dijo haberlos escrito.


-- ── BLOQUE B · ¿El join de países funciona? (síntoma 10, hipótesis lectura) ──
--
-- La pantalla pide `pasajeros` con el join `paises (id, codigo, nombre)`.
-- Si PostgREST tiene DOS caminos entre esas tablas, el join es ambiguo y la
-- consulta falla — y el front (hasta hoy) pintaba la lista vacía sin avisar.
select
  conname as restriccion,
  conrelid::regclass as tabla,
  confrelid::regclass as apunta_a
from pg_constraint
where contype = 'f'
  and (confrelid = 'paises'::regclass or conrelid = 'pasajeros'::regclass)
order by tabla, restriccion;
-- MALO: más de UNA foreign key de `pasajeros` hacia `paises`.


-- ── BLOQUE C · ¿Hay platos que mostrar? (síntoma 9) ──────────────────────────
--
-- El check-in muestra los platos del plan de la reserva. Si el plan no tiene
-- filas en `opciones_plato`, el check-in no pregunta plato — por diseño para
-- planes tipo Diamond, pero un Gold sin platos cargados se ve exactamente
-- igual: «no aparecen los almuerzos».
select
  pl.nombre                                   as plan,
  pl.activo,
  count(op.id) filter (where op.activo)       as platos_activos,
  count(r.id)                                 as reservas_ultimos_14_dias
from planes pl
left join opciones_plato op on op.plan_id = pl.id
left join registros r on r.plan_id = pl.id and r.created_at > now() - interval '14 days'
group by pl.id
order by reservas_ultimos_14_dias desc;
-- MALO: un plan con reservas recientes y platos_activos = 0 cuando ese plan
--       SÍ ofrece elección de almuerzo. Se arregla sin código: los platos se
--       cargan en la ficha del plan (Configuración → Planes → el plan).


-- ── BLOQUE D · ¿Se puede completar el check-in? (síntoma 6) ──────────────────
--
-- El QR aparece AL COMPLETAR el check-in, y completarlo exige firmar sobre el
-- documento legal vigente (regla 12). Sin documento vigente no hay firma, sin
-- firma no hay cierre, sin cierre no hay QR: el síntoma «no envía el QR» y
-- «no permite hacer el check-in» pueden ser esta sola fila que falta.
select idioma, version, vigente, length(cuerpo) as tamano_del_texto, created_at::date
from documentos_legales
order by idioma, created_at desc;
-- MALO: cero filas con vigente = true (o tabla vacía). También es malo que
--       exista para 'es' y no para 'en': el check-in cambia de idioma.

-- La ventana tiene valores por defecto sanos aunque `ajustes` esté vacío,
-- pero se confirma qué hay:
select clave, valor from ajustes
where clave in ('checkin_cierra_hora', 'checkin_abre_dias')
order by clave;
-- MALO: checkin_abre_dias = 0, o una hora de cierre ya pasada de forma rara.

-- ¿Las reservas recientes tienen su enlace? El token nace por trigger al
-- crear la reserva; sin token no hay página que abrir ni QR que mostrar.
select
  count(*)                                   as reservas_14_dias,
  count(*) filter (where enlace_token is null) as sin_token
from registros
where created_at > now() - interval '14 days';
-- MALO: sin_token > 0.


-- ── BLOQUE E · ¿Quién podría rechazar el insert de pasajeros? (síntoma 10) ───
--
-- Solo si el bloque A mostró nombres_guardados = 0. Triggers y políticas que
-- tocan la tabla, para leerlos — NUNCA probarlos insertando.
select tgname as disparador, tgenabled as activo,
       pg_get_triggerdef(oid) as definicion
from pg_trigger
where tgrelid = 'pasajeros'::regclass and not tgisinternal
order by tgname;

select polname as politica, polcmd as comando,
       pg_get_expr(polqual, polrelid)      as usando,
       pg_get_expr(polwithcheck, polrelid) as con_check
from pg_policy
where polrelid = 'pasajeros'::regclass
order by polname;
-- MALO: una política de INSERT/ALL cuyo with_check pueda dar false para una
--       asesora, o un trigger BEFORE INSERT que no sea updated_at, la firma
--       de la 024 o el enlace de persona.


-- ── BLOQUE F · La casa, de pasada ────────────────────────────────────────────
-- Siempre que se mira producción se comprueba esto, cueste lo que cueste.
select count(*) as funciones_abiertas_a_anon,
       string_agg(p.proname, ', ' order by p.proname) as cuales
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prorettype <> 'trigger'::regtype
  and has_function_privilege('anon', p.oid, 'execute');
-- MALO: distinto de 5, o que la lista no sea exactamente reserva_publica,
--       marcar_token_abierto, guardar_pasajeros_por_token, firmar_por_token
--       y documento_vigente.
