-- ════════════════════════════════════════════════════════════════════════════
-- 021 · Fase 4 · Tickets de soporte
--
-- Va adelantada a propósito. Si el equipo va a probar DayPASS durante meses, el
-- canal para reportar tiene que existir **mientras** prueban, no al final: un
-- fallo que Daniela cuenta por WhatsApp a las 8:20 de la mañana y que nadie
-- anota es un fallo que se pierde, y el que más importa —el que pasó con la
-- fila esperando— es justo el que nadie tiene tiempo de escribir bien.
--
-- ── El contexto se captura, no se pregunta (regla 23) ───────────────────────
--
-- Quien reporta escribe dos cosas: qué pasó y, si quiere, un detalle. Todo lo
-- demás —quién es, con qué rol, en qué pantalla estaba, qué día tenía activo,
-- en qué modo, con qué aparato, si había señal, cuántos hechos tenía en la
-- cola y los últimos errores de consola— lo pone el sistema.
--
-- Es la diferencia entre un reporte que sirve y uno que no. "No me deja
-- guardar" sin contexto obliga a una conversación de veinte minutos; con el
-- contexto suele bastar para saber qué pasó sin preguntar nada.
--
-- ── Por qué la captura de pantalla vive en la fila y no en Storage ──────────
--
-- Un data URI en una columna `text` no es lo que uno elegiría con volumen. Con
-- este —unos pocos reportes al día— evita montar un bucket, sus políticas y su
-- limpieza aparte, que es más superficie de la que ahorra. Si algún día
-- estorba, mudarlo es mecánico.
--
-- **Se borran a los 90 días.** `limpiar_capturas_viejas()` deja el ticket y su
-- texto, que es lo que sirve para entender qué pasó, y suelta la imagen, que es
-- lo que pesa y lo que puede tener datos de un cliente en pantalla.
--
-- ── Lo que NO hace ──────────────────────────────────────────────────────────
--
-- **No manda push.** El plan pide "push inmediato al super_admin" cuando algo
-- bloquea la operación, pero las notificaciones son la fase 6 y el push en
-- iPhone además exige que cada persona instale la PWA. Aquí el ticket queda
-- marcado como bloqueante y visible; el push se engancha después sin tocar
-- nada de esto.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · La tabla
-- ════════════════════════════════════════════════════════════

do $$ begin
  create type tipo_ticket as enum ('no_funciona', 'se_ve_mal', 'idea');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_ticket as enum ('nuevo', 'visto', 'en_curso', 'resuelto', 'no_va');
exception when duplicate_object then null; end $$;

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),

  -- Generado en el aparato, igual que en `embarques`: el botón funciona sin
  -- señal y el reporte entra a la cola. Reenviarla dos veces no duplica nada.
  client_id uuid not null unique,

  tipo tipo_ticket not null,

  -- La casilla que cambia la prioridad de todo: no es lo mismo "se ve raro"
  -- que "no pude embarcar".
  bloqueo boolean not null default false,

  titulo  text not null,
  detalle text,

  -- Todo lo que el sistema sabe y nadie tuvo que escribir.
  contexto jsonb,

  -- Data URI de la captura. Se suelta a los 90 días.
  captura text,

  estado estado_ticket not null default 'nuevo',
  respuesta text,

  reportado_por uuid references auth.users(id),
  -- Congelado, como en la bitácora: si la persona cambia de nombre o de rol,
  -- el reporte sigue diciendo quién era ese día.
  reportado_por_nombre text,
  rol rol_usuario,

  atendido_por uuid references auth.users(id),
  atendido_at  timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table tickets is
  'El canal para reportar mientras se prueba. Quien reporta escribe qué pasó; '
  'el resto del contexto lo captura el sistema (regla 23). Funciona sin señal: '
  'entra a la cola del aparato como los embarques.';

comment on column tickets.bloqueo is
  'Marca "me bloqueó la operación". No es una prioridad más: es la diferencia '
  'entre algo que molesta y algo que dejó a alguien parado en el muelle.';

comment on column tickets.captura is
  'La pantalla en el momento del reporte. Se borra a los 90 días con '
  'limpiar_capturas_viejas(): puede tener datos de un cliente a la vista.';

create index if not exists tickets_de_quien_idx on tickets (reportado_por, created_at desc);
create index if not exists tickets_pendientes_idx on tickets (estado, created_at desc);
create index if not exists tickets_bloqueo_idx on tickets (created_at desc) where bloqueo;

drop trigger if exists tickets_updated_at on tickets;
create trigger tickets_updated_at before update on tickets
  for each row execute function set_updated_at();


-- ── Quién reportó lo pone el servidor ──
-- Que el aparato mande el autor sería confiar en el aparato. Aquí se sella con
-- la sesión, igual que la bitácora (regla 24).
create or replace function ticket_lo_firma_el_servidor()
returns trigger as $$
begin
  new.reportado_por        := auth.uid();
  new.reportado_por_nombre := nombre_de_quien_actua();
  new.rol                  := mi_rol();
  -- El estado y la respuesta los mueve quien atiende, no quien reporta.
  new.estado    := 'nuevo';
  new.respuesta := null;
  new.atendido_por := null;
  new.atendido_at  := null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists tickets_firma on tickets;
create trigger tickets_firma before insert on tickets
  for each row execute function ticket_lo_firma_el_servidor();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Atender
--
-- Cambiar el estado y responder es del `super_admin` —AISA, que es quien
-- mantiene el sistema—. La directora y gerencia leen todo para saber cómo va
-- la prueba, pero no atienden: no son quienes arreglan.
-- ════════════════════════════════════════════════════════════

create or replace function atender_ticket(
  p_ticket_id uuid,
  p_estado estado_ticket,
  p_respuesta text default null
)
returns tickets as $$
declare t tickets;
begin
  if not tiene_rol('super_admin') then
    raise exception 'Los reportes los atiende quien mantiene el sistema'
      using errcode = '42501';
  end if;

  update tickets set
    estado = p_estado,
    respuesta = coalesce(nullif(trim(p_respuesta), ''), respuesta),
    atendido_por = auth.uid(),
    atendido_at = now()
  where id = p_ticket_id
  returning * into t;

  if t is null then
    raise exception 'No existe ese reporte' using errcode = 'no_data_found';
  end if;

  perform anotar('atender_ticket', 'tickets', p_ticket_id::text, null,
    jsonb_build_object('estado', p_estado, 'titulo', t.titulo));

  return t;
end;
$$ language plpgsql security definer set search_path = public;


/**
 * Suelta las capturas de más de 90 días.
 *
 * Deja el ticket y su texto —que es lo que sirve para entender qué pasó— y
 * borra la imagen, que es lo que pesa y lo que puede tener el nombre y el
 * documento de un cliente a la vista.
 *
 * No se agenda sola: cuando haya pg_cron o una Edge Function programada, se
 * llama desde ahí. Mientras tanto se corre a mano, y el conteo que devuelve
 * dice cuánto soltó.
 */
create or replace function limpiar_capturas_viejas(p_dias integer default 90)
returns integer as $$
declare cuantas integer;
begin
  update tickets set captura = null
   where captura is not null
     and created_at < now() - (coalesce(p_dias, 90) || ' days')::interval;
  get diagnostics cuantas = row_count;
  return cuantas;
end;
$$ language plpgsql security definer set search_path = public;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · RLS
--
-- Un reporte puede llevar una captura de pantalla con la reserva de alguien —y
-- con sus precios— así que no lo lee todo el equipo: lo lee quien lo escribió
-- y quien tiene que resolverlo.
-- ════════════════════════════════════════════════════════════

alter table tickets enable row level security;

drop policy if exists tickets_lectura on tickets;
create policy tickets_lectura on tickets for select to authenticated
  using (
    reportado_por = auth.uid()          -- lo mío, con su estado
    or tiene_rol('super_admin')         -- quien lo arregla
    or puedo_administrar()              -- dirección y gerencia: cómo va la prueba
  );

-- Reportar puede cualquiera del equipo: el mesero es justamente quien más
-- necesita poder decir que algo no sirve.
drop policy if exists tickets_alta on tickets;
create policy tickets_alta on tickets for insert to authenticated
  with check (soy_del_equipo());

-- Cambiar el estado pasa por `atender_ticket`, que es DEFINER y comprueba el
-- rol. Sin política de UPDATE ni DELETE, nadie edita un reporte a mano.
drop policy if exists tickets_cambio on tickets;
drop policy if exists tickets_baja on tickets;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Permisos
-- ════════════════════════════════════════════════════════════

grant select, insert on tickets to authenticated;

revoke all on function atender_ticket(uuid, estado_ticket, text) from public, anon;
revoke all on function limpiar_capturas_viejas(integer)          from public, anon;
grant execute on function atender_ticket(uuid, estado_ticket, text) to authenticated;
-- La limpieza no la dispara una pantalla: la corre quien mantiene el sistema o
-- un programador de tareas con su propia conexión.
revoke all on function limpiar_capturas_viejas(integer) from authenticated;


-- ── Comprobaciones ──
do $$
declare
  cuantas integer;
  abiertas text;
begin
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into cuantas, abiertas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5: %', cuantas, abiertas;
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'tickets' and cmd in ('UPDATE', 'DELETE')
  ) then
    raise exception 'Los reportes no se editan a mano: sobra una política';
  end if;

  raise notice 'Tickets listos. El contexto se captura; el reporte funciona sin señal.';
end $$;
