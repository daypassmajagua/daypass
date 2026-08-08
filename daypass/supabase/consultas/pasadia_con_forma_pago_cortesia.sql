-- ════════════════════════════════════════════════════════════════════════════
-- CONSULTA · Reservas cuyo tipo de ingreso y forma de pago se contradicen
--
-- Bloque 0 del plan v6. Solo lee: no cambia nada.
--
-- El caso: una reserva con `tipo_ingreso = 'pasadia'` y `forma_pago =
-- 'cortesia'` dice dos cosas incompatibles. Por la regla 11 el tipo de ingreso
-- manda —de ahí salen consume_cupo, consume_tiquete y genera_ingreso—, pero
-- alguien marcó la forma de pago como cortesía, y por la regla 18 una cortesía
-- no lleva folio.
--
-- /isla ya las muestra como "revisar antes de cobrar" en vez de elegir bando,
-- porque cobrarle a un invitado del hotel es el error que no se deshace. Lo
-- que falta es saber cuántas son, para decidir si es error de captura de una
-- persona o si el modelo no alcanza para algo que la operación sí hace.
--
-- Ojo: el código del tipo es `'pasadia'` SIN tilde (migración 007). El plan v6
-- lo escribe con tilde, pero en la base no la lleva.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. El panorama completo: qué combinaciones existen y cuántas hay ────────
-- Sirve para ver si la contradicción es un caso aislado o un patrón, y si hay
-- otras combinaciones raras que nadie ha mirado.

select
  coalesce(ti.codigo, '(sin tipo_ingreso)') as tipo_ingreso,
  coalesce(r.forma_pago, '(sin forma de pago)') as forma_pago,
  count(*) as reservas,
  sum(r.adultos + r.ninos + r.infantes + r.cortesias) as personas,
  min(r.fecha) as primera,
  max(r.fecha) as ultima
from registros r
left join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
group by 1, 2
order by reservas desc;


-- ── 2. El número que pide el bloque 0 ───────────────────────────────────────
-- Reservas que dicen cortesía en la forma de pago pero NO son cortesía por
-- tipo de ingreso. Incluye las que no tienen tipo_ingreso: `tipo_ingreso_id`
-- llegó en la migración 007, así que todo lo anterior lo tiene vacío y se
-- comporta como pasadía.

select count(*) as contradictorias
from registros r
left join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
where r.forma_pago = 'cortesia'
  and coalesce(ti.codigo, 'pasadia') <> 'cortesia';


-- ── 3. El caso inverso, que también importa ─────────────────────────────────
-- Marcadas como cortesía por tipo de ingreso pero con folio Zeus puesto. Por
-- la regla 18 una cortesía no lleva folio: recepción cobra el tiquete directo.

select count(*) as cortesias_con_folio
from registros r
join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
where ti.codigo = 'cortesia'
  and coalesce(trim(r.folio_zeus), '') <> '';


-- ── 4. Ejemplos, para mirarlos con nombre propio ────────────────────────────
-- Los más recientes primero: si el error es de captura, lo más probable es que
-- siga ocurriendo.

select
  r.fecha,
  r.nombre_pasajero,
  r.nombre_grupo,
  r.agencia_nombre,
  coalesce(ti.codigo, '(sin tipo)') as tipo_ingreso,
  r.forma_pago,
  r.folio_zeus,
  r.total_calculado,
  r.estado,
  r.vendida_por,
  r.observaciones
from registros r
left join tipos_ingreso ti on ti.id = r.tipo_ingreso_id
where r.forma_pago = 'cortesia'
  and coalesce(ti.codigo, 'pasadia') <> 'cortesia'
order by r.fecha desc
limit 10;


-- ── 5. Contexto: cuántas reservas hay en total y desde cuándo ───────────────
-- Sin esto, "hay 7 contradictorias" no dice si es mucho o poco.

select
  count(*) as reservas_totales,
  count(*) filter (where tipo_ingreso_id is null) as sin_tipo_ingreso,
  count(*) filter (where forma_pago is null) as sin_forma_pago,
  min(fecha) as desde,
  max(fecha) as hasta
from registros;


-- ── 6. Lo que hace falta para lo de los infantes ────────────────────────────
-- Cuántas personas vienen hoy marcadas como infante. Es el tamaño del error
-- que se está corrigiendo: cada una es un almuerzo que cocina no está
-- contando.

select
  count(*) filter (where r.infantes > 0) as reservas_con_infantes,
  coalesce(sum(r.infantes), 0) as infantes_en_reservas,
  (select count(*) from pasajeros p
     join registros r2 on r2.id = p.registro_id
    where p.categoria = 'infante') as pasajeros_marcados_infante
from registros r
where r.estado not in ('cancelada', 'noshow');
