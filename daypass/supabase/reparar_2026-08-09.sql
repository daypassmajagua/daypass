-- ════════════════════════════════════════════════════════════════════════════
-- REPARACIÓN · El día 2026-08-09, que dejé tocado
--
-- Al comprobar qué funciones podía ejecutar la clave anon las llamé de verdad
-- contra producción, en vez de mirar los permisos en el catálogo. Error mío, y
-- de la peor clase: la respuesta se podía leer sin escribir nada.
--
-- Ya se revisó qué quedó y el alcance real es menor de lo que temí:
--
--   programar_zarpes    → NO creó nada. El zarpe de ida de Majagua 1 ya
--                         existía desde las 09:56 y tiene 9 embarques dentro;
--                         la llamada chocó contra el índice único
--                         zarpes_unicos (fecha, lancha_id, sentido, hora) y
--                         no insertó. Ese zarpe es trabajo de alguien y NO se
--                         toca.
--
--   programar_regresos  → SÍ creó uno: el zarpe de regreso
--                         70fae521-5af0-432b-a874-3cc14a3c4e5c, de las 15:30,
--                         vacío, creado a las 11:27 —la hora exacta del
--                         sondeo—. Ese es el que sobra.
--
--   cerrar_dia          → cerró el día. Queda con el sello puesto a nombre de
--                         'alguien', que es como nombre_de_quien_actua() firma
--                         a un anónimo. Ninguna persona cerró ese día.
--
-- No es una migración: se corre a mano, una vez, con la sesión de la
-- coordinadora.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Cómo quedó el día ────────────────────────────────────
-- Si 'cerrado_por_nombre' dice 'alguien', lo cerré yo desde anon: ninguna
-- persona con sesión firma así.

select fecha, estado, cerrado_at, cerrado_por_nombre,
       cerrado_tentativo_at, cerrado_tentativo_por_nombre
  from dias_operativos
 where fecha = '2026-08-09';


-- ── 2. Quitar el zarpe de regreso que sobra ─────────────────
-- Por id, no por criterio: es el único que se sabe que sobra, y una condición
-- amplia podría llevarse por delante uno legítimo. Las tres comprobaciones de
-- abajo son un cinturón: si alguien alcanzó a usarlo, no se borra.

delete from zarpes z
 where z.id = '70fae521-5af0-432b-a874-3cc14a3c4e5c'
   and z.estado = 'programado'
   and not exists (select 1 from embarques e         where e.zarpe_id = z.id)
   and not exists (select 1 from zarpe_empleados x   where x.zarpe_id = z.id)
   and not exists (select 1 from zarpe_alojamiento x where x.zarpe_id = z.id);


-- ── 3. Devolver el día a planeación ─────────────────────────
-- Deshace las cuatro columnas que escribe cerrar_dia. Dejar el sello puesto
-- diría que alguien cerró ese día, y no fue nadie.
--
-- La condición del nombre se protege sola: si el día lo cerró una persona de
-- verdad, esto no hace nada y hay que dejarlo como está.

update dias_operativos
   set estado = 'planeando',
       cerrado_at = null,
       cerrado_por = null,
       cerrado_por_nombre = null
 where fecha = '2026-08-09'
   and estado = 'cerrado'
   and coalesce(cerrado_por_nombre, 'alguien') = 'alguien';


-- ── 4. Comprobar ────────────────────────────────────────────
-- Debe quedar el día en 'planeando' y un solo zarpe: la ida con sus 9
-- embarques.

select fecha, estado, cerrado_por_nombre
  from dias_operativos
 where fecha = '2026-08-09';

select z.id, z.sentido, z.estado, l.nombre as lancha,
       (select count(*) from embarques e where e.zarpe_id = z.id) as embarques
  from zarpes z
  join lanchas l on l.id = z.lancha_id
 where z.fecha = '2026-08-09'
 order by z.created_at;
