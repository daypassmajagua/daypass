-- ============================================================
-- DayPASS — Datos semilla
-- Ejecutar DESPUÉS de 001_initial_schema.sql
-- ============================================================

-- Lanchas
insert into lanchas (codigo, nombre, capacidad) values
  ('MAJ1', 'Majagua 1', 40),
  ('MAJ2', 'Majagua 2', 40),
  ('CAT1', 'Catalina 1', 30),
  ('CAT2', 'Catalina 2', 30),
  ('CAT3', 'Catalina 3', 30),
  ('CAT4', 'Catalina 4', 30),
  ('POP', 'Popeye', 20),
  ('ARC', 'Arco', 20),
  ('OTR', 'Otra', null);

-- Canales
insert into canales (codigo, nombre) values
  ('AGV', 'Agencia de Viajes'),
  ('SVT', 'Sala de Ventas'),
  ('COR', 'Corporativo'),
  ('DIV', 'Diving Planet'),
  ('GRU', 'Grupos / Bodas'),
  ('HSC', 'Huéspedes HSSC'),
  ('HTL', 'Otros Hoteles'),
  ('REC', 'Walk-in / Recepción'),
  ('GER', 'Gerencia'),
  ('FREE', 'Lancha Particular');

-- Planes
insert into planes (nombre, categoria, nivel, incluye_transporte, precio_adulto_baja, precio_adulto_alta, precio_nino_baja, precio_nino_alta) values
  ('Rack Silver', 'rack', 'silver', true, 340926, 369370, 214009, 224422),
  ('Rack Gold', 'rack', 'gold', true, 415000, 443444, 214009, 224422),
  ('Rack Diamond', 'rack', 'diamond', true, 391852, 420296, 214009, 224422),
  ('Mayorista Silver', 'mayorista', 'silver', true, 250589, 274557, 180495, 188136),
  ('Mayorista Gold', 'mayorista', 'gold', true, 324663, 348631, 180495, 188136),
  ('Fidelidad Silver', 'fidelidad', 'silver', true, 243852, 264818, 172927, 178671),
  ('Fidelidad Gold', 'fidelidad', 'gold', true, 317937, 338892, 172927, 178671),
  ('Corporativo Silver', 'corporativo', 'silver', true, 272741, 295496, 170007, 189335),
  ('Grupo Neto Majagua', 'grupo_neto', 'na', true, 398889, 0, 215444, 0),
  ('Almuerzo sin Transporte Silver', 'almuerzo_sin_transporte', 'silver', false, 195764, 218644, 107628, 127966),
  ('Solo Transporte', 'solo_transporte', 'na', true, 75000, 85000, 75000, 85000),
  ('Guía de Turismo', 'guia', 'na', true, 205482, 205482, 0, 0);

-- Países
insert into paises (codigo, nombre) values
  ('COL', 'Colombia'), ('USA', 'Estados Unidos'), ('MEX', 'México'),
  ('ESP', 'España'), ('ARG', 'Argentina'), ('BRA', 'Brasil'),
  ('CAN', 'Canadá'), ('CHI', 'Chile'), ('ECU', 'Ecuador'),
  ('ITA', 'Italia'), ('ING', 'Inglaterra'), ('HOL', 'Holanda'),
  ('FRA', 'Francia'), ('ALE', 'Alemania'), ('URU', 'Uruguay'),
  ('PAR', 'Paraguay'), ('PAN', 'Panamá'), ('GUATE', 'Guatemala'),
  ('R D', 'República Dominicana'), ('ISR', 'Israel'), ('OTR', 'Otro');

-- Temporadas 2026
insert into temporadas (nombre, tipo, fecha_inicio, fecha_fin) values
  ('Temporada Baja 2026', 'baja', '2026-01-01', '2026-06-14'),
  ('Temporada Alta 2026', 'alta', '2026-06-15', '2026-08-31'),
  ('Temporada Baja 2026 II', 'baja', '2026-09-01', '2026-11-14'),
  ('Temporada Alta 2026 Fin de Año', 'alta', '2026-11-15', '2026-12-31');
