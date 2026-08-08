-- ============================================================
-- DayPASS — 008 · Check-in público y firma (Plan v5, Fase C)
-- Ejecutar DESPUÉS de 007_modelo_operacion.sql
--
-- ⚠️ CÓMO CORRERLA
-- Cierra las pestañas del navegador con DayPASS abierto: las
-- suscripciones de tiempo real toman locks sobre registros.
-- Todo es idempotente: si falla por lock, vuelve a correrla.
--
-- ── La decisión de seguridad más delicada del proyecto ──
-- La página pública NO tiene políticas sobre las tablas. El rol anon
-- no puede leer ni escribir NADA directamente. Todo pasa por
-- funciones SECURITY DEFINER que reciben el token, verifican que
-- esté vigente, y devuelven o escriben ÚNICAMENTE lo que el cliente
-- necesita ver de su propia reserva. Sin precios, sin folios, sin
-- datos de otras reservas.
-- ============================================================

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Documentos legales y firmas
-- ════════════════════════════════════════════════════════════

-- El texto que se firma, versionado. Nunca se edita una versión
-- vigente: se crea una nueva y se cierra la anterior. Lo que se
-- guarda en la firma es la versión EXACTA que la persona leyó.
create table if not exists documentos_legales (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'exoneracion',
  version integer not null,
  idioma text not null default 'es',
  titulo text not null,
  contenido text not null,
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz,
  created_at timestamptz default now()
);

create unique index if not exists documentos_legales_version
  on documentos_legales (tipo, idioma, version);

create index if not exists documentos_legales_vigentes
  on documentos_legales (tipo, idioma, vigente_desde desc);

-- Una firma por reserva: la del titular. Confirmado con el hotel —
-- el Day Tour lo firma el titular del cliente, no cada pasajero.
create table if not exists firmas (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references registros(id) on delete cascade,
  documento_legal_id uuid not null references documentos_legales(id),

  firmante_nombre text not null,
  firmante_documento text,

  trazo_url text,          -- Supabase Storage
  trazo_datos text,        -- respaldo en línea mientras no haya Storage

  firmado_at timestamptz not null default now(),
  sincronizado_at timestamptz default now(),
  dispositivo text,
  registrado_por uuid references auth.users(id),

  -- SHA-256 sobre documento del firmante + documento_legal_id +
  -- firmado_at + dispositivo + trazo. Sirve para demostrar después
  -- que el registro no se alteró.
  hash text,

  client_id uuid not null unique,
  created_at timestamptz default now()
);

create index if not exists firmas_registro_idx on firmas (registro_id);

-- Una firma tampoco se corrige: se firma de nuevo.
create or replace function firmas_son_inmutables()
returns trigger as $$
begin
  raise exception 'Una firma no se modifica: se registra una nueva'
    using errcode = 'restrict_violation';
end;
$$ language plpgsql;

drop trigger if exists firmas_sin_update on firmas;
create trigger firmas_sin_update
  before update on firmas
  for each row execute function firmas_son_inmutables();

-- El texto vigente del Day Tour, versión 1. Cuando el hotel entregue
-- el texto definitivo se agrega la versión 2 y se cierra esta.
insert into documentos_legales (tipo, version, idioma, titulo, contenido)
values (
  'exoneracion', 1, 'es',
  'Condiciones del Day Tour',
  'Al confirmar mi asistencia declaro que:

1. Participo de forma libre y voluntaria en el Day Tour del Hotel San Pedro de Majagua, en las Islas del Rosario, que incluye transporte marítimo desde y hacia Cartagena.

2. Conozco que el trayecto se realiza en lancha y que las condiciones del mar pueden variar. Me comprometo a seguir en todo momento las instrucciones del piloto y de la tripulación, y a usar el chaleco salvavidas cuando se me indique.

3. Informo que ni yo ni las personas que registro padecemos condiciones de salud que desaconsejen la navegación o las actividades acuáticas. Si existe alguna, la he informado al hotel por escrito.

4. Entiendo que las actividades acuáticas son opcionales y las realizo bajo mi propia responsabilidad.

5. Soy responsable de mis objetos personales durante el trayecto y la estadía.

6. Autorizo al Hotel San Pedro de Majagua a tratar mis datos personales y los de mi grupo con la finalidad de prestar el servicio contratado, cumplir las obligaciones ante la Capitanía de Puerto y las autoridades de turismo, y enviarme información sobre mi reserva, conforme a la Ley 1581 de 2012.

7. Firmo en nombre propio y en representación de las personas que registro en esta reserva.'
)
on conflict (tipo, idioma, version) do nothing;

insert into documentos_legales (tipo, version, idioma, titulo, contenido)
values (
  'exoneracion', 1, 'en',
  'Day Tour Terms',
  'By confirming my attendance I declare that:

1. I take part freely and voluntarily in the Day Tour of Hotel San Pedro de Majagua, Islas del Rosario, which includes boat transport to and from Cartagena.

2. I understand the trip is made by boat and that sea conditions may vary. I agree to follow the instructions of the pilot and crew at all times, and to wear a life jacket when instructed.

3. I state that neither I nor the people I register have health conditions that make sailing or water activities inadvisable. If any exist, I have informed the hotel in writing.

4. I understand water activities are optional and undertaken at my own risk.

5. I am responsible for my personal belongings during the trip and the stay.

6. I authorise Hotel San Pedro de Majagua to process my personal data and that of my group in order to provide the contracted service, meet its obligations before the Port Authority and tourism authorities, and send me information about my booking, under Colombian Law 1581 of 2012.

7. I sign on my own behalf and on behalf of the people I register in this booking.'
)
on conflict (tipo, idioma, version) do nothing;

alter table documentos_legales enable row level security;
alter table firmas enable row level security;

do $$ begin
  create policy "authenticated_read" on documentos_legales for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_read" on firmas for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated_insert" on firmas for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · El check-in en la reserva
-- ════════════════════════════════════════════════════════════

alter table registros
  add column if not exists check_in_at timestamptz,
  add column if not exists check_in_desde text;   -- 'publico' | 'oficina'

-- El token gana el rastro de sus envíos, para la pantalla de tarjetas.
alter table tokens_reserva
  add column if not exists enviado_at timestamptz,
  add column if not exists enviado_por uuid references auth.users(id),
  add column if not exists veces_abierto integer not null default 0;

-- Toda reserva nueva nace con su token. Las que ya existen también.
create or replace function crear_token_de_reserva()
returns trigger as $$
begin
  insert into tokens_reserva (registro_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists registros_crean_token on registros;
create trigger registros_crean_token
  after insert on registros
  for each row execute function crear_token_de_reserva();

insert into tokens_reserva (registro_id)
select r.id from registros r
 where not exists (select 1 from tokens_reserva t where t.registro_id = r.id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · La puerta pública
-- Funciones SECURITY DEFINER. El rol anon SOLO puede ejecutar
-- estas; no tiene acceso a ninguna tabla.
-- ════════════════════════════════════════════════════════════

-- Resuelve un token vigente a su reserva. Devuelve null si no existe,
-- si expiró o si el día ya pasó: un link viejo no abre nada.
create or replace function _reserva_de_token(p_token text)
returns registros as $$
  select r.*
    from tokens_reserva t
    join registros r on r.id = t.registro_id
   where t.token = p_token
     and t.estado <> 'expirado'
     and (t.expira_at is null or t.expira_at > now())
   limit 1;
$$ language sql stable security definer;

/**
 * Lo que la página pública puede ver de su propia reserva.
 * Deliberadamente NO incluye precios, folios, forma de pago, ni nada
 * de otras reservas.
 */
create or replace function reserva_publica(p_token text)
returns json as $$
declare
  r registros;
  dia dias_operativos;
  puede_check_in boolean;
begin
  select * into r from _reserva_de_token(p_token);
  if r is null then return null; end if;

  select * into dia from dias_operativos where fecha = r.fecha;

  -- El check-in abre 48 horas antes y cierra cuando se cierra el día.
  puede_check_in :=
    coalesce(dia.estado, 'planeando') = 'planeando'
    and r.fecha >= current_date
    and (r.fecha - current_date) <= 2;

  return json_build_object(
    'titular', r.nombre_pasajero,
    'grupo', r.nombre_grupo,
    'agencia', r.agencia_nombre,
    'fecha', r.fecha,
    'estado', r.estado,
    'adultos', r.adultos,
    'ninos', r.ninos,
    'infantes', r.infantes,
    'cortesias', r.cortesias,
    'plan', (select p.nombre from planes p where p.id = r.plan_id),
    'lancha', (select l.nombre from lanchas l where l.id = r.lancha_id),
    'estado_dia', coalesce(dia.estado::text, 'planeando'),
    'puede_check_in', puede_check_in,
    'check_in_at', r.check_in_at,
    'tiene_firma', exists (select 1 from firmas f where f.registro_id = r.id),
    'opciones_plato', coalesce((
      select json_agg(json_build_object('id', o.id, 'es', o.nombre_es, 'en', o.nombre_en))
        from opciones_plato o where o.plan_id = r.plan_id and o.activo
    ), '[]'::json),
    'pasajeros', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'nombre', p.nombre, 'documento', p.documento,
        'tipo_documento', p.tipo_documento, 'pais_id', p.pais_id,
        'categoria', p.categoria, 'opcion_plato_id', p.opcion_plato_id,
        'restriccion_alimentaria', p.restriccion_alimentaria
      ) order by p.created_at)
        from pasajeros p where p.registro_id = r.id
    ), '[]'::json),
    'paises', coalesce((
      select json_agg(json_build_object('id', pa.id, 'nombre', pa.nombre) order by pa.nombre)
        from paises pa
    ), '[]'::json)
  );
end;
$$ language plpgsql stable security definer;

/** Marca que el link se abrió, para saber a quién recordarle. */
create or replace function marcar_token_abierto(p_token text)
returns void as $$
  update tokens_reserva set veces_abierto = veces_abierto + 1
   where token = p_token;
$$ language sql security definer;

/**
 * Etapa 1: el cliente registra a los suyos. Reemplaza la lista
 * completa de esa reserva, nunca toca otra.
 */
create or replace function guardar_pasajeros_por_token(p_token text, p_pasajeros json)
returns json as $$
declare
  r registros;
  dia dias_operativos;
  item json;
begin
  select * into r from _reserva_de_token(p_token);
  if r is null then
    raise exception 'Este enlace ya no está disponible' using errcode = 'no_data_found';
  end if;

  select * into dia from dias_operativos where fecha = r.fecha;
  if coalesce(dia.estado, 'planeando') <> 'planeando' then
    raise exception 'La lista de este día ya se cerró' using errcode = 'check_violation';
  end if;

  perform set_config('daypass.operacion_sistema', 'on', true);

  delete from pasajeros where registro_id = r.id;

  for item in select * from json_array_elements(p_pasajeros) loop
    if coalesce(trim(item ->> 'nombre'), '') <> '' then
      insert into pasajeros (
        registro_id, nombre, tipo_documento, documento, pais_id,
        categoria, opcion_plato_id, restriccion_alimentaria
      ) values (
        r.id,
        trim(item ->> 'nombre'),
        nullif(item ->> 'tipo_documento', '')::tipo_documento,
        nullif(trim(item ->> 'documento'), ''),
        nullif(item ->> 'pais_id', '')::uuid,
        coalesce(nullif(item ->> 'categoria', ''), 'adulto')::categoria_pasajero,
        nullif(item ->> 'opcion_plato_id', '')::uuid,
        nullif(trim(item ->> 'restriccion_alimentaria'), '')
      );
    end if;
  end loop;

  perform set_config('daypass.operacion_sistema', 'off', true);
  return reserva_publica(p_token);
end;
$$ language plpgsql security definer;

/**
 * Etapa 2: el titular firma y se cierra su check-in.
 * La firma queda con la versión EXACTA del documento que leyó.
 */
create or replace function firmar_por_token(
  p_token text,
  p_documento_legal_id uuid,
  p_firmante_nombre text,
  p_firmante_documento text,
  p_trazo text,
  p_client_id uuid,
  p_dispositivo text default null
)
returns json as $$
declare
  r registros;
  dia dias_operativos;
  el_hash text;
begin
  select * into r from _reserva_de_token(p_token);
  if r is null then
    raise exception 'Este enlace ya no está disponible' using errcode = 'no_data_found';
  end if;

  select * into dia from dias_operativos where fecha = r.fecha;
  if coalesce(dia.estado, 'planeando') <> 'planeando' then
    raise exception 'La lista de este día ya se cerró' using errcode = 'check_violation';
  end if;

  -- El hash prueba que el conjunto no se alteró después. sha256() es
  -- nativo de Postgres: no depende de en qué esquema quedó pgcrypto.
  el_hash := encode(sha256(convert_to(
    coalesce(p_firmante_documento, '') || '|' ||
    p_documento_legal_id::text || '|' ||
    now()::text || '|' ||
    coalesce(p_dispositivo, '') || '|' ||
    coalesce(p_trazo, ''),
    'UTF8')), 'hex');

  insert into firmas (
    registro_id, documento_legal_id, firmante_nombre, firmante_documento,
    trazo_datos, dispositivo, hash, client_id
  ) values (
    r.id, p_documento_legal_id, p_firmante_nombre, nullif(trim(p_firmante_documento), ''),
    p_trazo, p_dispositivo, el_hash, p_client_id
  )
  on conflict (client_id) do nothing;

  perform set_config('daypass.operacion_sistema', 'on', true);
  update registros
     set check_in_at = coalesce(check_in_at, now()),
         check_in_desde = 'publico'
   where id = r.id;
  update tokens_reserva set estado = 'check_in_abierto' where registro_id = r.id;
  perform set_config('daypass.operacion_sistema', 'off', true);

  return reserva_publica(p_token);
end;
$$ language plpgsql security definer;

/** El texto vigente que hay que mostrar antes de firmar. */
create or replace function documento_vigente(p_idioma text default 'es')
returns json as $$
  select json_build_object('id', d.id, 'titulo', d.titulo, 'contenido', d.contenido, 'version', d.version)
    from documentos_legales d
   where d.tipo = 'exoneracion'
     and d.idioma = p_idioma
     and d.vigente_hasta is null
   order by d.version desc
   limit 1;
$$ language sql stable security definer;

-- ── Los permisos: anon SOLO puede ejecutar estas funciones ───
revoke all on function _reserva_de_token(text) from anon, public;

grant execute on function reserva_publica(text) to anon;
grant execute on function marcar_token_abierto(text) to anon;
grant execute on function guardar_pasajeros_por_token(text, json) to anon;
grant execute on function firmar_por_token(text, uuid, text, text, text, uuid, text) to anon;
grant execute on function documento_vigente(text) to anon;
