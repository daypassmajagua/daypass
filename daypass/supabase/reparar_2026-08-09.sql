-- ════════════════════════════════════════════════════════════════════════════
-- REPARACIÓN · El día 2026-08-09, que dejé tocado
--
-- Al comprobar qué funciones podía ejecutar la clave anon las llamé de verdad
-- contra producción, en vez de mirar los permisos en el catálogo. Tres de esas
-- llamadas escribieron:
--
--   1. programar_zarpes('2026-08-09')    → creó zarpes de ida
--   2. programar_regresos('2026-08-09')  → creó zarpes de regreso
--   3. cerrar_dia('2026-08-09')          → CERRÓ el día operativo
--
-- Fue mi error, y de la peor clase: probar en la base real algo cuya respuesta
-- podía leerse sin escribir nada.
--
-- Este archivo NO es una migración. Se corre a mano, una vez, y revisando cada
-- bloque antes: si mañana 9 de agosto sí había zarpes de verdad, borrarlos
-- sería peor que dejarlos.
--
-- Correr con la sesión de la coordinadora, no con anon.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Mirar primero, decidir después ───────────────────────
-- Cómo quedó el día y qué zarpes tiene. Si algún zarpe tiene embarques, NO se
-- borra: eso es trabajo real de alguien.

select d.fecha, d.estado, d.cerrado_at, d.cerrado_por_nombre,
       d.cerrado_tentativo_at, d.cerrado_tentativo_por_nombre
  from dias_operativos d
 where d.fecha = '2026-08-09';

select z.id, z.sentido, z.estado, z.hora_programada,
       l.nombre as lancha,
       z.created_at,
       (select count(*) from embarques e where e.zarpe_id = z.id) as embarques
  from zarpes z
  join lanchas l on l.id = z.lancha_id
 where z.fecha = '2026-08-09'
 order by z.created_at;


-- ── 2. Devolver el día a planeación ─────────────────────────
-- 'cerrar_dia' escribe estado, hora y nombre. Se deshacen los tres: dejar el
-- sello puesto diría que alguien cerró ese día, y no fue nadie.
--
-- Correr SOLO si el bloque 1 muestra el día en 'cerrado' con cerrado_por_nombre
-- en 'alguien' — que es como nombre_de_quien_actua() firma a un anónimo.

-- update dias_operativos
--    set estado = 'planeando',
--        cerrado_at = null,
--        cerrado_por = null,
--        cerrado_por_nombre = null
--  where fecha = '2026-08-09'
--    and estado = 'cerrado'
--    and coalesce(cerrado_por_nombre, 'alguien') = 'alguien';


-- ── 3. Borrar los zarpes que creé, y solo esos ──────────────
-- Un zarpe con embarques es trabajo de alguien y se queda. Uno vacío,
-- programado y creado hoy, es de mi sondeo.
--
-- Ajustar la fecha de created_at a la de la comprobación antes de correrlo.

-- delete from zarpes z
--  where z.fecha = '2026-08-09'
--    and z.estado = 'programado'
--    and z.created_at::date = current_date
--    and not exists (select 1 from embarques e where e.zarpe_id = z.id)
--    and not exists (select 1 from zarpe_empleados x where x.zarpe_id = z.id)
--    and not exists (select 1 from zarpe_alojamiento x where x.zarpe_id = z.id);


-- ── 4. Comprobar que quedó como estaba ──────────────────────

-- select fecha, estado from dias_operativos where fecha = '2026-08-09';
-- select count(*) as zarpes from zarpes where fecha = '2026-08-09';
