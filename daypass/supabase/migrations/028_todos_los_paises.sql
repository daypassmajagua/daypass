-- ════════════════════════════════════════════════════════════════════════════
-- 028 · Todos los países del mundo
--
-- **Decisión del dueño:** «en los países, mete todos los países del mundo.»
-- Revierte la decisión de la 027, que dejó veinte a propósito con el argumento
-- de que «un desplegable de 195 en el muelle, a pleno sol y con una mano, es
-- peor que uno de veinte». El argumento no era falso; la respuesta correcta no
-- era recortar la lista sino arreglar el desplegable, y eso va en la misma
-- entrega: buscador y los de siempre arriba.
--
-- ── Cuáles son «todos» ──────────────────────────────────────────────────────
--
-- No hay una sola respuesta: la ONU reconoce 193, 195 con los observadores, y
-- la ISO 3166-1 lista **249** porque incluye territorios que emiten pasaporte
-- propio — Puerto Rico, Hong Kong, Curazao, Gibraltar. Se toma la ISO **porque
-- es la que habla el documento**: la Capitanía pide la nacionalidad que dice
-- el pasaporte, y un pasaporte de Hong Kong no dice China.
--
-- Por eso están también las que no tienen habitantes fijos (Antártida, Isla
-- Bouvet). Sacarlas obligaría a decidir a mano cuál sí y cuál no, y una lista
-- a medias es la que después no tiene el país de alguien.
--
-- ── `frecuente` ────────────────────────────────────────────────────────────
--
-- De 249, al pasadía llegan veinte. La columna los sube al principio del
-- desplegable; el resto sigue ahí, detrás del buscador. Arranca marcando los
-- veintidós de la 027 y **se edita desde Configuración**: es una semilla, no
-- una lista cerrada escrita en el código (regla 22).
--
-- ── Lo que NO se toca ───────────────────────────────────────────────────────
--
-- `on conflict (codigo) do nothing`: los que ya existen conservan su nombre y
-- su id. Ninguna reserva ni ningún pasajero cambia de país. Y 'OT' («Otro»),
-- que no es código ISO, se queda donde está — hay pasajeros apuntando a él y
-- el pasado no se reescribe (regla 4). Deja de ser frecuente, nada más: con
-- los 249 puestos ya no hace falta.
--
-- Idempotente. Se puede correr dos veces sin cambiar nada.
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '8s';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 · La columna
-- ════════════════════════════════════════════════════════════

alter table paises
  add column if not exists frecuente boolean not null default false;

comment on column paises.frecuente is
  'Sube el país al principio del desplegable. De 249, al pasadía llegan '
  'veinte: sin esto, elegir Colombia costaría lo mismo que elegir Kiribati. '
  'Se marca desde Configuración, no aquí.';

create index if not exists paises_frecuente_idx
  on paises (frecuente desc, nombre);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 · Los 249
--
-- ISO 3166-1 alpha-2, con el nombre en español. Ordenados por código para que
-- una diferencia contra la norma se vea de un vistazo.
-- ════════════════════════════════════════════════════════════

insert into paises (codigo, nombre, frecuente) values
  ('AD', 'Andorra', false),
  ('AE', 'Emiratos Árabes Unidos', false),
  ('AF', 'Afganistán', false),
  ('AG', 'Antigua y Barbuda', false),
  ('AI', 'Anguila', false),
  ('AL', 'Albania', false),
  ('AM', 'Armenia', false),
  ('AO', 'Angola', false),
  ('AQ', 'Antártida', false),
  ('AR', 'Argentina', true),
  ('AS', 'Samoa Americana', false),
  ('AT', 'Austria', false),
  ('AU', 'Australia', true),
  ('AW', 'Aruba', false),
  ('AX', 'Islas Åland', false),
  ('AZ', 'Azerbaiyán', false),
  ('BA', 'Bosnia y Herzegovina', false),
  ('BB', 'Barbados', false),
  ('BD', 'Bangladés', false),
  ('BE', 'Bélgica', false),
  ('BF', 'Burkina Faso', false),
  ('BG', 'Bulgaria', false),
  ('BH', 'Baréin', false),
  ('BI', 'Burundi', false),
  ('BJ', 'Benín', false),
  ('BL', 'San Bartolomé', false),
  ('BM', 'Bermudas', false),
  ('BN', 'Brunéi', false),
  ('BO', 'Bolivia', false),
  ('BQ', 'Caribe Neerlandés', false),
  ('BR', 'Brasil', true),
  ('BS', 'Bahamas', false),
  ('BT', 'Bután', false),
  ('BV', 'Isla Bouvet', false),
  ('BW', 'Botsuana', false),
  ('BY', 'Bielorrusia', false),
  ('BZ', 'Belice', false),
  ('CA', 'Canadá', true),
  ('CC', 'Islas Cocos', false),
  ('CD', 'República Democrática del Congo', false),
  ('CF', 'República Centroafricana', false),
  ('CG', 'Congo', false),
  ('CH', 'Suiza', true),
  ('CI', 'Costa de Marfil', false),
  ('CK', 'Islas Cook', false),
  ('CL', 'Chile', true),
  ('CM', 'Camerún', false),
  ('CN', 'China', false),
  ('CO', 'Colombia', true),
  ('CR', 'Costa Rica', true),
  ('CU', 'Cuba', false),
  ('CV', 'Cabo Verde', false),
  ('CW', 'Curazao', false),
  ('CX', 'Isla de Navidad', false),
  ('CY', 'Chipre', false),
  ('CZ', 'Chequia', false),
  ('DE', 'Alemania', true),
  ('DJ', 'Yibuti', false),
  ('DK', 'Dinamarca', false),
  ('DM', 'Dominica', false),
  ('DO', 'República Dominicana', false),
  ('DZ', 'Argelia', false),
  ('EC', 'Ecuador', true),
  ('EE', 'Estonia', false),
  ('EG', 'Egipto', false),
  ('EH', 'Sáhara Occidental', false),
  ('ER', 'Eritrea', false),
  ('ES', 'España', true),
  ('ET', 'Etiopía', false),
  ('FI', 'Finlandia', false),
  ('FJ', 'Fiyi', false),
  ('FK', 'Islas Malvinas', false),
  ('FM', 'Micronesia', false),
  ('FO', 'Islas Feroe', false),
  ('FR', 'Francia', true),
  ('GA', 'Gabón', false),
  ('GB', 'Reino Unido', true),
  ('GD', 'Granada', false),
  ('GE', 'Georgia', false),
  ('GF', 'Guayana Francesa', false),
  ('GG', 'Guernsey', false),
  ('GH', 'Ghana', false),
  ('GI', 'Gibraltar', false),
  ('GL', 'Groenlandia', false),
  ('GM', 'Gambia', false),
  ('GN', 'Guinea', false),
  ('GP', 'Guadalupe', false),
  ('GQ', 'Guinea Ecuatorial', false),
  ('GR', 'Grecia', false),
  ('GS', 'Islas Georgias del Sur y Sandwich del Sur', false),
  ('GT', 'Guatemala', false),
  ('GU', 'Guam', false),
  ('GW', 'Guinea-Bisáu', false),
  ('GY', 'Guyana', false),
  ('HK', 'Hong Kong', false),
  ('HM', 'Islas Heard y McDonald', false),
  ('HN', 'Honduras', false),
  ('HR', 'Croacia', false),
  ('HT', 'Haití', false),
  ('HU', 'Hungría', false),
  ('ID', 'Indonesia', false),
  ('IE', 'Irlanda', false),
  ('IL', 'Israel', true),
  ('IM', 'Isla de Man', false),
  ('IN', 'India', false),
  ('IO', 'Territorio Británico del Océano Índico', false),
  ('IQ', 'Irak', false),
  ('IR', 'Irán', false),
  ('IS', 'Islandia', false),
  ('IT', 'Italia', true),
  ('JE', 'Jersey', false),
  ('JM', 'Jamaica', false),
  ('JO', 'Jordania', false),
  ('JP', 'Japón', false),
  ('KE', 'Kenia', false),
  ('KG', 'Kirguistán', false),
  ('KH', 'Camboya', false),
  ('KI', 'Kiribati', false),
  ('KM', 'Comoras', false),
  ('KN', 'San Cristóbal y Nieves', false),
  ('KP', 'Corea del Norte', false),
  ('KR', 'Corea del Sur', false),
  ('KW', 'Kuwait', false),
  ('KY', 'Islas Caimán', false),
  ('KZ', 'Kazajistán', false),
  ('LA', 'Laos', false),
  ('LB', 'Líbano', false),
  ('LC', 'Santa Lucía', false),
  ('LI', 'Liechtenstein', false),
  ('LK', 'Sri Lanka', false),
  ('LR', 'Liberia', false),
  ('LS', 'Lesoto', false),
  ('LT', 'Lituania', false),
  ('LU', 'Luxemburgo', false),
  ('LV', 'Letonia', false),
  ('LY', 'Libia', false),
  ('MA', 'Marruecos', false),
  ('MC', 'Mónaco', false),
  ('MD', 'Moldavia', false),
  ('ME', 'Montenegro', false),
  ('MF', 'San Martín', false),
  ('MG', 'Madagascar', false),
  ('MH', 'Islas Marshall', false),
  ('MK', 'Macedonia del Norte', false),
  ('ML', 'Malí', false),
  ('MM', 'Birmania', false),
  ('MN', 'Mongolia', false),
  ('MO', 'Macao', false),
  ('MP', 'Islas Marianas del Norte', false),
  ('MQ', 'Martinica', false),
  ('MR', 'Mauritania', false),
  ('MS', 'Montserrat', false),
  ('MT', 'Malta', false),
  ('MU', 'Mauricio', false),
  ('MV', 'Maldivas', false),
  ('MW', 'Malaui', false),
  ('MX', 'México', true),
  ('MY', 'Malasia', false),
  ('MZ', 'Mozambique', false),
  ('NA', 'Namibia', false),
  ('NC', 'Nueva Caledonia', false),
  ('NE', 'Níger', false),
  ('NF', 'Isla Norfolk', false),
  ('NG', 'Nigeria', false),
  ('NI', 'Nicaragua', false),
  ('NL', 'Países Bajos', true),
  ('NO', 'Noruega', false),
  ('NP', 'Nepal', false),
  ('NR', 'Nauru', false),
  ('NU', 'Niue', false),
  ('NZ', 'Nueva Zelanda', false),
  ('OM', 'Omán', false),
  ('PA', 'Panamá', true),
  ('PE', 'Perú', true),
  ('PF', 'Polinesia Francesa', false),
  ('PG', 'Papúa Nueva Guinea', false),
  ('PH', 'Filipinas', false),
  ('PK', 'Pakistán', false),
  ('PL', 'Polonia', false),
  ('PM', 'San Pedro y Miquelón', false),
  ('PN', 'Islas Pitcairn', false),
  ('PR', 'Puerto Rico', false),
  ('PS', 'Palestina', false),
  ('PT', 'Portugal', true),
  ('PW', 'Palaos', false),
  ('PY', 'Paraguay', false),
  ('QA', 'Catar', false),
  ('RE', 'Reunión', false),
  ('RO', 'Rumania', false),
  ('RS', 'Serbia', false),
  ('RU', 'Rusia', false),
  ('RW', 'Ruanda', false),
  ('SA', 'Arabia Saudita', false),
  ('SB', 'Islas Salomón', false),
  ('SC', 'Seychelles', false),
  ('SD', 'Sudán', false),
  ('SE', 'Suecia', false),
  ('SG', 'Singapur', false),
  ('SH', 'Santa Elena', false),
  ('SI', 'Eslovenia', false),
  ('SJ', 'Svalbard y Jan Mayen', false),
  ('SK', 'Eslovaquia', false),
  ('SL', 'Sierra Leona', false),
  ('SM', 'San Marino', false),
  ('SN', 'Senegal', false),
  ('SO', 'Somalia', false),
  ('SR', 'Surinam', false),
  ('SS', 'Sudán del Sur', false),
  ('ST', 'Santo Tomé y Príncipe', false),
  ('SV', 'El Salvador', false),
  ('SX', 'Sint Maarten', false),
  ('SY', 'Siria', false),
  ('SZ', 'Esuatini', false),
  ('TC', 'Islas Turcas y Caicos', false),
  ('TD', 'Chad', false),
  ('TF', 'Territorios Australes Franceses', false),
  ('TG', 'Togo', false),
  ('TH', 'Tailandia', false),
  ('TJ', 'Tayikistán', false),
  ('TK', 'Tokelau', false),
  ('TL', 'Timor Oriental', false),
  ('TM', 'Turkmenistán', false),
  ('TN', 'Túnez', false),
  ('TO', 'Tonga', false),
  ('TR', 'Turquía', false),
  ('TT', 'Trinidad y Tobago', false),
  ('TV', 'Tuvalu', false),
  ('TW', 'Taiwán', false),
  ('TZ', 'Tanzania', false),
  ('UA', 'Ucrania', false),
  ('UG', 'Uganda', false),
  ('UM', 'Islas Menores Alejadas de Estados Unidos', false),
  ('US', 'Estados Unidos', true),
  ('UY', 'Uruguay', false),
  ('UZ', 'Uzbekistán', false),
  ('VA', 'Ciudad del Vaticano', false),
  ('VC', 'San Vicente y las Granadinas', false),
  ('VE', 'Venezuela', true),
  ('VG', 'Islas Vírgenes Británicas', false),
  ('VI', 'Islas Vírgenes de Estados Unidos', false),
  ('VN', 'Vietnam', false),
  ('VU', 'Vanuatu', false),
  ('WF', 'Wallis y Futuna', false),
  ('WS', 'Samoa', false),
  ('YE', 'Yemen', false),
  ('YT', 'Mayotte', false),
  ('ZA', 'Sudáfrica', false),
  ('ZM', 'Zambia', false),
  ('ZW', 'Zimbabue', false)
on conflict (codigo) do nothing;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 · Los de siempre, arriba
--
-- Los veintidós de la 027, que son de donde viene la gente a las Islas del
-- Rosario. Se marcan por código y no por nombre: 'Estados Unidos' pudo
-- quedar escrito de otra forma, el código no.
-- ════════════════════════════════════════════════════════════

update paises set frecuente = true
where codigo in (
  'CO', 'US', 'CA', 'MX', 'AR', 'BR', 'CL', 'PE', 'EC', 'PA', 'CR', 'VE',
  'ES', 'FR', 'DE', 'IT', 'GB', 'NL', 'CH', 'PT', 'AU', 'IL'
);

comment on table paises is
  'La nacionalidad que la Capitanía exige en la lista nominal (regla 15). '
  'Los 249 de la ISO 3166-1 y no los 195 de la ONU, porque la ISO es la que '
  'habla el pasaporte: uno de Hong Kong no dice China. Los veinte del pasadía '
  'van marcados como frecuentes y salen primero; al resto se llega buscando.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 · Comprobación
--
-- No cambia nada: solo dice si quedó como debía. Si alguna línea sale en
-- rojo, la migración no hizo lo que dice el encabezado.
-- ════════════════════════════════════════════════════════════

do $$
declare
  total int;
  frec  int;
begin
  select count(*) into total from paises;
  select count(*) into frec  from paises where frecuente;

  if total < 249 then
    raise exception 'Quedaron % países y deberían ser al menos 249', total;
  end if;
  if frec <> 22 then
    raise warning 'Hay % países frecuentes; se esperaban 22', frec;
  end if;

  raise notice 'paises: % en total, % frecuentes', total, frec;
end $$;
