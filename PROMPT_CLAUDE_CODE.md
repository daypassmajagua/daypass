# Prompt para Claude Code — DayPASS MVP

> Copia todo el contenido de este archivo y pégalo al inicio de tu sesión con Claude Code.

---

## INSTRUCCIÓN PRINCIPAL

Eres un desarrollador senior fullstack. Tu tarea es construir el MVP de **DayPASS**, un sistema operativo de pasadías para el Hotel San Pedro de Majagua (Islas del Rosario, Colombia).

Este sistema reemplaza un Excel de 88 columnas que el equipo comercial usa todos los días para registrar clientes, generar reportes y preparar información para su sistema hotelero (Zeus).

**No estás replicando el Excel. Estás resolviendo el problema que el Excel resolvía mal.**

---

## STACK TÉCNICO

Usa exactamente este stack — no propongas alternativas:

- **Frontend:** React + Vite + Tailwind CSS
- **Backend / BD / Auth:** Supabase (PostgreSQL, Auth, Realtime)
- **Routing:** React Router v6
- **Estado global:** Zustand (liviano, suficiente para este scope)
- **Formularios:** React Hook Form + Zod para validación
- **Íconos:** Lucide React
- **Notificaciones / toasts:** Sonner
- **Tablas:** TanStack Table

No uses Redux. No uses Next.js. No uses ninguna librería de UI externa como shadcn o MUI — los componentes se construyen con Tailwind directamente.

---

## CONTEXTO DE NEGOCIO (LEE ESTO ANTES DE ESCRIBIR CÓDIGO)

### ¿Qué es un pasadía?
Un pasadía (Day Tour) es cuando un cliente visita el hotel sin hospedarse. Llega en lancha, disfruta los servicios del día (plan que incluye comida, bebidas y transporte) y regresa. El hotel recibe entre 60 y 120 personas así cada día.

### Roles del sistema
- **`asesora`**: registra pasadías durante el día. Es el usuario más frecuente. Necesita velocidad.
- **`coordinadora`**: supervisa, genera el tentativo y el listado de folios.
- **`operacion`**: solo lectura. Ve el listado del día para coordinar embarques.
- **`admin`**: gestiona catálogos (planes, lanchas, canales) y usuarios.

### Flujo diario real
1. Asesora recibe reserva → abre DayPASS → registra en menos de 60 segundos.
2. Al cierre del día → coordinadora hace clic en "Generar Tentativo" → copia texto → envía por correo/WhatsApp.
3. Siguiente mañana → coordinadora abre "Listado para Folios" → entra a Zeus → crea folios → vuelve a DayPASS → escribe el número de folio en cada registro.

### Temporadas
El hotel tiene dos temporadas tarifarias: **BAJA** y **ALTA**. La temporada se determina por la fecha del registro según un calendario configurable. Los planes tienen precios distintos por temporada — el sistema los aplica automáticamente.

---

## ESQUEMA DE BASE DE DATOS

Ejecuta estas migraciones en Supabase en el orden indicado.

```sql
-- 1. PAÍSES
create table paises (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null
);

-- 2. LANCHAS
create table lanchas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- MAJ1, MAJ2, CAT1, CAT2, CAT3, CAT4, POP, ARC, OTR
  nombre text not null,        -- Majagua 1, Catalina 2, etc.
  capacidad integer,
  activa boolean default true
);

-- 3. CANALES DE VENTA
create table canales (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- AGV, SVT, COR, DIV, GRU, HSC, HTL, REC, GER, FREE
  nombre text not null         -- Agencia, Sala de Ventas, Corporativo, etc.
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

-- 5. TEMPORADAS (calendario)
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

  -- Quién
  nombre_pasajero text not null,       -- nombre del cliente o nombre del grupo
  identificacion text,
  nombre_grupo text,                   -- si es grupo, nombre del grupo o voucher
  cliente_id uuid references clientes(id),

  -- Dónde y cómo llega
  lancha_id uuid references lanchas(id) not null,
  pais_id uuid references paises(id),

  -- Qué compró
  plan_id uuid references planes(id) not null,
  temporada text not null check (temporada in ('baja', 'alta')),
  canal_id uuid references canales(id) not null,
  agencia_id uuid references agencias(id),
  agencia_nombre text,                 -- nombre libre si no está en el catálogo

  -- Cuántos
  adultos integer not null default 1,
  ninos integer not null default 0,    -- 3 a 8 años
  infantes integer not null default 0, -- menores de 3 años, sin costo
  cortesias integer not null default 0,

  -- Cuánto
  precio_adulto numeric(12,2) not null default 0,
  precio_nino numeric(12,2) not null default 0,
  precio_lancha numeric(12,2) not null default 0,
  total_calculado numeric(12,2) generated always as (
    (adultos * precio_adulto) + (ninos * precio_nino) + precio_lancha
  ) stored,

  -- Pago
  forma_pago text check (forma_pago in ('deposito', 'cxc', 'pago_directo', 'cortesia')),
  impuestos_puerto text not null default 'si' check (impuestos_puerto in ('si', 'no', 'exe')),

  -- Documentos
  voucher_os text,
  folio_zeus text,

  -- Notas
  observaciones text,

  -- Quién gestionó
  generada_por uuid references auth.users(id),
  vendida_por text,                    -- nombre libre (asesora)

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices para consultas del día
create index on registros (fecha);
create index on registros (estado);
create index on registros (lancha_id);
create index on registros (fecha, estado);

-- 9. TRIGGER: updated_at automático
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

-- Política simple para MVP: usuarios autenticados tienen acceso total
create policy "authenticated_full_access" on registros
  for all using (auth.role() = 'authenticated');
-- Replica esta política para las demás tablas
```

---

## DATOS SEMILLA (seed)

Carga estos datos al iniciar la base de datos.

```sql
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

-- Planes (precios de ejemplo — el admin los actualiza desde la interfaz)
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

-- Países más comunes
insert into paises (codigo, nombre) values
  ('COL', 'Colombia'), ('USA', 'Estados Unidos'), ('MEX', 'México'),
  ('ESP', 'España'), ('ARG', 'Argentina'), ('BRA', 'Brasil'),
  ('CAN', 'Canadá'), ('CHI', 'Chile'), ('ECU', 'Ecuador'),
  ('ITA', 'Italia'), ('ING', 'Inglaterra'), ('HOL', 'Holanda'),
  ('FRA', 'Francia'), ('ALE', 'Alemania'), ('URU', 'Uruguay'),
  ('PAR', 'Paraguay'), ('PAN', 'Panamá'), ('GUATE', 'Guatemala'),
  ('R D', 'República Dominicana'), ('ISR', 'Israel'), ('OTR', 'Otro');

-- Temporada de ejemplo
insert into temporadas (nombre, tipo, fecha_inicio, fecha_fin) values
  ('Temporada Baja 2026', 'baja', '2026-01-01', '2026-06-14'),
  ('Temporada Alta 2026', 'alta', '2026-06-15', '2026-08-31'),
  ('Temporada Baja 2026 II', 'baja', '2026-09-01', '2026-11-14'),
  ('Temporada Alta 2026 Fin de Año', 'alta', '2026-11-15', '2026-12-31');
```

---

## MÓDULOS DEL MVP (scope exacto)

Construye exactamente esto. Nada más, nada menos.

### 1. Autenticación
- Login con email + contraseña vía Supabase Auth.
- Redirección post-login al dashboard del día.
- Logout en la navbar.
- No construyas registro de usuarios en la UI — los usuarios se crean desde el panel de Supabase.

### 2. Dashboard del Día (`/`)
Vista principal. Se carga mostrando los datos del día actual.

**Métricas superiores (cards):**
- Total personas confirmadas (adultos + niños, excluyendo tentativas y canceladas).
- Total personas en tentativa.
- Total grupos vs. individuales.
- Ingresos proyectados del día (suma de `total_calculado` de registros confirmados).

**Distribución por lancha:**
- Lista de lanchas con cantidad de personas asignadas y barra de progreso visual según capacidad.

**Mix de canales:**
- Distribución porcentual y absoluta por canal (AGV: 45 pax, SVT: 12 pax, etc.).

**Pendientes operativos (alertas):**
- Registros sin `folio_zeus`.
- Registros sin `forma_pago`.
- Registros con `impuestos_puerto = 'no'` (recordatorio de cobro en muelle).
- Cada alerta es un link que lleva directo al registro.

**Selector de fecha:** el dashboard puede navegar a cualquier día del mes.

### 3. Registro de Pasadía (`/nuevo`)
Formulario principal. Debe completarse en menos de 60 segundos.

**Campos obligatorios:**
- Nombre del pasajero / líder de grupo (texto libre)
- Tipo: Individual / Grupo (radio button, cambia los campos dinámicamente)
- Lancha (dropdown)
- Plan (dropdown — al seleccionar, carga precios automáticamente)
- Canal de venta (dropdown)
- Adultos (número, mínimo 1)
- Forma de pago (dropdown)
- Impuestos de puerto (SI / NO / EXE — 3 botones grandes)

**Campos opcionales:**
- Identificación
- País (dropdown con búsqueda)
- Niños / Infantes / Cortesías
- Agencia / empresa (texto libre, con autocompletado de agencias guardadas)
- Nombre del grupo / Voucher / OS (aparece solo si tipo = Grupo)
- Vendida por (nombre de la asesora — texto libre)
- Precio adulto / niño (editables manualmente, prellenados desde el plan)
- Observaciones (textarea)

**Comportamiento:**
- Al seleccionar un plan, el sistema determina la temporada según la fecha actual y precarga los precios correspondientes.
- El total se calcula en tiempo real y se muestra prominentemente antes de guardar.
- Al guardar exitosamente, muestra toast de confirmación y ofrece dos opciones: "Nuevo registro" o "Ver listado del día".
- Estado por defecto al crear: `confirmada`.

### 4. Listado del Día (`/dia`)
Vista de todos los registros del día, ordenados por lancha.

**Por cada registro muestra:**
- Nombre / grupo
- Lancha
- Plan
- Adultos + Niños
- Total calculado
- Forma de pago
- Estado (badge de color)
- Folio Zeus (campo editable inline — sin abrir el registro)
- Íconos de alerta si falta folio, pago o impuestos

**Acciones por registro:**
- Editar (abre el formulario completo)
- Cambiar estado (dropdown inline: tentativa → confirmada → en isla → completada / noshow / cancelada)
- Eliminar (con confirmación)

**Filtros:**
- Por lancha
- Por estado
- Por canal

### 5. Generador de Tentativo (`/tentativo`)
Botón grande: **"Generar Tentativo del Día"**.

El sistema construye este texto automáticamente:

```
TENTATIVO DAYPASS — [Fecha larga en español]

Total proyectado: X personas
→ X adultos | X niños | X cortesías

Por canal:
- Agencias (AGV): X pax
- Sala de Ventas (SVT): X pax
- [resto de canales con pax > 0]

GRUPOS:
• [Nombre grupo] — [Agencia] — X adultos — [Plan] — [Lancha]
  Voucher: [OS si existe]
...

INDIVIDUALES:
• [Nombre] — X adultos — [Plan] — [Lancha]
...

⚠️ Tentativas (no confirmadas): X personas
• [Nombre] — X pax — [Plan]
```

Botón: **"Copiar tentativo"** — copia el texto al portapapeles con un clic.

### 6. Listado para Folios (`/folios`)
Vista limpia para crear folios en Zeus. Ordenada por lancha.

```
LISTADO PARA FOLIOS — [Fecha]

MAJAGUA 1 — X personas
  1. [Nombre / Grupo] | [Agencia] | X adultos [X niños] | [Plan] | [Pago] | [Impuestos] | Folio: ___
  2. ...

MAJAGUA 2 — X personas
  ...
```

- El campo "Folio" es editable inline en la misma vista.
- Botón: **"Copiar listado"** — genera texto plano para pegar en WhatsApp o correo.
- Botón: **"Marcar todos como completados"** (solo activa los que tienen folio asignado).

### 7. Historial (`/historial`)
Lista de registros con filtros por:
- Rango de fechas
- Lancha
- Plan
- Canal
- Estado
- Asesora (vendida_por)

Paginación de 50 registros por página. Exportación a CSV.

### 8. Configuración (`/config`) — solo rol admin
- CRUD de planes (nombre, categoría, nivel, precios por temporada).
- CRUD de lanchas (activa/inactiva, capacidad).
- CRUD de temporadas (fechas de inicio y fin).
- Lista de agencias guardadas.

---

## REGLAS DE NEGOCIO CRÍTICAS

```
1. TEMPORADA AUTOMÁTICA
   Al abrir el formulario de nuevo registro, el sistema consulta la tabla `temporadas`
   y determina si la fecha actual cae en una temporada BAJA o ALTA.
   Esa temporada se usa para precargar los precios del plan seleccionado.
   El usuario puede ver qué temporada está activa pero no puede cambiarla manualmente.

2. CÁLCULO DE TOTAL
   total = (adultos × precio_adulto) + (ninos × precio_nino) + precio_lancha
   Los infantes (< 3 años) y las cortesías NO suman al total.
   El total se recalcula en tiempo real en el formulario.

3. FOLIO ZEUS
   No es obligatorio para crear/confirmar un registro.
   Sí es obligatorio para cambiar el estado a "completada".
   Si se intenta cambiar a "completada" sin folio, el sistema muestra un error
   claro: "Debes ingresar el número de folio Zeus antes de completar este registro."

4. GRUPOS
   Si tipo = "grupo", el campo "nombre del grupo / voucher" pasa a ser obligatorio.
   Los grupos pueden tener mezcla de adultos, niños, infantes y cortesías.
   Un grupo se registra como un solo registro (no un registro por persona).

5. ESTADO DEFAULT
   Al crear un registro, el estado por defecto es "confirmada".
   La opción "tentativa" existe pero no es el default — la mayoría de registros
   ya son confirmados cuando se ingresan.

6. PRECIOS MANUALES
   Las asesoras pueden editar manualmente el precio adulto y precio niño.
   El sistema muestra los precios del plan como sugerencia pero no los bloquea.
   Esto cubre casos de tarifas especiales aprobadas por dirección comercial.

7. OBSERVACIONES SEPARADAS
   Las notas operativas van en el campo "observaciones", nunca en el campo
   de identificación. Esto es un cambio deliberado respecto al Excel anterior.
```

---

## UX / COMPORTAMIENTO ESPERADO

- **Mobile-first.** El formulario debe funcionar perfectamente en pantalla de 375px. Los dropdowns usan elementos nativos del navegador en móvil.
- **Feedback inmediato.** Cada acción importante (guardar, copiar, cambiar estado) tiene un toast de confirmación visible.
- **Carga rápida.** El dashboard del día debe cargar en menos de 2 segundos. Usa queries optimizadas a Supabase con los índices definidos.
- **Sin modales en el flujo principal.** Las confirmaciones de eliminación sí usan modal. El resto del flujo es navegación directa.
- **Colores de estado claros:**
  - `tentativa` → gris
  - `confirmada` → azul
  - `en_isla` → verde
  - `completada` → verde oscuro
  - `noshow` → naranja
  - `cancelada` → rojo

---

## ESTRUCTURA DE ARCHIVOS SUGERIDA

```
src/
├── components/
│   ├── ui/              # Botones, inputs, badges, cards (con Tailwind)
│   ├── layout/          # Navbar, Sidebar, PageHeader
│   └── registros/       # RegistroForm, RegistroRow, EstadoBadge
├── pages/
│   ├── Dashboard.jsx
│   ├── NuevoRegistro.jsx
│   ├── ListadoDia.jsx
│   ├── Tentativo.jsx
│   ├── Folios.jsx
│   ├── Historial.jsx
│   └── Config.jsx
├── hooks/
│   ├── useRegistros.js  # CRUD de registros
│   ├── useTemporada.js  # Determina temporada por fecha
│   └── usePlanes.js     # Carga planes con precios
├── lib/
│   ├── supabase.js      # Cliente de Supabase
│   └── utils.js         # Formateo de fechas, monedas, etc.
├── store/
│   └── useAppStore.js   # Estado global con Zustand (fecha activa, filtros)
└── App.jsx
```

---

## LO QUE NO DEBES CONSTRUIR EN EL MVP

- Integración directa con Zeus (no existe API pública).
- Envío automático de correos o WhatsApp.
- Dashboard gerencial con comparativos mes a mes.
- Módulo de comisiones por asesora.
- App móvil nativa.
- Multi-hotel (este sistema es solo para Hotel San Pedro de Majagua).
- Registro de huéspedes del hotel (no es Day Tour).

---

## VARIABLES DE ENTORNO NECESARIAS

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

---

## ORDEN DE CONSTRUCCIÓN RECOMENDADO

1. Configura el proyecto (Vite + React + Tailwind + Supabase client).
2. Ejecuta las migraciones SQL y carga el seed.
3. Construye la autenticación (login / logout / ruta protegida).
4. Construye el formulario de nuevo registro (`/nuevo`) — este es el módulo más crítico.
5. Construye el listado del día (`/dia`) con edición inline de folio y cambio de estado.
6. Construye el dashboard (`/`) con las 3 métricas y las alertas.
7. Construye el generador de tentativo (`/tentativo`).
8. Construye el listado para folios (`/folios`).
9. Construye el historial con filtros (`/historial`).
10. Construye la configuración de catálogos (`/config`).

Sigue este orden. No avances al siguiente módulo sin que el anterior esté funcionando y probado.

---

*DayPASS MVP — Hotel San Pedro de Majagua · AISA Creative Partners*
