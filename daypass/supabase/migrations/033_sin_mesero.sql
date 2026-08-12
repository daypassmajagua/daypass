-- ════════════════════════════════════════════════════════════════════════════
-- 033 · Fuera el rol de mesero
--
-- **Decisión del dueño (11 ago).** Estaba pendiente desde `plan-diseno.md` §2.1
-- y la auditoría de UX la volvió urgente: el rol estaba **funcionalmente
-- muerto**. Su `home` era `/isla` pero su lista de rutas solo tenía `/cocina`,
-- así que la puerta lo devolvía a `/isla` una y otra vez. Quien entrara con esa
-- cuenta no llegaba a ninguna pantalla.
--
-- Quien atiende mesas pasa a `admin_isla`, que ve Hoy, Isla y Almuerzos — más
-- de lo que el mesero podía ver, y sin el bucle.
--
-- La comanda sigue siendo de Zeus: esto no cambia la frontera, cambia con qué
-- cuenta se consulta el pronóstico.
--
-- ── La trampa de esta migración, y por qué está escrita ─────────────────────
--
-- La 017 dejó una restricción llamada `perfiles_rol_vigente` que dice
-- `check (rol <> 'recepcion')`. Es **la misma restricción** que hay que tocar
-- ahora, y como PostgreSQL no deja tener dos con el mismo nombre, hay que
-- soltarla y volver a crearla.
--
-- Si la nueva nombrara solo a `mesero`, **`recepcion` volvería a ser
-- asignable** — un rol retirado hace tres días reabierto por descuido, y sin
-- que nada avisara. Por eso la de abajo los nombra a los dos y por eso la
-- comprobación final verifica los dos.
--
-- ── Por qué el valor sigue en el enum ───────────────────────────────────────
--
-- Lo mismo que en la 017: PostgreSQL no puede quitar un valor de un enum.
-- Borrarlo de verdad obliga a crear un tipo nuevo y **soltar antes todo lo que
-- dependa del actual** — y de `tiene_rol()` cuelgan las políticas de RLS de las
-- 26 tablas. Se desmontaría la seguridad entera por un cambio cosmético.
--
-- ── Las políticas que lo nombran NO se tocan ────────────────────────────────
--
-- Hay cuatro sitios que preguntan por el rol. Con nadie que lo tenga, todas
-- quedan neutras o más estrictas — ninguna se afloja:
--
--   · 015 (escritura de reservas)   `not tiene_rol('mesero','recepcion')`
--   · 019 (pasajeros y embarques)   `not tiene_rol('mesero') or puedo_operar_muelle()`
--   · 020 (personas)                idem
--        → las tres son siempre verdaderas sin meseros: dejan de restringir a
--          nadie porque no había a quién restringir.
--
--   · 018 (`marcar_revision_cocina`) `if not (puedo_operar_isla() or tiene_rol('mesero'))`
--        → queda `if not puedo_operar_isla()`: **más estricto**. Y correcto —
--          quien le lleva el número a cocina es quien está en la isla, que es
--          justo el rol al que se mudan los meseros.
--
-- Reescribirlas sería redefinir funciones y políticas para no cambiar nada, y
-- toda redefinición vuelve a abrir permisos que hay que acordarse de cerrar
-- (la lección de la 012). La 017 tampoco tocó las de recepción.
--
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ── 1. Mover a quien lo tenga, antes de cerrar la puerta ──
-- Primero mover y después restringir: al revés, el `update` chocaría contra su
-- propia restricción y la migración no correría.
do $$
declare movidos integer;
begin
  update perfiles
     set rol = 'admin_isla'::rol_usuario
   where rol = 'mesero'::rol_usuario;

  get diagnostics movidos = row_count;
  if movidos > 0 then
    raise notice '% perfil(es) de mesero pasaron a admin_isla.', movidos;
  else
    raise notice 'No había perfiles con el rol de mesero.';
  end if;
end $$;


-- ── 2. Cerrar la puerta a los dos roles retirados ──
-- Nombrar a `recepcion` aquí no es redundante: es lo único que impide que
-- reemplazar esta restricción lo reabra.
alter table perfiles drop constraint if exists perfiles_rol_vigente;
alter table perfiles add constraint perfiles_rol_vigente
  check (rol not in ('recepcion'::rol_usuario, 'mesero'::rol_usuario));

comment on constraint perfiles_rol_vigente on perfiles is
  'Dos roles retirados y la base los rechaza: recepcion (8 ago 2026, la isla '
  'hace ese trabajo) y mesero (11 ago 2026, estaba roto y su trabajo lo hace '
  'admin_isla). Los valores siguen en el enum porque PostgreSQL no deja '
  'quitarlos sin rehacer las politicas de las 26 tablas. Quien edite esta '
  'restriccion tiene que volver a nombrar a los dos.';

comment on type rol_usuario is
  'Seis roles vigentes: super_admin, gerencia, directora, asesora, '
  'asesora_comercial y admin_isla. `recepcion` y `mesero` estan retirados y la '
  'restriccion perfiles_rol_vigente impide asignarlos.';


-- ── 3. La bitácora conserva el rol con el que se actuó ──
-- Igual que en la 017: si alguien hizo algo siendo mesero, eso pasó y el rastro
-- lo dice. Una bitácora que se corrige deja de ser una bitácora.


-- ── Comprobaciones ──
do $$
declare
  quedan integer;
  cubre_recepcion boolean;
  cubre_mesero boolean;
  cuantas integer;
  abiertas text;
begin
  -- 1. Nadie quedó con el rol retirado.
  select count(*) into quedan
    from perfiles
   where rol in ('mesero'::rol_usuario, 'recepcion'::rol_usuario);
  if quedan > 0 then
    raise exception 'Quedan % perfiles con un rol retirado', quedan;
  end if;

  -- 2. La restricción nombra a los dos. Se lee del catálogo en vez de
  --    probarla con un insert: comprobar un candado abriéndolo es como se
  --    cerró por error el día operativo del 9 de agosto.
  select position('recepcion' in pg_get_constraintdef(oid)) > 0,
         position('mesero'    in pg_get_constraintdef(oid)) > 0
    into cubre_recepcion, cubre_mesero
    from pg_constraint
   where conname = 'perfiles_rol_vigente'
     and conrelid = 'perfiles'::regclass;

  if cubre_recepcion is null then
    raise exception 'No existe la restriccion perfiles_rol_vigente';
  end if;
  if not cubre_recepcion then
    raise exception 'La restriccion dejo de cubrir recepcion: se reabrio un rol retirado';
  end if;
  if not cubre_mesero then
    raise exception 'La restriccion no cubre mesero';
  end if;

  -- 3. La casa: esta migración no redefine funciones, pero se comprueba igual.
  select count(*), string_agg(p.proname, ', ' order by p.proname)
    into cuantas, abiertas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');
  if cuantas <> 5 then
    raise exception 'anon puede ejecutar % funciones y deberian ser 5: %', cuantas, abiertas;
  end if;

  raise notice 'Seis roles. Quien atiende mesas es admin_isla.';
end $$;
