-- ════════════════════════════════════════════════════════════════════════════
-- 020 · Fase 3 · Personas y organizaciones
--
-- Hasta hoy una persona que viene tres veces son tres filas de `pasajeros` sin
-- relación entre sí, y su documento se vuelve a digitar cada vez. Esta
-- migración le da identidad propia: `personas`, con el documento como llave.
--
-- ── El documento NO puede ser llave obligatoria, y por qué ──────────────────
--
-- `pasajeros.documento` es nulo y el check-in público lo guarda con
-- `nullif(trim(...), '')`: hay pasajeros con solo nombre, a propósito. Son las
-- plazas que el muelle nombra de afán y las que la Capitanía todavía no nos ha
-- dicho si acepta.
--
-- Así que la llave es **opcional y única cuando existe**. Quien trae documento
-- se vuelve persona y se reconoce la próxima vez; quien no, viaja igual y no
-- estorba. Una llave que obliga habría dejado por fuera justo a los casos que
-- más se repiten en el muelle.
--
-- El documento se compara **normalizado** —sin puntos, espacios ni guiones y en
-- mayúsculas— porque `1.023.456` y `1023456` son la misma persona, y en la
-- operación real se escriben de las dos formas.
--
-- ── El enlace se deduce, no se digita (regla 23) ────────────────────────────
--
-- Nadie va a acordarse de crear la persona antes del pasajero. Un trigger lo
-- hace: al guardar un pasajero con documento, si esa persona no existe se crea
-- y si existe se enlaza. Funciona igual desde la oficina, desde el muelle y
-- desde el celular del cliente, sin que ninguna de las tres lo sepa.
--
-- ── Lo que este archivo NO hace ─────────────────────────────────────────────
--
-- **No captura la autorización de tratamiento de datos.** Con esta migración
-- DayPASS pasa a ser formalmente una base de datos de personas (Ley 1581), y
-- esa autorización se recoge en el check-in sobre un texto que tiene que
-- redactar un abogado. El mecanismo ya existe —`documentos_legales` + `firmas`,
-- migración 008—: cuando llegue el texto se publica como documento vigente y
-- queda recogida sin tocar código. **Mientras tanto esto se puede construir y
-- probar, pero la ficha de personas no debería usarse para nada distinto de
-- operar el pasadía.**
--
-- **No toca `embarques`.** El walk-in que llega sin reserva se registra ahí y
-- no crea persona: `embarques` es append-only y el enlace se haría al
-- convertirlo en reserva, con calma, desde la oficina.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Personas
-- ════════════════════════════════════════════════════════════

create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  tipo_documento  tipo_documento,
  documento       text,

  -- La llave real. Generada: nadie la escribe y nadie la puede desincronizar.
  documento_norm text generated always as (
    nullif(upper(regexp_replace(coalesce(documento, ''), '[^A-Za-z0-9]', '', 'g')), '')
  ) stored,

  pais_id   uuid references paises(id),
  telefono  text,
  email     text,

  -- Texto libre a propósito, como `observaciones` (regla 2): no participa en
  -- cálculos ni informes. Sirve para "alérgica al maní" o "silla de ruedas".
  notas text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  creado_por      uuid references auth.users(id),
  actualizado_por uuid references auth.users(id)
);

comment on table personas is
  'Quién es cada quien, una sola vez. El documento es la llave natural pero es '
  'OPCIONAL: hay pasajeros con solo nombre y viajan igual. Se compara '
  'normalizado (sin puntos ni espacios, en mayúsculas).';

-- Única cuando existe. `where documento_norm is not null` es lo que permite
-- que convivan mil personas sin documento.
create unique index if not exists personas_documento_unico
  on personas (documento_norm) where documento_norm is not null;

-- Para buscar por nombre mientras se escribe.
create index if not exists personas_nombre_idx
  on personas (lower(nombre_completo));

drop trigger if exists personas_updated_at on personas;
create trigger personas_updated_at before update on personas
  for each row execute function set_updated_at();


-- ── El pasajero apunta a su persona ──
alter table pasajeros add column if not exists persona_id uuid references personas(id);
create index if not exists pasajeros_persona_idx on pasajeros (persona_id);

-- Y el titular de la reserva también: es quien firma y a quien se le escribe.
alter table registros add column if not exists persona_id uuid references personas(id);
create index if not exists registros_persona_idx on registros (persona_id);

comment on column registros.persona_id is
  'El titular como persona. `nombre_pasajero` e `identificacion` se conservan: '
  'son lo que se digitó ese día y el pasado no se reescribe (regla 4).';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · El enlace se deduce
--
-- SECURITY DEFINER porque tiene que funcionar por los tres caminos: la oficina
-- (usuario con sesión), el muelle, y el celular del cliente —que entra por
-- `guardar_pasajeros_por_token` y no tiene sesión ninguna—.
-- ════════════════════════════════════════════════════════════

create or replace function enlazar_persona(
  p_nombre text,
  p_tipo_documento tipo_documento,
  p_documento text,
  p_pais_id uuid
)
returns uuid as $$
declare
  norm text;
  pid uuid;
begin
  norm := nullif(upper(regexp_replace(coalesce(p_documento, ''), '[^A-Za-z0-9]', '', 'g')), '');
  if norm is null or coalesce(trim(p_nombre), '') = '' then
    return null;
  end if;

  -- `on conflict` y no un select previo: dos iPads guardando la misma familia
  -- al mismo tiempo chocarían contra el índice único.
  insert into personas (nombre_completo, tipo_documento, documento, pais_id, creado_por)
  values (trim(p_nombre), p_tipo_documento, trim(p_documento), p_pais_id, auth.uid())
  on conflict (documento_norm) where documento_norm is not null
  do update set
    -- Solo se completa lo que faltaba. El nombre NO se pisa: alguien pudo
    -- haberlo corregido a mano, y el del formulario de hoy no es más cierto.
    tipo_documento  = coalesce(personas.tipo_documento, excluded.tipo_documento),
    pais_id         = coalesce(personas.pais_id, excluded.pais_id),
    actualizado_por = auth.uid()
  returning id into pid;

  return pid;
end;
$$ language plpgsql security definer set search_path = public;

comment on function enlazar_persona(text, tipo_documento, text, uuid) is
  'Devuelve la persona de ese documento, creándola si no existía. Sin documento '
  'devuelve null: esa plaza viaja sin identidad y no es un error.';


create or replace function pasajero_enlaza_persona()
returns trigger as $$
begin
  -- Sin documento no se toca lo que hubiera: la oficina puede haber enlazado a
  -- mano a alguien que no lo trae.
  if nullif(trim(coalesce(new.documento, '')), '') is null then
    return new;
  end if;

  new.persona_id := coalesce(
    enlazar_persona(new.nombre, new.tipo_documento, new.documento, new.pais_id),
    new.persona_id
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists pasajeros_enlazan_persona on pasajeros;
create trigger pasajeros_enlazan_persona
  before insert or update of nombre, documento, tipo_documento, pais_id on pasajeros
  for each row execute function pasajero_enlaza_persona();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Las organizaciones
--
-- `agencias` se queda corta desde que hay que guardar a la Capitanía: una
-- autoridad portuaria no es una agencia de viajes. Se renombra la tabla —los
-- datos, los ids y la llave foránea sobreviven— y gana el tipo.
--
-- `registros.agencia_id` NO se renombra: renombrar una columna es reescribir
-- ocho archivos del front por un nombre más bonito. La columna dice de qué
-- organización vino la reserva, y para eso "agencia" sigue siendo la palabra
-- de la operación.
-- ════════════════════════════════════════════════════════════

do $$ begin
  create type tipo_organizacion as enum (
    'agencia',            -- vende pasadías: Aviatur, Hotelbeds
    'operador_externo',   -- opera con lancha propia
    'proveedor',          -- le vende al hotel
    'aliado',             -- convenios
    'empresa_personal',   -- pone gente a bordo
    'institucion'         -- CorpoTurismo, Parques, Capitanía, Financiera
  );
exception when duplicate_object then null; end $$;

do $$ begin
  if to_regclass('public.agencias') is not null
     and to_regclass('public.organizaciones') is null then
    alter table agencias rename to organizaciones;
  end if;
end $$;

alter table organizaciones
  add column if not exists tipo tipo_organizacion not null default 'agencia',
  add column if not exists nit text,
  add column if not exists telefono text,
  add column if not exists direccion text,
  add column if not exists notas text,
  add column if not exists creado_por uuid references auth.users(id),
  add column if not exists actualizado_por uuid references auth.users(id);

comment on table organizaciones is
  'Con quién trata el hotel: agencias, operadores, proveedores, aliados, '
  'empresas de personal e instituciones. Se llamó `agencias` hasta la 020, '
  'cuando hubo que guardar a la Capitanía — que de agencia no tiene nada.';

comment on column organizaciones.activa is
  'Se desactivan, nunca se borran: el histórico de reservas las referencia.';


-- ── Los correos de destino, en la ficha de cada quien ──
-- Estaban destinados a `ajustes` cuando se conectara Resend. Aquí es donde
-- van: el correo del manifiesto es de la Capitanía, no del sistema, y quien lo
-- cambia es quien habla con ellos.
do $$ begin
  create type proposito_correo as enum ('manifiesto', 'facturacion', 'general');
exception when duplicate_object then null; end $$;

create table if not exists organizacion_correos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  correo text not null,
  proposito proposito_correo not null default 'general',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  creado_por uuid references auth.users(id)
);

create index if not exists organizacion_correos_org_idx
  on organizacion_correos (organizacion_id);
create unique index if not exists organizacion_correos_unico
  on organizacion_correos (organizacion_id, lower(correo), proposito);

comment on table organizacion_correos is
  'A dónde se le escribe a cada organización y para qué. El manifiesto sale '
  'del servidor a los correos con propósito `manifiesto` (regla 16); nunca a '
  'una dirección escrita en el código (regla 22).';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Vínculos y etiquetas
--
-- Separadas a propósito: un vínculo es un hecho («Marcela trabaja en
-- Aviatur»), una etiqueta es una lectura («viaja con niños»). Y dentro de las
-- etiquetas, las calculadas no se mezclan con las puestas a mano: una se
-- rehace sola cada vez, la otra la puso alguien y borrarla sería perderla.
-- ════════════════════════════════════════════════════════════

do $$ begin
  create type tipo_vinculo as enum (
    'empleado_de', 'contacto_de', 'guia_de', 'titular_de', 'acompanante_de'
  );
exception when duplicate_object then null; end $$;

create table if not exists vinculos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  organizacion_id uuid references organizaciones(id) on delete cascade,
  persona_relacionada_id uuid references personas(id) on delete cascade,
  tipo tipo_vinculo not null,
  desde date,
  hasta date,
  created_at timestamptz not null default now(),
  creado_por uuid references auth.users(id),

  -- O apunta a una organización o a otra persona, nunca a las dos ni a nada.
  constraint vinculo_apunta_a_algo check (
    (organizacion_id is not null and persona_relacionada_id is null)
    or (organizacion_id is null and persona_relacionada_id is not null)
  )
);

create index if not exists vinculos_persona_idx on vinculos (persona_id);
create index if not exists vinculos_organizacion_idx on vinculos (organizacion_id);


create table if not exists etiquetas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  -- `calculada` la mantiene el sistema; `asignada` la pone una persona.
  calculada boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists persona_etiquetas (
  persona_id uuid not null references personas(id) on delete cascade,
  etiqueta_id uuid not null references etiquetas(id) on delete cascade,
  -- Repetido a propósito respecto de `etiquetas.calculada`: así una etiqueta
  -- que pasa a calcularse no borra las que alguien ya había puesto a mano.
  origen text not null default 'asignada' check (origen in ('calculada', 'asignada')),
  puesta_at timestamptz not null default now(),
  puesta_por uuid references auth.users(id),
  primary key (persona_id, etiqueta_id, origen)
);

comment on table persona_etiquetas is
  'Las calculadas se rehacen solas y se pueden borrar sin perder nada; las '
  'asignadas las puso alguien y por eso viven en filas distintas aunque la '
  'etiqueta sea la misma.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 · Unir duplicados
--
-- Va a pasar: la misma señora con cédula escrita de dos formas, o una vez con
-- pasaporte y otra con cédula. Unir es destructivo —una de las dos deja de
-- existir— así que lo hace quien administra o la coordinadora, y queda en la
-- bitácora con el detalle completo por si hay que entender qué pasó.
-- ════════════════════════════════════════════════════════════

create or replace function unir_personas(p_conservar uuid, p_absorber uuid)
returns personas as $$
declare
  quedan personas;
  absorbida personas;
begin
  if not (puedo_administrar() or tiene_rol('asesora')) then
    raise exception 'Unir personas lo hace la dirección o la coordinación del pasadía'
      using errcode = '42501';
  end if;
  if p_conservar = p_absorber then
    raise exception 'Son la misma persona' using errcode = 'check_violation';
  end if;

  select * into quedan   from personas where id = p_conservar;
  select * into absorbida from personas where id = p_absorber;
  if quedan is null or absorbida is null then
    raise exception 'Una de las dos no existe' using errcode = 'no_data_found';
  end if;

  update pasajeros set persona_id = p_conservar where persona_id = p_absorber;
  update registros set persona_id = p_conservar where persona_id = p_absorber;
  update vinculos  set persona_id = p_conservar where persona_id = p_absorber;
  update vinculos  set persona_relacionada_id = p_conservar
   where persona_relacionada_id = p_absorber;

  -- Las etiquetas se mudan sin duplicar.
  insert into persona_etiquetas (persona_id, etiqueta_id, origen, puesta_por)
  select p_conservar, etiqueta_id, origen, puesta_por
    from persona_etiquetas where persona_id = p_absorber
  on conflict do nothing;

  -- Lo que la absorbida tenía y la que queda no, se conserva.
  update personas set
    tipo_documento = coalesce(tipo_documento, absorbida.tipo_documento),
    documento      = coalesce(documento, absorbida.documento),
    pais_id        = coalesce(pais_id, absorbida.pais_id),
    telefono       = coalesce(telefono, absorbida.telefono),
    email          = coalesce(email, absorbida.email),
    notas          = nullif(concat_ws(E'\n', notas, absorbida.notas), ''),
    actualizado_por = auth.uid()
  where id = p_conservar
  returning * into quedan;

  delete from personas where id = p_absorber;

  perform anotar(
    'unir_personas', 'personas', p_conservar::text, null,
    jsonb_build_object(
      'absorbida', jsonb_build_object(
        'id', absorbida.id, 'nombre', absorbida.nombre_completo,
        'documento', absorbida.documento),
      'conservada', jsonb_build_object(
        'id', quedan.id, 'nombre', quedan.nombre_completo,
        'documento', quedan.documento)
    )
  );

  return quedan;
end;
$$ language plpgsql security definer set search_path = public;


-- ── Buscar para precargar ──
-- Lo que la asesora necesita mientras escribe: por documento o por nombre. La
-- condición de equipo va dentro porque la función es DEFINER.
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
       p.documento_norm like upper(regexp_replace(p_texto, '[^A-Za-z0-9]', '', 'g')) || '%'
       or lower(p.nombre_completo) like '%' || lower(trim(p_texto)) || '%'
     )
   order by (select count(*) from pasajeros pa where pa.persona_id = p.id) desc,
            p.nombre_completo
   limit least(coalesce(p_limite, 8), 25);
$$ language sql stable security definer set search_path = public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 · Se acaba el solapamiento de `cortesia`
--
-- `categoria_pasajero` mezclaba dos ejes: adulto/niño/infante es la EDAD —de
-- ahí sale qué come y qué porción—, y cortesía es el MOTIVO DE PAGO, que vive
-- en `tipos_ingreso` con sus tres banderas (regla 11). Con el valor en los dos
-- lados, un adulto invitado se podía marcar `categoria='cortesia'` y entonces
-- no se sabía ni qué come ni cuántos años tiene.
--
-- PostgreSQL no deja quitar un valor de un enum sin rehacer todo lo que
-- depende del tipo, así que se cierra la puerta con un CHECK — igual que con
-- `recepcion` en la 017. **Se comprobó primero que no hubiera una sola fila
-- usándolo**, ni en `pasajeros` ni en `embarques`: cero y cero.
--
-- `embarques` es append-only y su trigger bloquea UPDATE, pero agregar un
-- CHECK solo valida las filas que hay; no las reescribe. Por eso se puede.
-- ════════════════════════════════════════════════════════════

do $$
declare cuantas integer;
begin
  select count(*) into cuantas from pasajeros where categoria = 'cortesia';
  if cuantas > 0 then
    raise exception '% pasajeros usan categoria=cortesia: hay que migrarlos antes', cuantas;
  end if;
  select count(*) into cuantas from embarques where categoria = 'cortesia';
  if cuantas > 0 then
    raise exception '% embarques usan categoria=cortesia y no se pueden reescribir', cuantas;
  end if;
end $$;

alter table pasajeros drop constraint if exists pasajeros_categoria_es_edad;
alter table pasajeros add constraint pasajeros_categoria_es_edad
  check (categoria <> 'cortesia'::categoria_pasajero);

alter table embarques drop constraint if exists embarques_categoria_es_edad;
alter table embarques add constraint embarques_categoria_es_edad
  check (categoria is null or categoria <> 'cortesia'::categoria_pasajero);

comment on type categoria_pasajero is
  'La EDAD de la persona: adulto, niño, infante. `cortesia` quedó huérfano en '
  'la 020 —PostgreSQL no deja quitarlo— y los CHECK impiden asignarlo: por qué '
  'entró alguien lo dice tipos_ingreso, no esto.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 · RLS
--
-- `personas` guarda documentos de identidad de miles de visitantes: es la
-- tabla más sensible del sistema después de las firmas.
-- ════════════════════════════════════════════════════════════

alter table personas             enable row level security;
alter table organizacion_correos enable row level security;
alter table vinculos             enable row level security;
alter table etiquetas            enable row level security;
alter table persona_etiquetas    enable row level security;

-- Leer: el equipo. El mesero ve nombres en su pantalla de todos modos —los de
-- quien está sentado en su mesa— y el manifiesto los necesita completos.
drop policy if exists personas_lectura on personas;
create policy personas_lectura on personas for select to authenticated
  using (soy_del_equipo());

-- Escribir: quien vende y quien opera. Mismo criterio que `pasajeros`, porque
-- es de ahí de donde salen.
drop policy if exists personas_escritura on personas;
create policy personas_escritura on personas for all to authenticated
  using (soy_del_equipo() and (not tiene_rol('mesero') or puedo_operar_muelle()))
  with check (soy_del_equipo() and (not tiene_rol('mesero') or puedo_operar_muelle()));

-- Borrar una persona no lo hace nadie a mano: se unen duplicados, que deja
-- rastro. Sin política de DELETE, la RLS lo niega.
drop policy if exists personas_baja on personas;

do $$
declare t text;
begin
  foreach t in array array['vinculos', 'etiquetas', 'persona_etiquetas', 'organizacion_correos']
  loop
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

-- Las políticas de `agencias` viajaron con el rename; se rehacen con el nombre
-- nuevo para que digan la verdad. La asesora administra organizaciones: es
-- quien habla con las agencias todos los días.
drop policy if exists agencias_lectura on organizaciones;
drop policy if exists agencias_escritura on organizaciones;
drop policy if exists organizaciones_lectura on organizaciones;
drop policy if exists organizaciones_escritura on organizaciones;
create policy organizaciones_lectura on organizaciones for select to authenticated
  using (soy_del_equipo());
create policy organizaciones_escritura on organizaciones for all to authenticated
  using (puedo_administrar() or tiene_rol('asesora'))
  with check (puedo_administrar() or tiene_rol('asesora'));


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8 · Permisos
--
-- Todo lo nuevo nace cerrado por el default de la 012. `enlazar_persona` y el
-- trigger NO se le abren a nadie: los llama el trigger, que corre solo.
-- ════════════════════════════════════════════════════════════

grant select, insert, update on personas             to authenticated;
grant select, insert, update, delete on vinculos             to authenticated;
grant select, insert, update, delete on etiquetas            to authenticated;
grant select, insert, update, delete on persona_etiquetas    to authenticated;
grant select, insert, update, delete on organizacion_correos to authenticated;

revoke all on function enlazar_persona(text, tipo_documento, text, uuid) from public, anon, authenticated;
revoke all on function unir_personas(uuid, uuid)   from public, anon;
revoke all on function buscar_personas(text, integer) from public, anon;
grant execute on function unir_personas(uuid, uuid)     to authenticated;
grant execute on function buscar_personas(text, integer) to authenticated;


-- ════════════════════════════════════════════════════════════
-- Comprobaciones
-- ════════════════════════════════════════════════════════════

do $$
declare
  cuantas integer;
  abiertas text;
begin
  -- 1. La puerta pública sigue siendo de cinco.
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into cuantas, abiertas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5: %', cuantas, abiertas;
  end if;

  -- 2. Ninguna tabla nueva sin RLS ni sin política de lectura.
  select count(*), string_agg(c.relname, ', ')
    into cuantas, abiertas
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'r'
     and (not c.relrowsecurity
       or not exists (select 1 from pg_policies p
                       where p.schemaname = 'public' and p.tablename = c.relname
                         and p.cmd in ('ALL', 'SELECT')));
  if cuantas > 0 then
    raise exception '% tabla(s) sin candado: %', cuantas, abiertas;
  end if;

  -- 3. Ninguna vista se abrió a anon con el rename.
  select count(*), string_agg(c.relname, ', ')
    into cuantas, abiertas
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relkind = 'v'
     and has_table_privilege('anon', c.oid, 'select');
  if cuantas > 0 then
    raise exception 'anon puede leer % vista(s): %', cuantas, abiertas;
  end if;

  -- 4. El enlace funciona: se prueba con una persona de mentira y se deshace.
  --    Es la única forma de saber que el trigger y el índice único conviven.
  declare pid1 uuid; pid2 uuid;
  begin
    pid1 := enlazar_persona('Prueba de la 020', 'cc'::tipo_documento, '1.234.567-X', null);
    pid2 := enlazar_persona('Prueba de la 020', 'cc'::tipo_documento, '1234567X', null);
    if pid1 is null or pid1 <> pid2 then
      raise exception 'El documento no se está normalizando: % vs %', pid1, pid2;
    end if;
    if enlazar_persona('Sin documento', null, null, null) is not null then
      raise exception 'Una plaza sin documento no debería crear persona';
    end if;
    delete from personas where id = pid1;
  end;

  raise notice 'Personas y organizaciones listas. El documento identifica cuando existe.';
end $$;
