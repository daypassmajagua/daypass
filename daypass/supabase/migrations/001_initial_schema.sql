-- ============================================================
-- DayPASS — Migración inicial
-- Ejecutar en Supabase SQL Editor en el orden indicado
-- ============================================================

-- 1. PAÍSES
create table paises (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null
);

-- 2. LANCHAS
create table lanchas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  capacidad integer,
  activa boolean default true
);

-- 3. CANALES DE VENTA
create table canales (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null
);

-- 4. PLANES
create table planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null check (categoria in (
    'rack', 'rack_descuento', 'mayorista', 'mayorista_exterior',
    'fidelidad', 'corporativo', 'grupo_neto',
    'almuerzo_sin_transporte', 'guia', 'solo_transporte', 'blue_dive'
  )),
  nivel text check (nivel in ('silver', 'gold', 'diamond', 'na')),
  incluye_transporte boolean default true,
  precio_adulto_baja numeric(12,2) default 0,
  precio_adulto_alta numeric(12,2) default 0,
  precio_nino_baja numeric(12,2) default 0,
  precio_nino_alta numeric(12,2) default 0,
  activo boolean default true
);

-- 5. TEMPORADAS
create table temporadas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('baja', 'alta')),
  fecha_inicio date not null,
  fecha_fin date not null
);

-- 6. CLIENTES
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  identificacion text,
  telefono text,
  email text,
  pais_id uuid references paises(id),
  created_at timestamptz default now()
);

-- 7. AGENCIAS
create table agencias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  email text,
  activa boolean default true
);

-- 8. REGISTROS (tabla principal)
create table registros (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('individual', 'grupo')),
  estado text not null default 'confirmada' check (estado in (
    'tentativa', 'confirmada', 'en_isla', 'completada', 'noshow', 'cancelada'
  )),
  nombre_pasajero text not null,
  identificacion text,
  nombre_grupo text,
  cliente_id uuid references clientes(id),
  lancha_id uuid references lanchas(id) not null,
  pais_id uuid references paises(id),
  plan_id uuid references planes(id) not null,
  temporada text not null check (temporada in ('baja', 'alta')),
  canal_id uuid references canales(id) not null,
  agencia_id uuid references agencias(id),
  agencia_nombre text,
  adultos integer not null default 1,
  ninos integer not null default 0,
  infantes integer not null default 0,
  cortesias integer not null default 0,
  precio_adulto numeric(12,2) not null default 0,
  precio_nino numeric(12,2) not null default 0,
  precio_lancha numeric(12,2) not null default 0,
  total_calculado numeric(12,2) generated always as (
    (adultos * precio_adulto) + (ninos * precio_nino) + precio_lancha
  ) stored,
  forma_pago text check (forma_pago in ('deposito', 'cxc', 'pago_directo', 'cortesia')),
  impuestos_puerto text not null default 'si' check (impuestos_puerto in ('si', 'no', 'exe')),
  voucher_os text,
  folio_zeus text,
  observaciones text,
  generada_por uuid references auth.users(id),
  vendida_por text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on registros (fecha);
create index on registros (estado);
create index on registros (lancha_id);
create index on registros (fecha, estado);

-- 9. TRIGGER updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger registros_updated_at
  before update on registros
  for each row execute function set_updated_at();

-- 10. ROW LEVEL SECURITY
alter table registros enable row level security;
alter table planes enable row level security;
alter table lanchas enable row level security;
alter table canales enable row level security;
alter table agencias enable row level security;
alter table clientes enable row level security;
alter table temporadas enable row level security;
alter table paises enable row level security;

create policy "authenticated_full_access" on registros for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on planes for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on lanchas for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on canales for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on agencias for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on clientes for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on temporadas for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on paises for all using (auth.role() = 'authenticated');
