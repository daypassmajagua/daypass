-- ════════════════════════════════════════════════════════════════════════════
-- 027 · Canales y países: el bloqueo que nadie había visto
--
-- Apareció al preguntarse cuáles son «los catálogos reales» que faltan.
-- Resulta que dos de ellos **no se podían cargar de ninguna forma**:
--
--   · `registros.canal_id` es **NOT NULL** (001). Sin un canal no se puede
--     crear ni una reserva — y `canales` no tiene semilla en ninguna migración
--     ni pantalla en ninguna parte de la app.
--   · `paises` está igual de vacía, y la lista nominal de la Capitanía exige
--     el país de cada persona (regla 15). El manifiesto saldría sin
--     nacionalidad.
--
-- O sea: contra una base recién montada, **la primera reserva era imposible**.
-- En la demo no se notaba porque el mock trae los dos catálogos puestos, que
-- es exactamente la clase de diferencia entre demo y producción que hay que
-- cazar antes del piloto.
--
-- ── Qué se siembra y qué no ─────────────────────────────────────────────────
--
-- **Los canales, sí**: son los cinco de la operación y no cambian. Se siembran
-- con `on conflict do nothing`, así que si el hotel ya tenía los suyos no se
-- toca nada.
--
-- **Los países, los que hacen falta**: no los 195. Los del pasadía real —
-- Colombia y los quince de donde viene la gente— más un puñado de vecinos. Un
-- desplegable de 195 países en el muelle, a pleno sol y con una mano, es peor
-- que uno de veinte. Se pueden agregar más desde Configuración.
--
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Los canales de venta
-- ════════════════════════════════════════════════════════════

insert into canales (codigo, nombre) values
  ('directo',    'Directo'),
  ('agencia',    'Agencia'),
  ('mayorista',  'Mayorista'),
  ('hotel',      'Hotel'),
  ('corporativo','Corporativo')
on conflict (codigo) do nothing;

comment on table canales is
  'Por dónde entró la reserva. `registros.canal_id` es NOT NULL: sin canales '
  'no se puede crear ni una reserva, y hasta la 027 no había semilla ni '
  'pantalla — la primera reserva contra una base nueva era imposible.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Los países
--
-- Colombia de primera porque es la mayoría. El resto, de donde viene la gente
-- a las Islas del Rosario.
-- ════════════════════════════════════════════════════════════

insert into paises (codigo, nombre) values
  ('CO', 'Colombia'),
  ('US', 'Estados Unidos'),
  ('CA', 'Canadá'),
  ('MX', 'México'),
  ('AR', 'Argentina'),
  ('BR', 'Brasil'),
  ('CL', 'Chile'),
  ('PE', 'Perú'),
  ('EC', 'Ecuador'),
  ('PA', 'Panamá'),
  ('CR', 'Costa Rica'),
  ('VE', 'Venezuela'),
  ('ES', 'España'),
  ('FR', 'Francia'),
  ('DE', 'Alemania'),
  ('IT', 'Italia'),
  ('GB', 'Reino Unido'),
  ('NL', 'Países Bajos'),
  ('CH', 'Suiza'),
  ('PT', 'Portugal'),
  ('AU', 'Australia'),
  ('IL', 'Israel'),
  ('OT', 'Otro')
on conflict (codigo) do nothing;

comment on table paises is
  'La nacionalidad que la Capitanía exige en la lista nominal (regla 15). No '
  'están los 195 a propósito: un desplegable de 195 en el muelle, a pleno sol '
  'y con una mano, es peor que uno de veinte. Se agregan desde Configuración.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Que se puedan administrar
--
-- Las políticas de catálogo de la 015 los cubren para leer y para que los
-- edite quien administra. Se rehacen por si acaso, con el mismo criterio.
-- ════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['canales', 'paises'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_lectura on %I', t, t);
    execute format('drop policy if exists %I_escritura on %I', t, t);
    execute format(
      'create policy %I_lectura on %I for select to authenticated using (soy_del_equipo())', t, t);
    execute format(
      'create policy %I_escritura on %I for all to authenticated '
      'using (puedo_administrar() or tiene_rol(''asesora'')) '
      'with check (puedo_administrar() or tiene_rol(''asesora''))', t, t);
  end loop;
end $$;


-- ── Comprobaciones ──
do $$
declare
  cuantos integer;
  cuantas integer;
begin
  select count(*) into cuantos from canales;
  if cuantos = 0 then
    raise exception 'Sin canales no se puede crear una reserva';
  end if;

  select count(*) into cuantas from paises;
  if cuantas = 0 then
    raise exception 'Sin países el manifiesto de Capitanía sale incompleto';
  end if;

  select count(*) into cuantos
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantos <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5', cuantos;
  end if;

  raise notice 'Ya se puede crear una reserva: % canales, % países.',
    (select count(*) from canales), (select count(*) from paises);
end $$;
