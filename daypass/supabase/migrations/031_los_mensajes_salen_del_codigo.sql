-- ════════════════════════════════════════════════════════════════════════════
-- 031 · Los mensajes salen del código
--
-- Encontrado al ir a construir «destinatarios y mensajes»: **los dos mensajes
-- que se le mandan al cliente están escritos en el código**, en
-- `lib/enlaceReserva.js`. Con el nombre del hotel, el nombre del muelle y los
-- emojis adentro.
--
-- Es la regla 22, textual: *«Toda constante operativa vive en base de datos y
-- la edita quien la usa. Ningún correo, texto de mensaje, horario o dato del
-- hotel escrito en el código.»*
--
-- No es un detalle de estilo. Hoy, cambiarle una coma al mensaje que Daniela
-- le manda a sesenta clientes al mes es una tarea de programación y un
-- despliegue. Es justo el tipo de dependencia que este producto vino a quitar.
--
-- ── Cómo quedan ────────────────────────────────────────────────────────────
--
-- Dos ajustes de texto largo con marcas entre llaves, que la pantalla
-- reemplaza antes de abrir WhatsApp:
--
--   {nombre}  el titular o el nombre del grupo
--   {fecha}   la fecha del pasadía, escrita en palabras
--   {enlace}  la dirección del check-in o del pase
--
-- Se siembran **con el texto que hoy está en el código, palabra por palabra**.
-- Esta migración no cambia lo que recibe el cliente: cambia quién lo puede
-- cambiar. Si algún día un ajuste queda vacío, el código conserva el mismo
-- texto de respaldo — un mensaje en blanco sería peor que uno viejo.
--
-- ── Y el hotel, que también estaba escrito ─────────────────────────────────
--
-- «Hotel San Pedro de Majagua» y «muelle de La Bodeguita» aparecían dentro de
-- los mensajes. Van como ajustes propios para que los mensajes futuros —los
-- correos de la Fase 6— los usen en vez de volver a escribirlos.
--
-- Idempotente: `on conflict do nothing` no le pisa el texto a nadie.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · Los datos del hotel
-- ════════════════════════════════════════════════════════════

insert into ajustes (clave, valor, descripcion) values
  ('hotel_nombre', 'Hotel San Pedro de Majagua',
   'Cómo se nombra el hotel en los mensajes al cliente.'),
  ('muelle_nombre', 'muelle de La Bodeguita',
   'De dónde sale la lancha, como se le dice al cliente.')
on conflict (clave) do nothing;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Los dos mensajes
--
-- El de invitación se manda al crear la reserva y lleva al check-in. El del
-- pase se manda después del cierre, cuando ya no hay check-in que hacer.
--
-- ── Comillas de dólar, y no `E'…\n'` ───────────────────────────────────────
--
-- La primera versión de esta migración encadenaba varios `E'…'` en líneas
-- seguidas y **no compilaba**: PostgreSQL sí concatena dos literales separados
-- por un salto de línea, pero solo el primero puede llevar el prefijo `E`; el
-- segundo se lee como un identificador suelto y revienta.
--
-- Con las comillas de dólar los saltos de línea son saltos de línea de verdad,
-- no barras escapadas. El mensaje se lee aquí igual que le llega al cliente,
-- que es justo lo que uno quiere poder revisar antes de correr esto.
-- ════════════════════════════════════════════════════════════

insert into ajustes (clave, valor, descripcion) values
  ('mensaje_invitacion',
$msg$¡Hola {nombre}! 🌊

Tu Day Tour en el Hotel San Pedro de Majagua es el {fecha}.

Antes de venir necesitamos el nombre y el documento de cada persona: la Capitanía de Puerto lo exige para poder zarpar. Ahí mismo eliges el almuerzo y confirmas tu asistencia:
{enlace}

Al terminar recibes tu pase para el muelle. ¡Nos vemos en las Islas del Rosario!$msg$,
   'El WhatsApp que se manda al crear la reserva. Marcas: {nombre} {fecha} {enlace}'),

  ('mensaje_pase',
$msg$¡Hola {nombre}! 🌊

Todo listo para tu Day Tour del {fecha}.

Aquí está tu pase para presentar en el muelle:
{enlace}

Te esperamos en el muelle de La Bodeguita. ¡Nos vemos!$msg$,
   'El WhatsApp que se manda después del cierre, con el pase. Marcas: {nombre} {fecha} {enlace}')
on conflict (clave) do nothing;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Comprobación
-- ════════════════════════════════════════════════════════════

do $$
declare faltan integer;
begin
  select count(*) into faltan
    from (values ('hotel_nombre'), ('muelle_nombre'),
                 ('mensaje_invitacion'), ('mensaje_pase')) as q(clave)
   where not exists (select 1 from ajustes a where a.clave = q.clave);

  if faltan > 0 then
    raise exception 'Faltan % ajustes de mensajes', faltan;
  end if;

  -- Un mensaje sin la marca del enlace es un mensaje que no lleva a ninguna
  -- parte. Es el único error de contenido que vale la pena atajar aquí.
  if exists (
    select 1 from ajustes
     where clave in ('mensaje_invitacion', 'mensaje_pase')
       and valor not like '%{enlace}%'
  ) then
    raise warning 'Hay un mensaje sin {enlace}: el cliente no va a recibir su enlace';
  end if;

  raise notice 'Los mensajes ya se editan desde Configuración.';
end $$;
