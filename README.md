# 🌊 DayPASS — Sistema Operativo de Pasadías

> Sistema digital que reemplaza el registro manual en Excel del área comercial y operativa del Hotel San Pedro de Majagua, automatizando el flujo completo desde la reserva hasta el folio en Zeus.

---

## 📌 1. Descripción del Proyecto

El Hotel San Pedro de Majagua opera diariamente con decenas de pasajeros que llegan en modalidad **Day Tour**: clientes individuales y grupos que acceden a los servicios del hotel sin hospedarse. Hoy, todo ese flujo se registra en un archivo de Excel de 88 columnas, con una hoja por día del mes, datos cruzados manualmente y sin ninguna automatización.

El problema no es solo técnico — es operativo. Cada día el equipo comercial debe:

1. Registrar cada cliente o grupo en el Excel (proceso lento y propenso a errores).
2. Al cierre del día, **armar manualmente un tentativo** y enviarlo por correo.
3. En la mañana siguiente, **preparar un listado a mano** para crear los folios en Zeus.

Esto genera errores, duplicados, información perdida en notas informales, y un equipo que pierde tiempo valioso en tareas que un sistema debería resolver automáticamente.

**DayPASS** nace para eliminar ese Excel. No para replicarlo — para hacerlo mejor.

---

## 🎯 2. Objetivos del Sistema

### Operativos
- Registrar cada pasadía (individual o grupo) en menos de 60 segundos.
- Eliminar la doble entrada de datos (tentativo manual + listado para folios).
- Generar el tentativo del día con un solo clic.
- Preparar automáticamente el listado para creación de folios en Zeus.

### De negocio
- Tener visibilidad en tiempo real de cuántas personas están confirmadas para el día.
- Conocer el mix de canales de venta (agencias, sala de ventas, walk-in, corporativo).
- Cruzar ingresos reales con folios Zeus para análisis de consumo por cliente/grupo.
- Construir una base de datos de agencias, clientes recurrentes y canales de venta.

### De eficiencia
- Reducir el tiempo de cierre diario de ~45 minutos a menos de 5 minutos.
- Eliminar errores por transcripción manual.
- Centralizar la información en un solo lugar accesible por todo el equipo autorizado.

---

## 👤 3. Tipos de Usuario

### Asesora Comercial (rol principal)
Usuario de mayor uso del sistema. Registra cada pasadía durante el día desde cualquier dispositivo. Necesita velocidad: formularios cortos, dropdowns inteligentes, sin fricciones.

### Coordinadora / Jefe de Operaciones
Supervisa el cierre del día, genera el tentativo, revisa totales y aprueba el listado para folios. Usa principalmente el dashboard y los módulos de reporte.

### Operación (Isla / Muelle)
Consulta el listado del día para verificar embarques y coordinar lanchas. Solo lectura. Necesita ver: nombre, lancha asignada, cantidad de personas, plan.

### Administrador del Sistema
Gestiona catálogos (planes, tarifas, canales, lanchas), usuarios y configuraciones generales. Tiene acceso total.

---

## 🔄 4. Flujo Actual vs. Flujo Propuesto

### Flujo Actual (con Excel)

```
Reserva confirmada
     ↓
Asesora abre el Excel → busca la hoja del día correcto
     ↓
Registra manualmente: nombre, ID, lancha, plan, tarifa, agencia,
forma de pago, impuestos, generó, vendió, voucher, folio...
     ↓
Al final del día → construye el tentativo a mano en correo
     ↓
Envía por correo al equipo
     ↓
Siguiente mañana → arma listado para Zeus a mano
     ↓
Entra a Zeus → crea los folios uno por uno
     ↓
(Opcional) Regresa al Excel → escribe el número de folio
```

**Problemas identificados:**
- El Excel tiene 88 columnas y una hoja por día. No es usable en móvil.
- Los planes están distribuidos en columnas separadas (BAJA/ALTA × RACK/MAY/FID/CORP × SILVER/GOLD/DIAMOND). Un error de columna = dato incorrecto.
- Las observaciones críticas van metidas en el campo de identificación (ej: *"infante 2 años, tarifa especial, OJOOOO COBRAR IMPUESTOS"*).
- El tentativo se construye mirando el Excel y resumiéndolo a mano.
- El folio Zeus se anota, pero no siempre se completa.

### Flujo Propuesto (con DayPASS)

```
Reserva confirmada
     ↓
Asesora abre DayPASS → "Nueva Reserva"
     ↓
Formulario inteligente: nombre/grupo, lancha (dropdown),
plan (dropdown), temporada (automática), personas, precios
(calculados automáticamente), agencia, pago, observaciones
     ↓
Guardar → registro confirmado en tiempo real
     ↓
Al cierre del día → botón "Generar Tentativo"
     ↓
Sistema genera resumen formateado listo para copiar/enviar
     ↓
Siguiente mañana → botón "Listado para Folios"
     ↓
Sistema genera listado limpio ordenado por lancha
     ↓
Coordinadora crea folios en Zeus → regresa a DayPASS
→ ingresa número de folio por registro (1 campo, 1 clic)
```

---

## 🧩 5. Módulos del Sistema

### Módulo 1 — Registro de Pasadías

El corazón del sistema. Permite crear un registro por cada pasadía, ya sea individual o grupal. El formulario es inteligente: adapta los campos según el tipo de cliente y calcula tarifas automáticamente.

**Subtipos:**
- **Individual**: un pasajero o familia pequeña (registro simple).
- **Grupo**: conjunto de personas bajo un líder o agencia (25–50+ pax), con nombre de grupo/voucher y cantidad de pax desagregada por adultos, niños y cortesías.

**Estados posibles de un registro:**
- `Tentativa` → `Confirmada` → `En isla` → `Completada` / `No show` / `Cancelada`

### Módulo 2 — Dashboard Diario

Vista de control del día en curso. Muestra de un vistazo:

- Total de personas confirmadas vs. tentativas.
- Desglose por lancha (MAJ1, MAJ2, CAT1–4, POP, OTR).
- Mix por canal de venta (Agencia, Sala de Ventas, Corporativo, Walk-in, etc.).
- Personas con folio Zeus asignado vs. pendientes.
- Alertas: reservas sin forma de pago, sin impuestos definidos, sin folio.

### Módulo 3 — Generador de Tentativo

Botón de cierre del día. El sistema consolida todos los registros confirmados y genera el resumen en formato listo para WhatsApp o correo:

```
TENTATIVO DayPASS — [Fecha]

Total proyectado: 85 personas
→ 62 adultos | 4 niños | 1 cortesía

Distribución por canal:
- Agencias (AGV): 62 pax
- Sala de Ventas (SVT): 15 pax
- Corporativo: 8 pax

Detalle de grupos:
- Dorado Experiences / DE4331 — 16 pax — Plan FID Silver Baja
- All Reps / REFI119382 — 2 pax — Plan MAY Silver Baja
...

Individuales: [listado]
```

### Módulo 4 — Generador de Listado para Folios

Botón de inicio del día siguiente. Genera un listado ordenado por lancha, limpio, sin ruido:

```
LISTADO PARA FOLIOS — [Fecha]

MAJAGUA 1 (18 pax):
  1. Grupo Dorado Experiences — 16 adultos — Plan FID Silver — Voucher DE4331
  2. Lazaro Alvarez — 2 adultos — Plan MAY Silver — Agencia: Sala de Ventas

MAJAGUA 2 (12 pax):
  3. Maria Rita Pereira — 4 adultos — Plan MAY Silver Exterior — CB Journey
  ...
```

Incluye campo editable para ingresar el número de folio Zeus una vez creado.

### Módulo 5 — Historial y Filtros

Vista de registros históricos con filtros por fecha, lancha, canal, plan, asesora, agencia y estado. Permite exportar a CSV/Excel para análisis externos.

---

## 🧱 6. Modelo de Datos

### Entidad: `Registro` (tabla principal)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `fecha` | Date | Fecha del pasadía |
| `tipo` | Enum | `individual` / `grupo` |
| `estado` | Enum | `tentativa`, `confirmada`, `en_isla`, `completada`, `noshow`, `cancelada` |
| `lancha_id` | FK → Lancha | Lancha asignada |
| `cliente_id` | FK → Cliente | Pasajero líder o nombre de grupo |
| `grupo_id` | FK → Grupo | Si aplica |
| `plan_id` | FK → Plan | Plan contratado |
| `temporada` | Enum | `baja` / `alta` |
| `adultos` | Integer | Cantidad de adultos |
| `ninos` | Integer | Niños (3–8 años) |
| `cortesias` | Integer | Cortesías (no pagan) |
| `infantes` | Integer | Menores de 3 años (sin costo) |
| `precio_adulto` | Decimal | Tarifa por adulto (auto o manual) |
| `precio_nino` | Decimal | Tarifa por niño |
| `precio_lancha` | Decimal | Cupo de lancha si aplica |
| `total_calculado` | Decimal | Calculado automáticamente |
| `canal_id` | FK → Canal | Canal de venta |
| `agencia_empresa` | String | Nombre de agencia o empresa |
| `forma_pago` | Enum | `deposito`, `cxc`, `pago_directo`, `cortesia` |
| `impuestos_incluidos` | Enum | `si`, `no`, `exe` (exento) |
| `voucher_os` | String | Número de orden de servicio o voucher |
| `folio_zeus` | String | Número de folio en Zeus (opcional) |
| `observaciones` | Text | Notas operativas libres |
| `generada_por` | FK → Usuario | Quien generó la reserva |
| `vendida_por` | FK → Usuario | Asesora que vendió |
| `pais` | FK → Pais | Nacionalidad del pasajero/grupo |
| `created_at` | Timestamp | Fecha/hora de creación |
| `updated_at` | Timestamp | Última modificación |

### Entidad: `Cliente`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `nombre_completo` | String | Nombre del pasajero o líder |
| `identificacion` | String | Número de documento |
| `telefono` | String | Contacto |
| `email` | String | Email |
| `pais_id` | FK → Pais | Nacionalidad |

### Entidad: `Grupo`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `nombre` | String | Nombre del grupo o agencia |
| `lider_id` | FK → Cliente | Líder o responsable |
| `voucher` | String | Código de voucher/OS |
| `total_pax` | Integer | Total de personas |
| `agencia_id` | FK → Agencia | Agencia que opera |

### Entidad: `Plan`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `nombre` | String | Nombre del plan |
| `categoria` | Enum | `rack`, `mayorista`, `fidelidad`, `corporativo`, `grupo_neto`, `almuerzo_sin_transporte`, `guia`, `solo_transporte` |
| `nivel` | Enum | `silver`, `gold`, `diamond` (según aplique) |
| `incluye_transporte` | Boolean | Si incluye cupo de lancha |
| `precio_adulto_baja` | Decimal | Tarifa adulto en temporada baja |
| `precio_adulto_alta` | Decimal | Tarifa adulto en temporada alta |
| `precio_nino_baja` | Decimal | Tarifa niño temporada baja |
| `precio_nino_alta` | Decimal | Tarifa niño temporada alta |
| `activo` | Boolean | Si está disponible |

### Entidad: `Canal`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `codigo` | String | AGV, SVT, COR, DIV, GRU, HSC, HTL, REC, GER |
| `nombre` | String | Agencia, Sala de Ventas, Corporativo, Grupos/Bodas... |

### Entidad: `Lancha`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `codigo` | String | MAJ1, MAJ2, CAT1–CAT4, POP, ARC, OTR |
| `nombre` | String | Majagua 1, Catalina 2, Popeye... |
| `capacidad` | Integer | Capacidad máxima de personas |
| `activa` | Boolean | Disponible para asignación |

### Entidad: `Usuario`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `nombre` | String | Nombre completo |
| `email` | String | Email de acceso |
| `rol` | Enum | `asesora`, `coordinadora`, `operacion`, `admin` |
| `activo` | Boolean | |

### Relaciones clave

```
Registro → Lancha (muchos a uno)
Registro → Cliente/Grupo (muchos a uno)
Registro → Plan (muchos a uno)
Registro → Canal (muchos a uno)
Registro → Usuario × 2 (generada_por, vendida_por)
Grupo → Cliente (lider)
Grupo → Agencia
```

---

## ⚙️ 7. Reglas de Negocio

### Cálculo automático de totales
El sistema calcula el total del registro automáticamente:

```
total = (adultos × precio_adulto) + (ninos × precio_nino) + precio_lancha
```

Si el plan no incluye transporte, `precio_lancha = 0`. Las cortesías e infantes no suman al total.

### Temporada automática
El sistema determina la temporada (BAJA / ALTA) según la fecha del registro, a partir de un calendario de temporadas configurable por el administrador. El precio se selecciona automáticamente del plan.

### Lógica de grupos
Un grupo puede tener distintas combinaciones de tipos de pasajeros (adultos + niños + cortesías). El registro de grupo usa al líder o un nombre genérico, pero el conteo de personas es el campo operativo clave.

### Impuestos de puerto
Cada registro debe indicar si los impuestos de puerto están incluidos en el precio (`SI`), no incluidos (`NO`) o si el cliente está exento (`EXE`). Este campo impacta el proceso de cobro en muelle.

### Folio Zeus
El campo `folio_zeus` es opcional al momento del registro pero obligatorio antes de que un registro pueda marcarse como `completado`. Se puede asignar desde el listado de folios con un solo clic sin necesidad de abrir el registro completo.

### No-show
Si un cliente no llega, el registro pasa a estado `noshow`. Esto queda en el historial para análisis de cancelaciones por canal/agencia.

### Validaciones mínimas requeridas
- Nombre del pasajero/grupo: obligatorio.
- Lancha: obligatoria.
- Plan: obligatorio.
- Cantidad de adultos: debe ser ≥ 1 (salvo cortesía pura).
- Forma de pago: obligatoria antes de marcar como confirmada.

---

## 🧠 8. Lógica del Tentativo

El tentativo es el resumen del día que se comunica al equipo al cierre. El sistema lo genera automáticamente agrupando todos los registros del día en estado `confirmada` o superior.

### Qué incluye
- Fecha del día.
- Total de personas (adultos + niños).
- Desglose por canal de venta.
- Listado de grupos (nombre, pax, plan, agencia).
- Listado de individuales (nombre, pax, plan).
- Distribución por lancha.

### Cómo se agrupa
1. Primero agrupa por tipo: **grupos** y luego **individuales**.
2. Dentro de grupos, ordena por lancha asignada.
3. Dentro de individuales, ordena por lancha.

### Formato de salida
Texto plano formateado para copiar directamente en correo o WhatsApp. Botón "Copiar tentativo" en un clic.

### Estados que se incluyen
- `confirmada`: se incluye siempre.
- `tentativa`: se puede incluir con marcador visual diferente (ej: ⏳).
- `noshow` / `cancelada`: excluidas del tentativo.

---

## 🧾 9. Lógica del Listado de Folios

El listado de folios es el documento operativo del día siguiente. Se genera al inicio de la jornada y sirve como guía para crear los folios en Zeus y coordinar el embarque.

### Qué datos incluye por registro
- Nombre del cliente o grupo.
- Número de voucher / orden de servicio (si existe).
- Lancha asignada.
- Adultos / Niños / Cortesías.
- Plan.
- Agencia / empresa.
- Forma de pago.
- Impuestos de puerto (SI / NO / EXE).
- Campo editable: Folio Zeus (vacío o prellenado si ya fue asignado).

### Cómo se organiza
Ordenado por lancha, luego por hora de llegada estimada (o por orden de registro si no hay hora). Agrupa primero los grupos, luego los individuales.

### Cómo se usa en operación
1. Coordinadora abre "Listado del día" en la mañana.
2. Entra a Zeus y crea los folios.
3. Regresa a DayPASS y en cada fila escribe el número de folio (campo inline, sin abrir el registro).
4. El sistema guarda el folio Zeus en el registro para trazabilidad futura.

---

## 🎨 10. UX / Principios de Diseño

### Velocidad ante todo
El flujo más frecuente (crear un registro) debe completarse en menos de 60 segundos. Sin pantallas intermedias innecesarias.

### Minimizar escritura
Todo lo que pueda ser un dropdown, debe serlo: lancha, plan, canal, forma de pago, país, asesora. El usuario solo escribe nombre, ID, voucher y observaciones.

### Diseño mobile-first
El equipo comercial trabaja frecuentemente desde móvil. Formularios verticales, botones grandes, dropdowns nativos del dispositivo.

### Estado visible siempre
El dashboard siempre muestra el total del día de forma prominente. No hay que calcular mentalmente cuántas personas vienen.

### Un clic para lo crítico
- Generar tentativo: 1 clic → copiar.
- Generar listado de folios: 1 clic → copiar o imprimir.
- Asignar folio Zeus: 1 campo inline sin salir de la lista.

### Alertas sin fricción
El sistema muestra alertas sobre registros incompletos (sin folio, sin forma de pago, sin impuestos), pero no bloquea el flujo. Siempre se puede guardar y completar después.

---

## 🏗️ 11. Arquitectura Técnica Sugerida

### Frontend
**React** (con Next.js para SSR y routing) + **Tailwind CSS** para estilos.  
Componentes clave: formulario de registro dinámico, dashboard con cards de métricas, vista de listado con edición inline.

### Backend
**Supabase** como plataforma principal:
- Base de datos PostgreSQL (nativa en Supabase).
- Autenticación de usuarios con roles.
- API REST y suscripciones en tiempo real (para el dashboard).
- Storage para adjuntar vouchers u órdenes de servicio en el futuro.

### Base de Datos
PostgreSQL (vía Supabase). Esquema relacional como se describe en el Modelo de Datos. Índices en `fecha`, `estado`, `lancha_id` para consultas rápidas del día.

### Exportación / Comunicación
- Generación de texto plano para copiar al portapapeles (tentativo, listado).
- Exportación a CSV/Excel para historial.
- En v2: envío directo por email o WhatsApp Business API.

### Integraciones futuras
- **Zeus** (sistema hotelero): importación/exportación de folios vía API o archivo intermediario.
- **WhatsApp Business API**: envío automático del tentativo.
- **Google Sheets / Data Studio**: espejo de datos para reportes de gerencia.

### Infraestructura
- Deploy en **Vercel** (frontend) + **Supabase** (backend/BD).
- Costo inicial bajo, escalable sin migración.

---

## 🚀 12. Roadmap

### MVP — Lo mínimo funcional (Semanas 1–4)

- [x] Módulo de registro: individual y grupo.
- [x] Dropdowns de lancha, plan, canal, forma de pago, país.
- [x] Cálculo automático de totales.
- [x] Dashboard del día (personas, estado, lancha).
- [x] Generador de tentativo (texto para copiar).
- [x] Generador de listado para folios (texto para copiar).
- [x] Campo de folio Zeus (inline en listado).
- [x] Historial con filtro por fecha.
- [x] Autenticación de usuarios con roles básicos.
- [x] **Análisis operativo básico** (incluido en el dashboard del día).

#### 📊 Análisis incluido en el MVP

El MVP incluye tres bloques de análisis operativo integrados directamente en el dashboard diario. No son reportes aparte — son métricas visibles en tiempo real mientras transcurre el día.

**Bloque 1 — ¿Cómo va el día?**
- Total de personas confirmadas vs. en estado tentativa.
- Desglose por lancha: cuántos pax tiene asignados cada embarcación.
- Semáforo de ocupación: verde (con holgura), amarillo (cerca del límite), rojo (llena).
- Conteo de grupos vs. individuales.

**Bloque 2 — Ingresos proyectados del día**
- Total facturado acumulado (calculado automáticamente a medida que se registran reservas).
- Desglose por canal: cuánto viene de agencias (AGV), sala de ventas (SVT), corporativo, etc.
- Sin necesidad de abrir una hoja de cálculo ni sumar manualmente.

**Bloque 3 — Pendientes operativos**
- Registros sin folio Zeus asignado.
- Registros sin forma de pago definida.
- Registros sin impuestos de puerto resueltos.
- Lista rápida de acceso directo para completar cada pendiente.

> **Por qué esto sí va en el MVP:** estos tres bloques reemplazan directamente lo que hoy el equipo calcula a mano al final del Excel. Son operativos, no analíticos — el equipo los necesita desde el primer día de uso. El análisis de tendencias (mes a mes, comparativos, proyecciones) espera hasta V3 porque requiere datos acumulados para ser útil.

### V2 — Mejoras operativas (Semanas 5–8)

- [ ] Alertas automáticas: registros sin folio, sin pago, sin impuesto definido.
- [ ] Envío de tentativo directo a correo desde el sistema.
- [ ] Vista de embarque para operación (solo lectura, mobile-optimizado).
- [ ] Registro de no-shows y cancelaciones con motivo.
- [ ] Edición de temporada por período (calendario de tarifas).
- [ ] Historial por agencia: cuántos pax ha enviado, qué planes usa más.
- [ ] Exportación a Excel del historial del mes.

### V3 — Inteligencia y escalabilidad (Mes 3+)

- [ ] Dashboard gerencial: métricas mensuales, comparativos, proyecciones.
- [ ] Integración directa con Zeus vía API o archivo CSV estructurado.
- [ ] Envío automático de tentativo por WhatsApp Business.
- [ ] Módulo de comisiones: cálculo automático por canal y asesora.
- [ ] Panel de agencias: historial de reservas por operador.
- [ ] Módulo de grupos especiales (bodas, eventos, buyouts).
- [ ] App móvil nativa (PWA o React Native).

---

## 📈 13. Oportunidad de Escalabilidad

### Producto interno primero
En su forma actual, DayPASS resuelve un problema específico y concreto de Majagua. En 3 meses de uso real, el sistema habrá construido una base de datos operativa con valor estratégico: cuánto genera cada canal, cuáles agencias son más rentables, qué planes se venden más en temporada alta.

### Módulo vendible
El problema que resuelve DayPASS no es exclusivo de Majagua. Decenas de hoteles boutique, destinos de isla y operadores de turismo en Colombia y el Caribe operan exactamente igual: con Excel, correos manuales y procesos fragmentados. DayPASS puede convertirse en un producto SaaS vertical para hoteles con operación de pasadías.

### Herramienta de inteligencia de negocio
Con 6–12 meses de datos, el sistema puede responder preguntas que hoy son imposibles de contestar sin horas de trabajo manual:
- ¿Qué agencia genera más ingreso neto por pasajero?
- ¿Cuál es el plan más rentable por temporada?
- ¿Qué días de la semana tienen mayor no-show?
- ¿Cuánto vale un cupo de lancha MAJ1 en alta temporada?

Eso convierte DayPASS de una herramienta operativa en un activo estratégico del negocio.

---

## 📁 Estructura del Repositorio (sugerida)

```
daypass/
├── apps/
│   ├── web/                  # Aplicación Next.js (frontend)
│   │   ├── components/       # Componentes UI reutilizables
│   │   ├── pages/            # Rutas: dashboard, registro, listados
│   │   ├── hooks/            # Lógica de negocio en React
│   │   └── lib/              # Cliente Supabase, utils
│   └── docs/                 # Documentación interna
├── supabase/
│   ├── migrations/           # SQL de esquema de base de datos
│   └── seed.sql              # Datos iniciales (planes, lanchas, canales)
└── README.md                 # Este archivo
```

---

## 🔑 Glosario

| Término | Significado |
|---|---|
| AGV | Agencia de viajes |
| SVT | Sala de ventas (venta directa) |
| COR | Corporativo |
| DIV | Diving Planet |
| GRU | Grupos / Bodas |
| HSC | Huéspedes del hotel Santa Clara |
| HTL | Otros hoteles |
| REC | Walk-in / Recepción BOV |
| GER | Gerencia |
| MAJ1/2 | Lancha Majagua 1 y 2 |
| CAT1–4 | Lancha Catalina 1 a 4 |
| POP | Lancha Popeye |
| Zeus | Sistema de gestión hotelera (PMS) donde se crean los folios |
| Folio | Registro de consumo en Zeus vinculado a un cliente |
| Tentativo | Resumen del día proyectado, enviado al cierre |
| DayTour | Pasadía: visita al hotel sin hospedaje |
| Silver/Gold/Diamond | Niveles de plan con distintos servicios incluidos |
| Temporada Baja/Alta | Período tarifario que determina el precio del plan |
| Pax | Pasajeros (abreviación operativa) |
| CXC | Cuenta por cobrar |

---

*DayPASS — Sistema Operativo del Área Comercial · Hotel San Pedro de Majagua*  
*Versión: 1.0 · Fecha: Abril 2026*
