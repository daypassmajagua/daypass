-- ════════════════════════════════════════════════════════════════════════════
-- 019 · La asesora administra lo suyo, y gerencia mira sin operar
--
-- Sale de revisar la matriz de roles contra las reglas, después de la 018. Tres
-- cosas que no cuadraban.
--
-- ── 1. La regla 21, rota para quien más la necesita ─────────────────────────
--
-- «La asesora administra lanchas, pilotos y empleados: catálogos, nunca texto
-- libre; se seleccionan, no se digitan; se desactivan, no se borran.»
--
-- La 015 metió esas tres tablas en el mismo saco que planes, tarifas y ajustes
-- —escritura solo para quien administra— y ahí se perdió la regla. Daniela
-- tiene «Lanchas y equipo» en su menú, la pantalla dice de sí misma que es «la
-- herramienta de trabajo de la coordinadora… sin pasar por nadie», y al
-- desactivar una lancha o crear un piloto recibía «No se pudo guardar».
--
-- No es un permiso de lujo: cuando una lancha sale de servicio un domingo, la
-- alternativa a que ella lo marque es que no se marque.
--
-- El resto de catálogos NO se toca. Planes y temporadas son tarifas —el precio
-- se congela al crear la reserva (regla 4), así que quien los edita mueve
-- plata—; `ajustes` son las constantes de la operación; `documentos_legales`
-- es lo que el cliente firma. Eso sigue siendo de quien administra.
--
-- ── 2. Gerencia escribía reservas ───────────────────────────────────────────
--
-- La 018 le puso a `cambiar_estado_manual` un candado sin gerencia, con la
-- razón escrita: mira el negocio, no lo opera. Pero la política de UPDATE de
-- `registros` sí la dejaba pasar, así que el mismo cambio que la función le
-- niega lo podía hacer por PostgREST. O el principio vale en los dos sitios o
-- no vale: se alinea la política con la función.
--
-- ── 3. El turno habilita, y a veces no habilitaba ───────────────────────────
--
-- «El turno habilita las acciones correspondientes solo ese día.» Un mesero o
-- un admin_isla con guardia de embarque podía insertar embarques (esa política
-- sí mira la guardia) pero no ponerle nombre a una plaza suelta, porque
-- `pasajeros` lo excluye por rol base. Media función: puede embarcar a la
-- persona pero no decir quién es, y la lista nominal es obligatoria por norma.
--
-- Idempotente. lock_timeout por el worker de Realtime.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Los catálogos de la operación son de la asesora
-- ════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['lanchas', 'pilotos', 'empleados'] loop
    execute format('drop policy if exists %I_escritura on %I', t, t);
    execute format(
      'create policy %I_escritura on %I for all to authenticated '
      'using (puedo_administrar() or tiene_rol(''asesora'')) '
      'with check (puedo_administrar() or tiene_rol(''asesora''))', t, t);
  end loop;
end $$;

comment on table lanchas is
  'La flota. La administra quien administra y también la asesora (regla 21): '
  'se desactivan, nunca se borran — el histórico de manifiestos las referencia.';
comment on table pilotos is
  'Catálogo, no texto libre: el manifiesto de Capitanía lleva el nombre del '
  'piloto y no puede depender de cómo se escribió ese día.';
comment on table empleados is
  'Quienes van a bordo sin ser pasadía. Van en la lista nominal igual que '
  'todos, así que son catálogo y no un nombre escrito a mano.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Gerencia mira el negocio; no lo opera
--
-- Se mantiene el resto igual que en la 018: vender es de quien vende, y el
-- muelle y la isla mueven estados por las funciones, que son DEFINER.
-- ════════════════════════════════════════════════════════════

drop policy if exists registros_cambio on registros;
create policy registros_cambio on registros for update to authenticated
  using (tiene_rol('super_admin', 'directora', 'asesora', 'asesora_comercial'))
  with check (tiene_rol('super_admin', 'directora', 'asesora', 'asesora_comercial'));

-- Insertar tampoco: una reserva la crea quien vende.
drop policy if exists registros_alta on registros;
create policy registros_alta on registros for insert to authenticated
  with check (tiene_rol('super_admin', 'directora', 'asesora', 'asesora_comercial'));

-- Leer sigue siendo de quien ve plata (018), gerencia incluida: sus informes
-- son precisamente eso.


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Quien tiene el turno puede hacer el turno completo
--
-- `pasajeros` es la única de las tablas de operación donde la guardia no
-- alcanzaba. Se le agrega, y de paso queda escrito por qué el mesero sigue
-- excluido cuando NO tiene turno: su pantalla es de consulta.
-- ════════════════════════════════════════════════════════════

drop policy if exists pasajeros_escritura on pasajeros;
create policy pasajeros_escritura on pasajeros for all to authenticated
  using (
    soy_del_equipo()
    and (not tiene_rol('mesero') or puedo_operar_muelle())
  )
  with check (
    soy_del_equipo()
    and (not tiene_rol('mesero') or puedo_operar_muelle())
  );

comment on table pasajeros is
  'La lista nominal, obligatoria por norma (Capitanía). La escribe la oficina, '
  'el muelle y quien tenga guardia de embarque ese día — incluido un mesero '
  'que cubra el turno: si puede embarcar a alguien, tiene que poder decir '
  'quién es. Sin turno, el mesero solo consulta.';


-- ════════════════════════════════════════════════════════════
-- Comprobaciones
-- ════════════════════════════════════════════════════════════

do $$
declare
  cuantas integer;
  cual text;
begin
  -- 1. Las tres tablas de la asesora la nombran; las de tarifas, no.
  select count(*) into cuantas
    from pg_policies
   where schemaname = 'public'
     and tablename in ('lanchas', 'pilotos', 'empleados')
     and policyname like '%_escritura'
     and coalesce(with_check, '') like '%asesora%';
  if cuantas <> 3 then
    raise exception 'La asesora administra % de 3 catálogos suyos', cuantas;
  end if;

  select string_agg(tablename, ', ' order by tablename) into cual
    from pg_policies
   where schemaname = 'public'
     and tablename in ('planes', 'temporadas', 'ajustes', 'documentos_legales')
     and policyname like '%_escritura'
     and coalesce(with_check, '') like '%asesora%';
  if cual is not null then
    raise exception 'Las tarifas y constantes se abrieron por error en: %', cual;
  end if;

  -- 2. Gerencia ya no escribe reservas.
  select string_agg(policyname, ', ') into cual
    from pg_policies
   where schemaname = 'public' and tablename = 'registros'
     and cmd in ('INSERT', 'UPDATE')
     and coalesce(with_check, '') like '%gerencia%';
  if cual is not null then
    raise exception 'Gerencia sigue pudiendo escribir reservas: %', cual;
  end if;

  -- 3. La puerta pública no se movió.
  select count(*) into cuantas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberían ser 5', cuantas;
  end if;

  raise notice 'La asesora administra lo suyo; gerencia mira; el turno habilita completo.';
end $$;
