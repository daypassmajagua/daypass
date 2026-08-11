-- ════════════════════════════════════════════════════════════════════════════
-- Por qué se demora
--
-- **Solo lee. No cambia nada.** Se puede correr en producción con gente
-- trabajando.
--
-- Se escribe esto y no se adivina porque «está lento» tiene cinco causas
-- posibles y cuatro de ellas se arreglan de formas incompatibles. Correr esto
-- y pegar la salida dice cuál es.
--
-- Cada bloque explica qué se está mirando y qué número sería malo.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · De qué tamaño es la base ────────────────────────────────────────────
--
-- Todo lo de abajo se lee distinto con 500 reservas que con 50.000. Esto es la
-- vara.

select 'registros' as tabla, count(*) as filas from registros
union all select 'pasajeros',  count(*) from pasajeros
union all select 'embarques',  count(*) from embarques
union all select 'personas',   count(*) from personas
union all select 'pagos',      count(*) from pagos
union all select 'bitacora',   count(*) from bitacora
order by filas desc;


-- ── 2 · La sospecha principal: las vistas de dinero ─────────────────────────
--
-- `saldos_reserva` llama a `valor_a_cobrar(r.id)` **dos veces por fila** y a
-- `pagado_de_reserva(r.id)` **otras dos**, y cada una de esas funciones hace su
-- propia consulta. Son cuatro sub-consultas por reserva, sobre la tabla
-- entera: la vista no filtra por fecha.
--
-- `cartera_por_organizacion` se construye encima, así que hereda el costo, y
-- lo hereda **antes** de filtrar por saldo.
--
-- Qué mirar: el `Execution Time` del final. Por encima de 1.000 ms esta es la
-- causa, y se arregla reescribiendo la vista para calcular una sola vez.

explain (analyze, buffers, format text)
select * from cartera_por_organizacion;


-- ── 3 · Lo mismo para las metas ─────────────────────────────────────────────
--
-- `avance_metas` hace `sum(valor_a_cobrar(reg.id))` sobre el rango de cada
-- meta. Con una meta por mes es un mes de reservas por fila de meta.

explain (analyze, buffers, format text)
select * from avance_metas;


-- ── 4 · La consulta del día, que es la que más se repite ────────────────────
--
-- Es la de «Hoy» y la de Reservas. Debería usar el índice por fecha y tardar
-- milisegundos. Si aquí aparece un `Seq Scan` sobre `registros`, falta índice.

explain (analyze, buffers, format text)
select * from reservas where fecha = current_date;


-- ── 5 · Qué índices hay, y cuáles no se usan nunca ──────────────────────────
--
-- `idx_scan = 0` en una base con uso quiere decir que ese índice no sirve para
-- lo que se consulta: ocupa espacio y frena cada escritura sin devolver nada.

select
  relname as tabla,
  indexrelname as indice,
  idx_scan as veces_usado,
  pg_size_pretty(pg_relation_size(indexrelid)) as tamano
from pg_stat_user_indexes
where schemaname = 'public'
order by idx_scan asc, pg_relation_size(indexrelid) desc
limit 30;


-- ── 6 · Las tablas que se leen enteras ──────────────────────────────────────
--
-- `seq_scan` alto con `seq_tup_read` enorme es una tabla que se recorre
-- completa una y otra vez. En `registros` o `pasajeros` eso es un índice que
-- falta.

select
  relname as tabla,
  seq_scan as lecturas_completas,
  seq_tup_read as filas_leidas_asi,
  idx_scan as lecturas_por_indice
from pg_stat_user_tables
where schemaname = 'public' and seq_scan > 0
order by seq_tup_read desc
limit 15;


-- ── 7 · Si `pg_stat_statements` está activo, lo que de verdad cuesta ────────
--
-- Es lo más útil de todo el archivo: dice qué consulta se lleva el tiempo, con
-- datos reales y no con suposiciones. Si la extensión no está, este bloque
-- devuelve un aviso y no falla.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_stat_statements') then
    raise notice 'pg_stat_statements está activo: corre la consulta de abajo.';
  else
    raise notice 'pg_stat_statements NO está activo. En Supabase se enciende en '
      'Database → Extensions. Es la forma más rápida de saber qué se demora.';
  end if;
end $$;

-- Descomentar si la extensión existe:
--
-- select
--   round(mean_exec_time)::text || ' ms' as promedio,
--   calls as veces,
--   round(total_exec_time / 1000)::text || ' s' as tiempo_total,
--   left(query, 120) as consulta
-- from pg_stat_statements
-- where query not ilike '%pg_stat%'
-- order by total_exec_time desc
-- limit 20;


-- ── 8 · Conexiones y esperas ────────────────────────────────────────────────
--
-- Si aquí hay consultas con minutos de antigüedad, el problema no es de
-- velocidad sino de algo bloqueado, y eso se ve distinto: la app no se
-- «demora», se queda.

select
  state,
  count(*) as cuantas,
  max(now() - query_start) as la_mas_vieja
from pg_stat_activity
where datname = current_database()
group by state
order by cuantas desc;
