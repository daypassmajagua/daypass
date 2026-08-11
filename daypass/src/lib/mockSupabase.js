import { hoyLocal, aFechaLocal } from './utils.js'
import { valorACobrar, pagadoDe, diasDeDeuda, tramoDe } from './cartera.js'
import { rangoDeMeta } from './metas.js'
import { paisesComoFilas } from './paisesISO.js'

// ─── Catálogos ────────────────────────────────────────────────────────────────

const LANCHAS = [
  { id: 'l-maj1', codigo: 'MAJ1', nombre: 'Majagua 1', capacidad: 41, activa: true, prioridad: 1 },
  { id: 'l-maj2', codigo: 'MAJ2', nombre: 'Majagua 2', capacidad: 41, activa: true, prioridad: 2 },
  { id: 'l-cat1', codigo: 'CAT1', nombre: 'Catalina 1', capacidad: 30, activa: true, prioridad: 10 },
  { id: 'l-cat2', codigo: 'CAT2', nombre: 'Catalina 2', capacidad: 30, activa: true, prioridad: 10 },
  { id: 'l-cat3', codigo: 'CAT3', nombre: 'Catalina 3', capacidad: 30, activa: true, prioridad: 10 },
  { id: 'l-cat4', codigo: 'CAT4', nombre: 'Catalina 4', capacidad: 30, activa: true, prioridad: 10 },
  { id: 'l-pop',  codigo: 'POP',  nombre: 'Popeye',     capacidad: 20, activa: true, prioridad: 10 },
  { id: 'l-arc',  codigo: 'ARC',  nombre: 'Arco',       capacidad: 20, activa: true, prioridad: 10 },
  { id: 'l-otr',  codigo: 'OTR',  nombre: 'Otra',       capacidad: null, activa: true, prioridad: 99 },
]

// ─── Modelo de operación (007) ────────────────────────────────────────────────

const OPCIONES_PLATO = []
;['p-rack-s', 'p-may-s', 'p-fid-s', 'p-corp-s', 'p-alm-s'].forEach(planId => {
  ;[['Pescado frito', 'Fried fish'], ['Filete de pescado', 'Fish fillet'],
    ['Pescado a la plancha', 'Grilled fish'], ['Pollo', 'Chicken']]
    .forEach(([es, en], i) => OPCIONES_PLATO.push({
      id: `op-${planId}-${i}`, plan_id: planId, nombre_es: es, nombre_en: en, activo: true,
    }))
})
;['p-rack-g', 'p-may-g', 'p-fid-g'].forEach(planId => {
  ;[['Langosta', 'Lobster'], ['Cazuela de mariscos', 'Seafood casserole']]
    .forEach(([es, en], i) => OPCIONES_PLATO.push({
      id: `op-${planId}-${i}`, plan_id: planId, nombre_es: es, nombre_en: en, activo: true,
    }))
})
// Diamond sin filas: no se pregunta.

const TIPOS_INGRESO = [
  { id: 'ti-pasadia',  codigo: 'pasadia',     nombre: 'Pasadía',                consume_cupo: true, consume_tiquete: true,  genera_ingreso: true,  activo: true },
  { id: 'ti-cortesia', codigo: 'cortesia',    nombre: 'Cortesía',               consume_cupo: true, consume_tiquete: true,  genera_ingreso: false, activo: true },
  { id: 'ti-aloj',     codigo: 'alojamiento', nombre: 'Huésped de alojamiento', consume_cupo: true, consume_tiquete: true,  genera_ingreso: false, activo: true },
  { id: 'ti-empleado', codigo: 'empleado',    nombre: 'Empleado',               consume_cupo: true, consume_tiquete: false, genera_ingreso: false, activo: true },
  { id: 'ti-prov',     codigo: 'proveedor',   nombre: 'Proveedor',              consume_cupo: true, consume_tiquete: false, genera_ingreso: null,  activo: true },
  { id: 'ti-guia',     codigo: 'guia',        nombre: 'Guía de turismo',        consume_cupo: null, consume_tiquete: null,  genera_ingreso: null,  activo: true },
]

const PILOTOS = [
  { id: 'pi-1', nombre: 'José Julio Berrío', documento: '73123456', activo: true },
  { id: 'pi-2', nombre: 'Wilmer Castro', documento: '9876543', activo: true },
]

const EMPLEADOS = [
  { id: 'em-1', nombre: 'Rosiri Cabarcas', tipo_documento: 'cc', documento: '45111222', pais_id: 'pa-col', activo: true },
  { id: 'em-2', nombre: 'Deivis Julio', tipo_documento: 'cc', documento: '73222333', pais_id: 'pa-col', activo: true },
  { id: 'em-3', nombre: 'Yulieth Torres', tipo_documento: 'cc', documento: '45333444', pais_id: 'pa-col', activo: true },
]

const CANALES = [
  { id: 'c-agv',  codigo: 'AGV',  nombre: 'Agencia de Viajes' },
  { id: 'c-svt',  codigo: 'SVT',  nombre: 'Sala de Ventas' },
  { id: 'c-cor',  codigo: 'COR',  nombre: 'Corporativo' },
  { id: 'c-div',  codigo: 'DIV',  nombre: 'Diving Planet' },
  { id: 'c-gru',  codigo: 'GRU',  nombre: 'Grupos / Bodas' },
  { id: 'c-hsc',  codigo: 'HSC',  nombre: 'Huéspedes HSSC' },
  { id: 'c-htl',  codigo: 'HTL',  nombre: 'Otros Hoteles' },
  { id: 'c-rec',  codigo: 'REC',  nombre: 'Walk-in / Recepción' },
  { id: 'c-ger',  codigo: 'GER',  nombre: 'Gerencia' },
  { id: 'c-free', codigo: 'FREE', nombre: 'Lancha Particular' },
]

const PLANES = [
  { id: 'p-rack-s',   nombre: 'Rack Silver',                   categoria: 'rack',                    nivel: 'silver', incluye_transporte: true,  precio_adulto_baja: 340926, precio_adulto_alta: 369370, precio_nino_baja: 214009, precio_nino_alta: 224422, activo: true },
  { id: 'p-rack-g',   nombre: 'Rack Gold',                     categoria: 'rack',                    nivel: 'gold',   incluye_transporte: true,  precio_adulto_baja: 415000, precio_adulto_alta: 443444, precio_nino_baja: 214009, precio_nino_alta: 224422, activo: true },
  { id: 'p-rack-d',   nombre: 'Rack Diamond',                  categoria: 'rack',                    nivel: 'diamond',incluye_transporte: true,  precio_adulto_baja: 391852, precio_adulto_alta: 420296, precio_nino_baja: 214009, precio_nino_alta: 224422, activo: true },
  { id: 'p-may-s',    nombre: 'Mayorista Silver',               categoria: 'mayorista',               nivel: 'silver', incluye_transporte: true,  precio_adulto_baja: 250589, precio_adulto_alta: 274557, precio_nino_baja: 180495, precio_nino_alta: 188136, activo: true },
  { id: 'p-may-g',    nombre: 'Mayorista Gold',                 categoria: 'mayorista',               nivel: 'gold',   incluye_transporte: true,  precio_adulto_baja: 324663, precio_adulto_alta: 348631, precio_nino_baja: 180495, precio_nino_alta: 188136, activo: true },
  { id: 'p-fid-s',    nombre: 'Fidelidad Silver',               categoria: 'fidelidad',               nivel: 'silver', incluye_transporte: true,  precio_adulto_baja: 243852, precio_adulto_alta: 264818, precio_nino_baja: 172927, precio_nino_alta: 178671, activo: true },
  { id: 'p-fid-g',    nombre: 'Fidelidad Gold',                 categoria: 'fidelidad',               nivel: 'gold',   incluye_transporte: true,  precio_adulto_baja: 317937, precio_adulto_alta: 338892, precio_nino_baja: 172927, precio_nino_alta: 178671, activo: true },
  { id: 'p-corp-s',   nombre: 'Corporativo Silver',             categoria: 'corporativo',             nivel: 'silver', incluye_transporte: true,  precio_adulto_baja: 272741, precio_adulto_alta: 295496, precio_nino_baja: 170007, precio_nino_alta: 189335, activo: true },
  { id: 'p-grp-n',    nombre: 'Grupo Neto Majagua',             categoria: 'grupo_neto',              nivel: 'na',     incluye_transporte: true,  precio_adulto_baja: 398889, precio_adulto_alta: 0,      precio_nino_baja: 215444, precio_nino_alta: 0,      activo: true },
  { id: 'p-alm-s',    nombre: 'Almuerzo sin Transporte Silver', categoria: 'almuerzo_sin_transporte', nivel: 'silver', incluye_transporte: false, precio_adulto_baja: 195764, precio_adulto_alta: 218644, precio_nino_baja: 107628, precio_nino_alta: 127966, activo: true },
  { id: 'p-trans',    nombre: 'Solo Transporte',                categoria: 'solo_transporte',         nivel: 'na',     incluye_transporte: true,  precio_adulto_baja: 75000,  precio_adulto_alta: 85000,  precio_nino_baja: 75000,  precio_nino_alta: 85000,  activo: true },
  { id: 'p-guia',     nombre: 'Guía de Turismo',                categoria: 'guia',                    nivel: 'na',     incluye_transporte: true,  precio_adulto_baja: 205482, precio_adulto_alta: 205482, precio_nino_baja: 0,      precio_nino_alta: 0,      activo: true },
]

/**
 * Los países, los mismos 249 que la migración 028 mete en producción.
 *
 * Antes eran catorce con códigos inventados —'COL', 'ING'— y esa diferencia
 * no era inocente: `Equipo` buscaba `codigo === 'COL'` para poner Colombia por
 * defecto, así que en la demo funcionaba y en producción, donde el código es
 * 'CO', el empleado nuevo nacía sin país. La demo tiene que mentir lo menos
 * posible.
 *
 * Los ids viejos se conservan porque hay reservas de muestra apuntándoles.
 */
const ALIAS_DEMO = {
  CO: 'pa-col', US: 'pa-usa', MX: 'pa-mex', ES: 'pa-esp', AR: 'pa-arg',
  BR: 'pa-bra', CA: 'pa-can', CL: 'pa-chi', EC: 'pa-ecu', IT: 'pa-ita',
  GB: 'pa-ing', FR: 'pa-fra', DE: 'pa-ale',
}

const PAISES = [
  ...paisesComoFilas(ALIAS_DEMO),
  // No es ISO, pero está en producción desde la 027 y hay gente apuntándole.
  { id: 'pa-otr', codigo: 'OT', nombre: 'Otro', frecuente: false },
]

const TEMPORADAS = [
  { id: 't-baja1', nombre: 'Temporada Baja 2025',           tipo: 'baja',  fecha_inicio: '2025-01-01', fecha_fin: '2025-06-14' },
  { id: 't-alta1', nombre: 'Temporada Alta 2025',           tipo: 'alta',  fecha_inicio: '2025-06-15', fecha_fin: '2025-08-31' },
  { id: 't-baja2', nombre: 'Temporada Baja 2025 II',        tipo: 'baja',  fecha_inicio: '2025-09-01', fecha_fin: '2025-11-14' },
  { id: 't-alta2', nombre: 'Temporada Alta 2025 Fin de Año',tipo: 'alta',  fecha_inicio: '2025-11-15', fecha_fin: '2025-12-31' },
  { id: 't-baja3', nombre: 'Temporada Baja 2026',           tipo: 'baja',  fecha_inicio: '2026-01-01', fecha_fin: '2026-06-14' },
  { id: 't-alta3', nombre: 'Temporada Alta 2026',           tipo: 'alta',  fecha_inicio: '2026-06-15', fecha_fin: '2026-08-31' },
  { id: 't-baja4', nombre: 'Temporada Baja 2026 II',        tipo: 'baja',  fecha_inicio: '2026-09-01', fecha_fin: '2026-11-14' },
  { id: 't-alta4', nombre: 'Temporada Alta 2026 Fin de Año',tipo: 'alta',  fecha_inicio: '2026-11-15', fecha_fin: '2026-12-31' },
]

// Se llamaban agencias hasta la 020. Ahora son organizaciones y el `tipo` las
// distingue: las instituciones no venden pasadías, reciben el manifiesto.
const ORGANIZACIONES = [
  { id: 'ag-1', nombre: 'Aviatur',          contacto: 'María Ríos',     email: 'mrios@aviatur.com',      tipo: 'agencia',     activa: true },
  { id: 'ag-2', nombre: 'Despegar',         contacto: 'Juan Mora',      email: 'jmora@despegar.com',     tipo: 'agencia',     activa: true },
  { id: 'ag-3', nombre: 'Decameron Travel', contacto: 'Claudia Pineda', email: 'cpineda@decameron.com',  tipo: 'agencia',     activa: true },
  { id: 'ag-4', nombre: 'Copa Airlines',    contacto: 'Luis Arango',    email: 'larango@copaair.com',    tipo: 'agencia',     activa: true },
  { id: 'ag-5', nombre: 'Viajes Éxito',     contacto: 'Patricia Mora',  email: 'pmora@viajesexito.com',  tipo: 'agencia',     activa: true },
  { id: 'ag-6', nombre: 'Hotelbeds',        contacto: 'Steve Carter',   email: 'scarter@hotelbeds.com',  tipo: 'agencia',     activa: true },
  { id: 'or-1', nombre: 'Capitanía de Puerto de Cartagena', contacto: null, email: null, tipo: 'institucion', activa: true },
  { id: 'or-2', nombre: 'CorpoTurismo',     contacto: null,             email: null,                     tipo: 'institucion', activa: true },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 100

function genId() {
  return `mock-${++_idCounter}-${Date.now()}`
}

function calcTotal(r) {
  return (r.adultos * r.precio_adulto) + (r.ninos * r.precio_nino) + r.precio_lancha
}

function joinRegistro(r) {
  return {
    ...r,
    total_calculado: r._sinDinero ? null : calcTotal(r),
    lanchas:  STORE.lanchas.find(l => l.id === r.lancha_id) || null,
    planes:   STORE.planes.find(p => p.id === r.plan_id)   || null,
    canales:  STORE.canales.find(c => c.id === r.canal_id) || null,
    paises:   STORE.paises.find(p => p.id === r.pais_id)   || null,
    agencias: r.agencia_id ? STORE.organizaciones.find(a => a.id === r.agencia_id) : null,
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return aFechaLocal(d)
}

// ─── Generador de histórico ────────────────────────────────────────────────────

const NOMBRES_H = [
  'Pedro Martínez', 'Catalina Ruiz', 'Jorge Medina', 'Luisa Fernández',
  'Felipe Castillo', 'Andrea Suárez', 'Tomás Herrera', 'Valeria Ríos',
  'Ernesto Lagos', 'Marcela Orozco', 'Sebastián Díaz', 'Patricia Mora',
  'Alejandro Vargas', 'Daniela Fuentes', 'Mauricio Salcedo', 'Isabel Cruz',
  'Hans Hoffman', 'Emily Parker', 'Jean-Pierre Blanc', 'Giulia Romano',
]
const GRUPOS_H = [
  'Tour Aviatur Premium', 'Grupo Familiar López', 'Congreso Médico Nacional',
  'Despegar Cartagena Pack', 'Boda García-Romero', 'Viajes Éxito Especial',
  'Grupo Escolar Colegio', 'Copa Airlines Familias', 'Team Building Bancolombia',
]
const PLAN_IDS = ['p-rack-s','p-rack-g','p-may-s','p-may-g','p-corp-s','p-fid-s','p-fid-g','p-alm-s']
const PLAN_PRICES = {
  'p-rack-s': { pa: 340926, pn: 214009 },
  'p-rack-g': { pa: 415000, pn: 214009 },
  'p-may-s':  { pa: 250589, pn: 180495 },
  'p-may-g':  { pa: 324663, pn: 180495 },
  'p-corp-s': { pa: 272741, pn: 170007 },
  'p-fid-s':  { pa: 243852, pn: 172927 },
  'p-fid-g':  { pa: 317937, pn: 172927 },
  'p-alm-s':  { pa: 195764, pn: 107628 },
}
const LANCHA_IDS = ['l-maj1','l-maj2','l-cat1','l-cat2','l-cat3']
const CANAL_IDS  = ['c-agv','c-svt','c-cor','c-gru','c-rec','c-hsc','c-agv','c-agv']
const PAIS_IDS   = ['pa-col','pa-col','pa-col','pa-usa','pa-esp','pa-arg','pa-fra','pa-ita']
const ESTADOS_H  = ['completada','completada','completada','completada','completada','noshow','cancelada']
const PAGOS_H    = ['deposito','pago_directo','cxc','deposito','pago_directo']
const ASESORAS   = ['Valentina Ospina','Camila Pedraza','Valentina Ospina','Camila Pedraza','Valentina Ospina']

function pick(arr, seed) { return arr[Math.abs(seed) % arr.length] }

function generateHistorico() {
  const records = []
  // Días 6 a 35 atrás (4 semanas de historia)
  for (let d = 6; d <= 35; d++) {
    const fecha = daysAgo(d)
    const dow = new Date(fecha + 'T12:00:00').getDay()
    // Más registros en fines de semana y temporada simulada
    const base = (dow === 0 || dow === 6) ? 7 : 4
    const count = base + (d % 3)

    for (let i = 0; i < count; i++) {
      const seed = d * 17 + i * 7
      const planId = pick(PLAN_IDS, seed)
      const prices = PLAN_PRICES[planId]
      const isGrupo = (seed % 5 === 0)
      const adultos = isGrupo ? 8 + (seed % 14) : 1 + (seed % 3)
      const ninos   = (seed % 4 === 0) ? 1 + (seed % 3) : 0
      const estado  = pick(ESTADOS_H, seed + 3)

      records.push({
        id: `h-${d}-${i}`,
        fecha,
        tipo: isGrupo ? 'grupo' : 'individual',
        estado,
        nombre_pasajero: pick(NOMBRES_H, seed),
        nombre_grupo: isGrupo ? pick(GRUPOS_H, seed) : null,
        identificacion: null, cliente_id: null,
        lancha_id: pick(LANCHA_IDS, seed + 1),
        pais_id:   pick(PAIS_IDS, seed + 2),
        plan_id:   planId,
        temporada: 'baja',
        canal_id:  pick(CANAL_IDS, seed + 4),
        agencia_id: null,
        agencia_nombre: pick(CANAL_IDS, seed+4) === 'c-agv' ? 'Aviatur' : null,
        adultos, ninos, infantes: 0, cortesias: 0,
        precio_adulto: prices.pa,
        precio_nino:   prices.pn,
        precio_lancha: 0,
        forma_pago: pick(PAGOS_H, seed),
        impuestos_puerto: seed % 7 === 0 ? 'no' : 'si',
        voucher_os: null,
        folio_zeus: ['completada'].includes(estado) ? `F-24-0${600 + d * 3 + i}` : null,
        observaciones: null,
        vendida_por: pick(ASESORAS, seed),
        created_at: fecha + 'T08:00:00Z',
        updated_at: fecha + 'T16:00:00Z',
      })
    }
  }
  return records
}

// ─── Registros de muestra ─────────────────────────────────────────────────────

function buildRegistros() {
  const hoy = hoyLocal()
  return [
    // ── HOY ──
    {
      id: 'r-01', fecha: hoy, tipo: 'grupo', estado: 'confirmada',
      nombre_pasajero: 'Andrea Morales', nombre_grupo: 'Grupo Corporativo Bavaria',
      identificacion: null, cliente_id: null,
      lancha_id: 'l-maj1', pais_id: 'pa-col',
      plan_id: 'p-corp-s', temporada: 'baja', canal_id: 'c-cor', agencia_id: null,
      agencia_nombre: 'Bavaria S.A.', adultos: 22, ninos: 0, infantes: 0, cortesias: 2,
      precio_adulto: 272741, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'cxc', impuestos_puerto: 'exe',
      voucher_os: 'OS-BV-2024', folio_zeus: null,
      observaciones: 'Evento empresarial. Decoración especial contratada.',
      vendida_por: 'Valentina Ospina', created_at: hoy + 'T08:10:00Z', updated_at: hoy + 'T08:10:00Z',
    },
    {
      id: 'r-02', fecha: hoy, tipo: 'individual', estado: 'confirmada',
      nombre_pasajero: 'James & Sarah Wilson', nombre_grupo: null,
      identificacion: 'PASS US-449821', cliente_id: null,
      lancha_id: 'l-maj1', pais_id: 'pa-usa',
      plan_id: 'p-rack-d', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-1',
      agencia_nombre: 'Aviatur', adultos: 2, ninos: 1, infantes: 0, cortesias: 0,
      precio_adulto: 391852, precio_nino: 214009, precio_lancha: 0,
      forma_pago: 'deposito', impuestos_puerto: 'si',
      voucher_os: 'AVT-88210', folio_zeus: null,
      observaciones: null, vendida_por: 'Camila Pedraza',
      created_at: hoy + 'T08:30:00Z', updated_at: hoy + 'T08:30:00Z',
    },
    {
      id: 'r-03', fecha: hoy, tipo: 'individual', estado: 'en_isla',
      nombre_pasajero: 'Familia Rodríguez Torres', nombre_grupo: null,
      identificacion: 'CC 1023456789', cliente_id: null,
      lancha_id: 'l-maj1', pais_id: 'pa-col',
      plan_id: 'p-rack-s', temporada: 'baja', canal_id: 'c-svt', agencia_id: null,
      agencia_nombre: null, adultos: 2, ninos: 2, infantes: 1, cortesias: 0,
      precio_adulto: 340926, precio_nino: 214009, precio_lancha: 0,
      forma_pago: 'pago_directo', impuestos_puerto: 'si',
      voucher_os: null, folio_zeus: null,
      observaciones: 'Bebé de 18 meses. Solicitan silla de bebé.',
      // Sin teléfono no se ve funcionar nada de lo que cuelga de él: ni el
      // envío de tarjetas por WhatsApp ni el botón de llamar del perfil. La
      // demo tenía cero números y esas dos cosas parecían no existir.
      telefono: '3115540982', email: 'rodriguez.torres@gmail.com',
      vendida_por: 'Valentina Ospina',
      created_at: hoy + 'T07:45:00Z', updated_at: hoy + 'T09:15:00Z',
    },
    {
      id: 'r-04', fecha: hoy, tipo: 'individual', estado: 'confirmada',
      nombre_pasajero: 'María Fernanda Ríos', nombre_grupo: null,
      identificacion: 'CC 45678901', cliente_id: null,
      lancha_id: 'l-maj1', pais_id: 'pa-col',
      plan_id: 'p-fid-g', temporada: 'baja', canal_id: 'c-hsc', agencia_id: null,
      agencia_nombre: null, adultos: 1, ninos: 0, infantes: 0, cortesias: 1,
      precio_adulto: 317937, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'cortesia', impuestos_puerto: 'exe',
      voucher_os: null, folio_zeus: null,
      observaciones: 'Huésped VIP. Cortesía de gerencia.',
      telefono: '3004471209', email: 'mfrios@outlook.com',
      vendida_por: 'Dirección',
      created_at: hoy + 'T09:00:00Z', updated_at: hoy + 'T09:00:00Z',
    },
    {
      id: 'r-05', fecha: hoy, tipo: 'grupo', estado: 'confirmada',
      nombre_pasajero: 'Giovanni Rossi', nombre_grupo: 'Tour Operador Hotelbeds',
      identificacion: null, cliente_id: null,
      lancha_id: 'l-maj2', pais_id: 'pa-ita',
      plan_id: 'p-may-s', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-6',
      agencia_nombre: 'Hotelbeds', adultos: 14, ninos: 3, infantes: 0, cortesias: 0,
      precio_adulto: 250589, precio_nino: 180495, precio_lancha: 0,
      forma_pago: 'deposito', impuestos_puerto: 'si',
      voucher_os: 'HB-COL-77432', folio_zeus: null,
      observaciones: 'Grupo europeo. 8 italianos, 6 españoles.',
      vendida_por: 'Camila Pedraza',
      created_at: hoy + 'T08:00:00Z', updated_at: hoy + 'T08:00:00Z',
    },
    {
      id: 'r-06', fecha: hoy, tipo: 'individual', estado: 'confirmada',
      nombre_pasajero: 'Carlos Eduardo Sánchez', nombre_grupo: null,
      identificacion: 'CC 80112233', cliente_id: null,
      lancha_id: 'l-maj2', pais_id: 'pa-col',
      plan_id: 'p-rack-g', temporada: 'baja', canal_id: 'c-svt', agencia_id: null,
      agencia_nombre: null, adultos: 2, ninos: 0, infantes: 0, cortesias: 0,
      precio_adulto: 415000, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'pago_directo', impuestos_puerto: 'si',
      voucher_os: null, folio_zeus: null,
      observaciones: null, vendida_por: 'Valentina Ospina',
      telefono: '3128896541', email: null,
      created_at: hoy + 'T09:30:00Z', updated_at: hoy + 'T09:30:00Z',
    },
    {
      id: 'r-07', fecha: hoy, tipo: 'grupo', estado: 'tentativa',
      nombre_pasajero: 'Johanna Cárdenas', nombre_grupo: 'Despegar.com Grupo Medellín',
      identificacion: null, cliente_id: null,
      lancha_id: 'l-maj2', pais_id: 'pa-col',
      plan_id: 'p-may-g', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-2',
      agencia_nombre: 'Despegar', adultos: 10, ninos: 2, infantes: 0, cortesias: 0,
      precio_adulto: 324663, precio_nino: 180495, precio_lancha: 0,
      forma_pago: null, impuestos_puerto: 'si',
      voucher_os: 'DSP-20491', folio_zeus: null,
      observaciones: 'Pendiente confirmación pago. Revisar antes de 11 AM.',
      vendida_por: 'Camila Pedraza',
      created_at: hoy + 'T10:00:00Z', updated_at: hoy + 'T10:00:00Z',
    },
    {
      id: 'r-08', fecha: hoy, tipo: 'individual', estado: 'completada',
      nombre_pasajero: 'Roberto Guzmán Peña', nombre_grupo: null,
      identificacion: 'CC 71234567', cliente_id: null,
      lancha_id: 'l-cat1', pais_id: 'pa-col',
      plan_id: 'p-alm-s', temporada: 'baja', canal_id: 'c-hsc', agencia_id: null,
      agencia_nombre: null, adultos: 2, ninos: 0, infantes: 0, cortesias: 0,
      precio_adulto: 195764, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'cxc', impuestos_puerto: 'exe',
      voucher_os: null, folio_zeus: 'F-24-0881',
      observaciones: 'Huéspedes del hotel. Almuerzo incluido en tarifa.',
      vendida_por: 'Valentina Ospina',
      created_at: hoy + 'T07:00:00Z', updated_at: hoy + 'T11:30:00Z',
    },
    {
      id: 'r-09', fecha: hoy, tipo: 'individual', estado: 'confirmada',
      nombre_pasajero: 'Sophie Müller', nombre_grupo: null,
      identificacion: 'PASS DE-XY4421', cliente_id: null,
      lancha_id: 'l-cat1', pais_id: 'pa-ale',
      plan_id: 'p-rack-s', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-1',
      agencia_nombre: 'Aviatur', adultos: 1, ninos: 0, infantes: 0, cortesias: 0,
      precio_adulto: 340926, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'deposito', impuestos_puerto: 'no',
      voucher_os: 'AVT-88315', folio_zeus: null,
      observaciones: '⚠️ Impuestos de puerto pendientes — cobrar en muelle.',
      vendida_por: 'Camila Pedraza',
      created_at: hoy + 'T10:15:00Z', updated_at: hoy + 'T10:15:00Z',
    },
    {
      id: 'r-10', fecha: hoy, tipo: 'grupo', estado: 'confirmada',
      nombre_pasajero: 'Paola Herrera Gómez', nombre_grupo: 'Boda Herrera & Castillo',
      identificacion: null, cliente_id: null,
      lancha_id: 'l-cat2', pais_id: 'pa-col',
      plan_id: 'p-grp-n', temporada: 'baja', canal_id: 'c-gru', agencia_id: null,
      agencia_nombre: 'Eventos Caribe', adultos: 18, ninos: 4, infantes: 2, cortesias: 4,
      precio_adulto: 398889, precio_nino: 215444, precio_lancha: 0,
      forma_pago: 'deposito', impuestos_puerto: 'exe',
      voucher_os: 'GRU-BODA-2024', folio_zeus: null,
      observaciones: 'Boda. Decoración floral en lancha. Torta a bordo.',
      vendida_por: 'Valentina Ospina',
      created_at: hoy + 'T07:30:00Z', updated_at: hoy + 'T07:30:00Z',
    },
    {
      id: 'r-11', fecha: hoy, tipo: 'individual', estado: 'confirmada',
      nombre_pasajero: 'Diego Alejandro Vargas', nombre_grupo: null,
      identificacion: 'CC 1098765432', cliente_id: null,
      lancha_id: 'l-cat2', pais_id: 'pa-col',
      plan_id: 'p-rack-s', temporada: 'baja', canal_id: 'c-rec', agencia_id: null,
      agencia_nombre: null, adultos: 3, ninos: 1, infantes: 0, cortesias: 0,
      precio_adulto: 340926, precio_nino: 214009, precio_lancha: 0,
      forma_pago: null, impuestos_puerto: 'si',
      voucher_os: null, folio_zeus: null,
      observaciones: null, vendida_por: 'Valentina Ospina',
      created_at: hoy + 'T11:00:00Z', updated_at: hoy + 'T11:00:00Z',
    },
    {
      id: 'r-12', fecha: hoy, tipo: 'individual', estado: 'noshow',
      nombre_pasajero: 'Luis Fernando Cano', nombre_grupo: null,
      identificacion: 'CC 79887766', cliente_id: null,
      lancha_id: 'l-cat1', pais_id: 'pa-col',
      plan_id: 'p-rack-g', temporada: 'baja', canal_id: 'c-svt', agencia_id: null,
      agencia_nombre: null, adultos: 2, ninos: 0, infantes: 0, cortesias: 0,
      precio_adulto: 415000, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'pago_directo', impuestos_puerto: 'si',
      voucher_os: null, folio_zeus: null,
      observaciones: 'No se presentó. No responde teléfono.',
      vendida_por: 'Camila Pedraza',
      created_at: hoy + 'T08:45:00Z', updated_at: hoy + 'T10:30:00Z',
    },

    // ── AYER ──
    {
      id: 'r-20', fecha: daysAgo(1), tipo: 'grupo', estado: 'completada',
      nombre_pasajero: 'Sandra Milena Patiño', nombre_grupo: 'Tour Viajes Éxito Bogotá',
      identificacion: null, cliente_id: null,
      lancha_id: 'l-maj1', pais_id: 'pa-col',
      plan_id: 'p-may-s', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-5',
      agencia_nombre: 'Viajes Éxito', adultos: 16, ninos: 4, infantes: 0, cortesias: 0,
      precio_adulto: 250589, precio_nino: 180495, precio_lancha: 0,
      forma_pago: 'deposito', impuestos_puerto: 'si',
      voucher_os: 'VE-COL-9901', folio_zeus: 'F-24-0872',
      observaciones: null, vendida_por: 'Valentina Ospina',
      created_at: daysAgo(1) + 'T08:00:00Z', updated_at: daysAgo(1) + 'T16:00:00Z',
    },
    {
      id: 'r-21', fecha: daysAgo(1), tipo: 'individual', estado: 'completada',
      nombre_pasajero: 'Andrés Felipe Mora', nombre_grupo: null,
      identificacion: 'CC 80334455', cliente_id: null,
      lancha_id: 'l-cat1', pais_id: 'pa-col',
      plan_id: 'p-rack-s', temporada: 'baja', canal_id: 'c-rec', agencia_id: null,
      agencia_nombre: null, adultos: 2, ninos: 0, infantes: 0, cortesias: 0,
      precio_adulto: 340926, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'pago_directo', impuestos_puerto: 'si',
      voucher_os: null, folio_zeus: 'F-24-0873',
      observaciones: null, vendida_por: 'Camila Pedraza',
      created_at: daysAgo(1) + 'T09:15:00Z', updated_at: daysAgo(1) + 'T16:00:00Z',
    },
    {
      id: 'r-22', fecha: daysAgo(1), tipo: 'individual', estado: 'completada',
      nombre_pasajero: 'Isabelle Dupont', nombre_grupo: null,
      identificacion: 'PASS FR-7734221', cliente_id: null,
      lancha_id: 'l-maj2', pais_id: 'pa-fra',
      plan_id: 'p-rack-d', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-6',
      agencia_nombre: 'Hotelbeds', adultos: 2, ninos: 1, infantes: 0, cortesias: 0,
      precio_adulto: 391852, precio_nino: 214009, precio_lancha: 0,
      forma_pago: 'deposito', impuestos_puerto: 'si',
      voucher_os: 'HB-COL-77401', folio_zeus: 'F-24-0874',
      observaciones: null, vendida_por: 'Valentina Ospina',
      created_at: daysAgo(1) + 'T08:30:00Z', updated_at: daysAgo(1) + 'T16:00:00Z',
    },

    // ── HACE 2 DÍAS ──
    {
      id: 'r-30', fecha: daysAgo(2), tipo: 'grupo', estado: 'completada',
      nombre_pasajero: 'Ricardo Pardo Vega', nombre_grupo: 'Congreso ACOTUR 2026',
      identificacion: null, cliente_id: null,
      lancha_id: 'l-maj1', pais_id: 'pa-col',
      plan_id: 'p-corp-s', temporada: 'baja', canal_id: 'c-cor', agencia_id: null,
      agencia_nombre: 'ACOTUR Colombia', adultos: 30, ninos: 0, infantes: 0, cortesias: 5,
      precio_adulto: 272741, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'cxc', impuestos_puerto: 'exe',
      voucher_os: 'COR-ACT-2026', folio_zeus: 'F-24-0860',
      observaciones: 'Congreso anual. Factura a razón social.',
      vendida_por: 'Valentina Ospina',
      created_at: daysAgo(2) + 'T07:00:00Z', updated_at: daysAgo(2) + 'T16:30:00Z',
    },
    {
      id: 'r-31', fecha: daysAgo(2), tipo: 'individual', estado: 'completada',
      nombre_pasajero: 'Elena Martínez Solano', nombre_grupo: null,
      identificacion: 'CC 52334499', cliente_id: null,
      lancha_id: 'l-cat2', pais_id: 'pa-col',
      plan_id: 'p-fid-s', temporada: 'baja', canal_id: 'c-svt', agencia_id: null,
      agencia_nombre: null, adultos: 1, ninos: 0, infantes: 0, cortesias: 0,
      precio_adulto: 243852, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'pago_directo', impuestos_puerto: 'si',
      voucher_os: null, folio_zeus: 'F-24-0861',
      observaciones: null, vendida_por: 'Camila Pedraza',
      telefono: '3157742210', email: 'elena.martinez@empresa.com.co',
      created_at: daysAgo(2) + 'T09:00:00Z', updated_at: daysAgo(2) + 'T16:30:00Z',
    },

    // ── HACE 3 DÍAS ──
    {
      id: 'r-40', fecha: daysAgo(3), tipo: 'individual', estado: 'completada',
      nombre_pasajero: 'Tom & Lisa Anderson', nombre_grupo: null,
      identificacion: 'PASS US-118833', cliente_id: null,
      lancha_id: 'l-maj1', pais_id: 'pa-usa',
      plan_id: 'p-rack-g', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-3',
      agencia_nombre: 'Decameron Travel', adultos: 2, ninos: 0, infantes: 0, cortesias: 0,
      precio_adulto: 415000, precio_nino: 0, precio_lancha: 0,
      forma_pago: 'deposito', impuestos_puerto: 'si',
      voucher_os: 'DEC-US-441', folio_zeus: 'F-24-0845',
      observaciones: null, vendida_por: 'Valentina Ospina',
      created_at: daysAgo(3) + 'T08:20:00Z', updated_at: daysAgo(3) + 'T16:00:00Z',
    },
    {
      id: 'r-41', fecha: daysAgo(3), tipo: 'grupo', estado: 'cancelada',
      nombre_pasajero: 'Beatriz Elena Orozco', nombre_grupo: 'Tour Cartagena Express',
      identificacion: null, cliente_id: null,
      lancha_id: 'l-maj2', pais_id: 'pa-col',
      plan_id: 'p-may-s', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-2',
      agencia_nombre: 'Despegar', adultos: 8, ninos: 2, infantes: 0, cortesias: 0,
      precio_adulto: 250589, precio_nino: 180495, precio_lancha: 0,
      forma_pago: null, impuestos_puerto: 'si',
      voucher_os: 'DSP-20388', folio_zeus: null,
      observaciones: 'Cancelación por mal tiempo. Reprogramar.',
      vendida_por: 'Camila Pedraza',
      created_at: daysAgo(3) + 'T07:30:00Z', updated_at: daysAgo(3) + 'T06:00:00Z',
    },

    // ── HACE 5 DÍAS ──
    {
      id: 'r-50', fecha: daysAgo(5), tipo: 'grupo', estado: 'completada',
      nombre_pasajero: 'Mauricio Lozano Ríos', nombre_grupo: 'Copa Airlines Familias',
      identificacion: null, cliente_id: null,
      lancha_id: 'l-maj1', pais_id: 'pa-col',
      plan_id: 'p-may-g', temporada: 'baja', canal_id: 'c-agv', agencia_id: 'ag-4',
      agencia_nombre: 'Copa Airlines', adultos: 20, ninos: 6, infantes: 1, cortesias: 0,
      precio_adulto: 324663, precio_nino: 180495, precio_lancha: 0,
      forma_pago: 'deposito', impuestos_puerto: 'si',
      voucher_os: 'CPA-COL-3301', folio_zeus: 'F-24-0821',
      observaciones: null, vendida_por: 'Valentina Ospina',
      created_at: daysAgo(5) + 'T08:00:00Z', updated_at: daysAgo(5) + 'T16:00:00Z',
    },
    {
      id: 'r-51', fecha: daysAgo(5), tipo: 'individual', estado: 'completada',
      nombre_pasajero: 'Natalia Quintero Burgos', nombre_grupo: null,
      identificacion: 'CC 43221100', cliente_id: null,
      lancha_id: 'l-cat1', pais_id: 'pa-col',
      plan_id: 'p-rack-s', temporada: 'baja', canal_id: 'c-svt', agencia_id: null,
      agencia_nombre: null, adultos: 2, ninos: 1, infantes: 0, cortesias: 0,
      precio_adulto: 340926, precio_nino: 214009, precio_lancha: 0,
      forma_pago: 'pago_directo', impuestos_puerto: 'si',
      voucher_os: null, folio_zeus: 'F-24-0822',
      observaciones: null, vendida_por: 'Camila Pedraza',
      created_at: daysAgo(5) + 'T09:00:00Z', updated_at: daysAgo(5) + 'T16:00:00Z',
    },
    ...generateHistorico(),
  ]
}

// ─── Store mutable ─────────────────────────────────────────────────────────────

const STORE = {
  lanchas:    [...LANCHAS],
  canales:    [...CANALES],
  planes:     [...PLANES],
  paises:     [...PAISES],
  temporadas: [...TEMPORADAS],
  organizaciones: [...ORGANIZACIONES],
  personas:   [],
  vinculos:   [],
  etiquetas:  [],
  persona_etiquetas: [],
  /**
   * A dónde salen los correos. El de la Capitanía es el que importa: es a
   * donde va el manifiesto, y sin él no se zarpa. Los otros dos están para que
   * se vean los tres propósitos en la pantalla.
   */
  organizacion_correos: [
    { id: 'oc-1', organizacion_id: 'or-1', correo: 'manifiestos@dimar.mil.co', proposito: 'manifiesto', activo: true },
    { id: 'oc-2', organizacion_id: 'ag-1', correo: 'facturacion@aviatur.com', proposito: 'facturacion', activo: true },
    { id: 'oc-3', organizacion_id: 'ag-6', correo: 'scarter@hotelbeds.com', proposito: 'general', activo: true },
  ],
  clientes:   [],
  registros:  buildRegistros(),
  pasajeros:  [],
  dias_operativos: [],
  cambios_estado:  [],
  zarpes:     [],
  embarques:  [],
  opciones_plato:    [...OPCIONES_PLATO],
  tipos_ingreso:     [...TIPOS_INGRESO],
  pilotos:           [...PILOTOS],
  empleados:         [...EMPLEADOS],
  zarpe_empleados:   [],
  zarpe_alojamiento: [],
  tokens_reserva:    [],

  /**
   * Los perfiles (migración 015). En la demo se puede cambiar de rol desde la
   * consola para ver la app como la ve cada persona:
   *
   *     window.__daypass_rol('mesero')
   *
   * Sin eso no habría forma de comprobar que el mesero no ve precios ni que la
   * isla entra directo a su pantalla — y esas son justamente las dos cosas que
   * esta fase promete.
   */
  perfiles: [
    {
      user_id: 'mock-user-demo',
      nombre: 'Usuario Demo',
      // El rol sobrevive a la recarga: el mock vive en memoria y sin esto
      // cambiar de rol no serviría de nada, porque la página se recarga para
      // que el menú y el inicio se recalculen.
      rol: (() => {
        try { return localStorage.getItem('daypass:demo-rol') || 'directora' }
        catch { return 'directora' }
      })(),
      activo: true,
    },
    /**
     * El resto del equipo. No estaban, y sin ellos los turnos no se podían
     * probar: un desplegable de «quién cubre el embarque» con una sola opción
     * no es una decisión. Los nombres son los que ya aparecían en
     * `vendida_por` de las reservas de muestra, así que la demo cuadra
     * consigo misma.
     */
    { user_id: 'mock-dani',  nombre: 'Daniela Restrepo',  rol: 'asesora',           activo: true },
    { user_id: 'mock-vale',  nombre: 'Valentina Ospina',  rol: 'asesora_comercial', activo: true },
    { user_id: 'mock-cami',  nombre: 'Camila Pedraza',    rol: 'asesora_comercial', activo: true },
    { user_id: 'mock-isla',  nombre: 'Yeison Padilla',    rol: 'admin_isla',        activo: true },
    { user_id: 'mock-geren', nombre: 'Andrés Villamizar', rol: 'gerencia',          activo: true },
  ],

  /**
   * Unos turnos puestos y otros no, a propósito: el calendario solo se
   * entiende cuando se ven las dos cosas al tiempo — los días repartidos y los
   * huecos de los días que sí tienen gente.
   */
  guardias: (() => {
    const d = n => {
      const [a, m, dd] = hoyLocal().split('-').map(Number)
      return aFechaLocal(new Date(a, m - 1, dd + n))
    }
    return [
      { fecha: d(0), tipo: 'embarque',     user_id: 'mock-dani' },
      { fecha: d(0), tipo: 'recibimiento', user_id: 'mock-vale' },
      { fecha: d(0), tipo: 'isla',         user_id: 'mock-isla' },
      { fecha: d(1), tipo: 'embarque',     user_id: 'mock-cami' },
      { fecha: d(1), tipo: 'isla',         user_id: 'mock-isla' },
      // d(2) queda vacío a propósito: es el hueco que el calendario marca.
      { fecha: d(3), tipo: 'isla',         user_id: 'mock-isla' },
    ]
  })(),
  /**
   * Unas cuantas anotaciones, para que Actividad se pueda ver.
   *
   * Con `nombre` congelado, que es como lo guarda la 015: si la persona cambia
   * de nombre —o se va— la línea sigue diciendo quién fue. La última dice
   * «alguien», que es el respaldo real de `nombre_de_quien_actua()` cuando la
   * cuenta no tenía perfil: no es un hueco, es lo que la base guardó.
   */
  bitacora: (() => {
    const cuando = (dias, hora) => `${daysAgo(dias)}T${hora}:00Z`
    return [
      { id: 1, ocurrido_at: cuando(0, '14:05'), nombre: 'Andrés Villamizar', rol: 'gerencia',
        accion: 'cambiar_tarifa', entidad: 'planes', entidad_id: 'p-rack-g', fecha_op: null,
        detalle: { plan: 'Rack Gold',
          antes: { adulto_baja: 398889, adulto_alta: 443444, nino_baja: 214009, nino_alta: 224422 },
          ahora: { adulto_baja: 415000, adulto_alta: 443444, nino_baja: 214009, nino_alta: 224422 } } },
      { id: 2, ocurrido_at: cuando(1, '09:12'), nombre: 'Daniela Restrepo', rol: 'asesora',
        accion: 'cerrar_zarpe', entidad: 'zarpes', entidad_id: 'z-1', fecha_op: daysAgo(1), detalle: {} },
      { id: 3, ocurrido_at: cuando(1, '08:40'), nombre: 'Daniela Restrepo', rol: 'asesora',
        accion: 'mover_tiquetes', entidad: 'tiquetes_lotes', entidad_id: 'l-1', fecha_op: daysAgo(1),
        detalle: { cantidad: 200, motivo: 'compra al parque' } },
      { id: 4, ocurrido_at: cuando(3, '16:30'), nombre: 'Camila Pedraza', rol: 'asesora_comercial',
        accion: 'anular_pago', entidad: 'pagos', entidad_id: 'pg-9', fecha_op: null,
        detalle: { valor: 830000 } },
      { id: 5, ocurrido_at: cuando(6, '11:02'), nombre: 'Andrés Villamizar', rol: 'gerencia',
        accion: 'cambiar_ajuste', entidad: 'ajustes', entidad_id: 'hora_regreso', fecha_op: null,
        detalle: { clave: 'hora_regreso', antes: '15:00', ahora: '15:30' } },
      // De antes de la 024, cuando el nombre salía del correo de la cuenta.
      { id: 6, ocurrido_at: '2026-08-02T10:15:00Z', nombre: 'alguien', rol: null,
        accion: 'cerrar_zarpe', entidad: 'zarpes', entidad_id: 'z-0', fecha_op: '2026-08-02', detalle: {} },
    ]
  })(),
  // Las constantes de la operación (regla 22). Sin esta tabla la demo mostraba
  // siempre los valores de respaldo y cambiar un ajuste no hacía nada.
  ajustes: [
    { clave: 'checkin_cierra_hora', valor: '08:30', descripcion: 'Hora de zarpe.' },
    { clave: 'checkin_abre_dias',   valor: '2',     descripcion: 'Días antes que se abre plato y firma.' },
    { clave: 'cocina_cierra_hora',  valor: '08:30', descripcion: 'Hora en que cocina revisa.' },
    { clave: 'hora_regreso',        valor: '15:30', descripcion: 'Hora del zarpe de regreso.' },
    { clave: 'edad_max_infante',    valor: '3',     descripcion: 'Hasta qué edad cuenta como infante.' },

    // Los mensajes al cliente (031). Estaban escritos en `enlaceReserva.js`,
    // que es lo que la regla 22 prohíbe: cambiar una coma era un despliegue.
    { clave: 'hotel_nombre',  valor: 'Hotel San Pedro de Majagua', descripcion: 'Cómo se nombra el hotel en los mensajes.' },
    { clave: 'muelle_nombre', valor: 'muelle de La Bodeguita',     descripcion: 'De dónde sale la lancha.' },
    {
      clave: 'mensaje_invitacion',
      valor: '¡Hola {nombre}! 🌊\n\n' +
        'Tu Day Tour en el Hotel San Pedro de Majagua es el {fecha}.\n\n' +
        'Antes de venir necesitamos el nombre y el documento de cada persona: la Capitanía de Puerto lo exige para poder zarpar. ' +
        'Ahí mismo eliges el almuerzo y confirmas tu asistencia:\n{enlace}\n\n' +
        'Al terminar recibes tu pase para el muelle. ¡Nos vemos en las Islas del Rosario!',
      descripcion: 'El WhatsApp que se manda al crear la reserva.',
    },
    {
      clave: 'mensaje_pase',
      valor: '¡Hola {nombre}! 🌊\n\n' +
        'Todo listo para tu Day Tour del {fecha}.\n\n' +
        'Aquí está tu pase para presentar en el muelle:\n{enlace}\n\n' +
        'Te esperamos en el muelle de La Bodeguita. ¡Nos vemos!',
      descripcion: 'El WhatsApp que se manda después del cierre, con el pase.',
    },
  ],
  documentos_legales: [
    { id: 'doc-es-1', tipo: 'exoneracion', version: 1, idioma: 'es',
      titulo: 'Condiciones del Day Tour',
      contenido: 'Al confirmar mi asistencia declaro que participo de forma libre y voluntaria en el Day Tour del Hotel San Pedro de Majagua...\n\n(Texto completo en la migración 008.)',
      vigente_desde: new Date().toISOString(), vigente_hasta: null },
    { id: 'doc-en-1', tipo: 'exoneracion', version: 1, idioma: 'en',
      titulo: 'Day Tour Terms',
      contenido: 'By confirming my attendance I declare that I take part freely and voluntarily in the Day Tour of Hotel San Pedro de Majagua...\n\n(Full text in migration 008.)',
      vigente_desde: new Date().toISOString(), vigente_hasta: null },
  ],
  firmas: [],
  tickets: [],
  pagos: [],
  comisiones: [],
  // Una meta del mes en curso: sin ella la pantalla sale vacía en la demo y no
  // se puede mostrar el avance, que es lo único que hace útil una meta.
  metas: [
    {
      id: 'meta-1',
      anio: Number(hoyLocal().slice(0, 4)),
      periodo: 'mes',
      numero: Number(hoyLocal().slice(5, 7)),
      unidad: 'ingresos',
      valor: 60_000_000,
      responsable_id: null,
      incluye_equipo: true,
    },
  ],
  tiquetes_lotes: [],
  // Un saldo de muestra: sin él la alerta del cierre no se puede ver en la
  // demo, y es justamente la pantalla que hay que poder mostrarle al hotel.
  movimientos_tiquete: [
    { id: 'mt-1', tipo: 'zarpe',  clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 120 },
    { id: 'mt-2', tipo: 'parque', clase: 'saldo_inicial', fecha: '2026-08-01', cantidad: 45 },
  ],
}

// Las fichas de los clientes salen de las reservas de muestra, como en la base.
enlazarTitularesDeMuestra()

// Y el día de muestra arranca a media mañana, con la primera lancha ya afuera.
zarparLaPrimeraLancha()

/**
 * 48 caracteres hex, igual que el `encode(gen_random_bytes(24),'hex')` de la
 * migración. Nunca deriva del id de la reserva: un token no debe revelar a
 * qué reserva apunta ni permitir adivinar el siguiente.
 */
/**
 * Media mañana en la isla: la primera lancha ya zarpó.
 *
 * La demo arrancaba con cero zarpes y cero embarques, así que «cuánta gente
 * hay en la isla ahora» siempre daba cero y el bloque no se podía ver. Y no
 * era solo eso: el muelle también arrancaba con la lista entera sin tocar,
 * que no es el estado en el que uno mira esa pantalla.
 *
 * Se embarcan las reservas que ya están en la isla —las que el día de muestra
 * marca `en_isla`— y nadie ha regresado todavía, que es el momento en el que
 * este número sirve para algo.
 */
function zarparLaPrimeraLancha() {
  const hoy = hoyLocal()
  const enIsla = STORE.registros.filter(r => r.fecha === hoy && r.estado === 'en_isla')
  if (!enIsla.length) return

  // Con una lancha afuera el día está en operación, no planeándose. Dejarlo en
  // «planeando» con cinco personas en la isla sería el tipo de incoherencia
  // que hace dudar de todo lo demás.
  const dia = diaDe(hoy)
  dia.estado = 'en_operacion'
  dia.cerrado_tentativo_at = `${hoy}T13:00:00Z`   // 8 a.m. en Bogotá

  const ida = {
    id: 'z-hoy-ida',
    fecha: hoy,
    lancha_id: enIsla[0].lancha_id || 'l-maj1',
    sentido: 'ida',
    hora_programada: '08:30',
    hora_real_salida: `${hoy}T13:35:00Z`,   // 8:35 en Bogotá
    hora_real_regreso: null,
    piloto_id: PILOTOS[0]?.id || null,
    estado: 'zarpado',
    created_at: `${hoy}T12:00:00Z`,
  }
  STORE.zarpes.push(ida)

  // Un hecho por persona, como en el muelle: el toque de un dedo por cabeza.
  let n = 0
  for (const r of enIsla) {
    const pax = (r.adultos || 0) + (r.ninos || 0) + (r.infantes || 0) + (r.cortesias || 0)
    for (let i = 0; i < pax; i++) {
      STORE.embarques.push({
        id: genId(),
        zarpe_id: ida.id,
        pasajero_id: null,
        registro_id: r.id,
        evento: 'check_in',
        nombre: null, documento: null, pais_id: null, categoria: null,
        ocurrido_at: `${hoy}T13:${String(20 + (n % 15)).padStart(2, '0')}:00Z`,
        sincronizado_at: `${hoy}T13:30:00Z`,
        registrado_por: 'mock-dani',
        dispositivo: 'iPad del muelle',
        client_id: `emb-muestra-${n}`,
        created_at: `${hoy}T13:30:00Z`,
      })
      n += 1
    }
  }

  // Y los que van sin ser pasadía: al manifiesto sí, a `embarques` no.
  STORE.zarpe_empleados.push(
    { zarpe_id: ida.id, empleado_id: EMPLEADOS[0]?.id },
    { zarpe_id: ida.id, empleado_id: EMPLEADOS[1]?.id },
  )
}

function nuevoToken() {
  let t = ''
  for (let i = 0; i < 48; i++) t += '0123456789abcdef'[Math.floor(Math.random() * 16)]
  return t
}

// Toda reserva tiene su token, igual que el trigger de la 008.
STORE.registros.forEach(r => {
  STORE.tokens_reserva.push({
    id: genId(), registro_id: r.id, token: nuevoToken(),
    estado: 'activo', expira_at: null, enviado_at: null, enviado_por: null,
    veces_abierto: 0, created_at: new Date().toISOString(),
  })
})

// Solo en modo demo: la primera reserva de hoy responde también a /r/demo,
// para poder mostrar el flujo del cliente sin buscar un token de 48 letras.
;(function tokenDeDemostracion() {
  const primera = STORE.registros.find(
    r => r.fecha === hoyLocal() && !['cancelada', 'noshow'].includes(r.estado))
  if (!primera) return
  STORE.tokens_reserva.push({
    id: genId(), registro_id: primera.id, token: 'demo',
    estado: 'activo', expira_at: null, enviado_at: null, enviado_por: null,
    veces_abierto: 0, created_at: new Date().toISOString(),
  })
})()

// Todo lo existente es pasadía, igual que en la migración.
STORE.registros.forEach(r => { if (!r.tipo_ingreso_id) r.tipo_ingreso_id = 'ti-pasadia' })

// Cada fecha con reservas abre su día, igual que el trigger en Postgres.
STORE.registros.forEach(r => {
  if (!STORE.dias_operativos.some(d => d.fecha === r.fecha)) {
    STORE.dias_operativos.push({
      fecha: r.fecha,
      estado: 'planeando',
      cerrado_tentativo_at: null, cerrado_tentativo_por: null,
      cerrado_at: null, cerrado_por: null,
      notas: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
})

// El día de hoy arranca con sus zarpes programados y algunos nombres
// cargados: sin eso, la pantalla del muelle no se puede mostrar.
;(function sembrarOperacionDeHoy() {
  const hoy = hoyLocal()
  const deHoy = STORE.registros.filter(
    r => r.fecha === hoy && !['cancelada', 'noshow'].includes(r.estado))

  ;[...new Set(deHoy.map(r => r.lancha_id))].forEach(lancha_id => {
    STORE.zarpes.push({
      id: genId(), fecha: hoy, lancha_id, sentido: 'ida',
      hora_programada: '09:00', hora_real_salida: null, hora_real_regreso: null,
      capitan: null, tripulacion: null, estado: 'programado',
      cerrado_por: null, cerrado_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
  })

  const NOMBRES_DEMO = [
    'Carolina Martínez Ruiz', 'Tomás Herrera Peña', 'Ana Sofía Gómez',
    'Luis Fernando Cano', 'Marcela Ospina', 'Javier Restrepo Díaz',
    'Paula Andrea Ríos', 'Santiago Vélez', 'Isabel Cristina Mora',
  ]
  deHoy.slice(0, 4).forEach((r, i) => {
    const cuantos = Math.min(r.adultos, 3)
    for (let j = 0; j < cuantos; j++) {
      STORE.pasajeros.push({
        id: genId(), registro_id: r.id,
        nombre: NOMBRES_DEMO[(i * 3 + j) % NOMBRES_DEMO.length],
        tipo_documento: 'cc', documento: String(40000000 + i * 1000 + j),
        pais_id: 'pa-col', categoria: 'adulto',
        restriccion_alimentaria: i === 1 && j === 0 ? 'Sin gluten' : null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
    }
  })
})()

// ─── Tiempo real simulado ──────────────────────────────────────────────────────
// Un bus en memoria que imita a Postgres Changes y a Presence, para que el modo
// demo se comporte igual que la app conectada.

const BUS = { oyentes: new Set() }

function emitirCambio(tabla, tipo, fila, anterior = null) {
  BUS.oyentes.forEach(fn => {
    try { fn({ table: tabla, eventType: tipo, new: fila, old: anterior || fila }) }
    catch { /* un oyente roto no puede tumbar a los demás */ }
  })
}

const PRESENCIA = new Map()   // canal → { clave: [estado] }

class CanalMock {
  constructor(nombre, opciones = {}) {
    this._nombre = nombre
    this._clave = opciones?.config?.presence?.key || 'mock'
    this._cambios = []
    this._presencia = []
    this._suelta = null
    if (!PRESENCIA.has(nombre)) PRESENCIA.set(nombre, {})
  }

  on(tipo, filtro, cb) {
    if (tipo === 'postgres_changes') {
      this._cambios.push({ filtro, cb })
    } else if (tipo === 'presence') {
      this._presencia.push({ evento: filtro?.event, cb })
    }
    return this
  }

  subscribe(cb) {
    const oyente = (ev) => {
      this._cambios.forEach(({ filtro, cb: manejador }) => {
        if (filtro?.table && filtro.table !== ev.table) return
        if (filtro?.event && filtro.event !== '*' && filtro.event !== ev.eventType) return
        manejador(ev)
      })
    }
    BUS.oyentes.add(oyente)
    this._suelta = () => BUS.oyentes.delete(oyente)
    setTimeout(() => cb?.('SUBSCRIBED'), 0)
    return this
  }

  presenceState() {
    return PRESENCIA.get(this._nombre) || {}
  }

  async track(estado) {
    const mapa = PRESENCIA.get(this._nombre) || {}
    mapa[this._clave] = [{ ...estado, presence_ref: this._clave }]
    PRESENCIA.set(this._nombre, mapa)
    this._presencia.filter(p => p.evento === 'sync').forEach(p => setTimeout(p.cb, 0))
    return 'ok'
  }

  async untrack() {
    const mapa = PRESENCIA.get(this._nombre) || {}
    delete mapa[this._clave]
    this._presencia.filter(p => p.evento === 'sync').forEach(p => setTimeout(p.cb, 0))
    return 'ok'
  }

  unsubscribe() {
    this._suelta?.()
    return Promise.resolve('ok')
  }
}

// ─── Funciones del servidor (RPC) ──────────────────────────────────────────────
// Mismas reglas que las de 003_dia_operativo.sql.

function diaDe(fecha) {
  let dia = STORE.dias_operativos.find(d => d.fecha === fecha)
  if (!dia) {
    dia = {
      fecha, estado: 'planeando',
      cerrado_tentativo_at: null, cerrado_tentativo_por: null,
      cerrado_at: null, cerrado_por: null, notas: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    STORE.dias_operativos.push(dia)
  }
  return dia
}

/**
 * Espeja a la vista estado_embarques de 006: el último evento de cada
 * persona manda. La clave es el pasajero si lo hay, o el client_id.
 */
/** Los roles que pueden ver plata. Igual que `puedo_ver_dinero()` en la 015. */
const VEN_DINERO = ['super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial']

/**
 * El enlace del titular de la 025, aplicado a los datos de muestra.
 *
 * Sin esto la pantalla de Clientes salía vacía en la demo aunque hubiera
 * veinte reservas con cédula — que es exactamente el hueco que la 025 vino a
 * tapar en producción.
 */
function enlazarTitularesDeMuestra() {
  STORE.registros.forEach(r => {
    if (r.persona_id || !(r.identificacion || '').trim()) return
    r.persona_id = enlazarPersona({
      nombre: r.nombre_pasajero,
      documento: r.identificacion,
      tipo_documento: 'cc',
      pais_id: r.pais_id,
      telefono: r.telefono,
      email: r.email,
    })
  })
}

/** El documento sin puntos, espacios ni guiones. Igual que `documento_norm`. */
export function normalizarDocumento(doc) {
  return (doc || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null
}

/**
 * Espeja al trigger `pasajeros_enlazan_persona` de la 020: quien trae
 * documento se vuelve persona y se reconoce la próxima vez. Sin documento
 * devuelve null — esa plaza viaja sin identidad y no es un error.
 */
function enlazarPersona(pax) {
  const norm = normalizarDocumento(pax.documento)
  if (!norm || !(pax.nombre || '').trim()) return null

  const ya = STORE.personas.find(p => normalizarDocumento(p.documento) === norm)
  if (ya) {
    // Solo se completa lo que faltaba: el nombre no se pisa.
    ya.tipo_documento = ya.tipo_documento || pax.tipo_documento || null
    ya.pais_id = ya.pais_id || pax.pais_id || null
    return ya.id
  }

  const nueva = {
    id: genId(),
    nombre_completo: pax.nombre.trim(),
    tipo_documento: pax.tipo_documento || null,
    documento: (pax.documento || '').trim(),
    pais_id: pax.pais_id || null,
    // El contacto sube desde la reserva (025): una ficha sin cómo llamar a la
    // gente no sirve de nada.
    telefono: pax.telefono || null,
    email: pax.email || null,
    notas: null,
    created_at: new Date().toISOString(),
  }
  STORE.personas.push(nueva)
  return nueva.id
}

function rolActual() {
  return STORE.perfiles.find(p => p.user_id === MOCK_SESSION.user.id)?.rol || null
}

/**
 * La vista `reservas`: lo mismo que registros, con los precios en null para
 * quien no debe verlos.
 *
 * En Postgres esto lo hace un `case when puedo_ver_dinero() then …` dentro de
 * la vista, así que el null lo decide el servidor. Aquí se replica para que la
 * demo diga la verdad: si el mesero viera precios en la demo, nadie
 * descubriría que la vista no se está usando hasta producción.
 */
function derivarReservas() {
  if (VEN_DINERO.includes(rolActual())) return STORE.registros
  return STORE.registros.map(r => ({
    ...r,
    precio_adulto: null,
    precio_nino: null,
    precio_lancha: null,
    valor_cupo: null,
    // Marca para que joinRegistro no vuelva a calcular el total: en Postgres
    // la vista lo devuelve en null y aquí tiene que pasar lo mismo.
    _sinDinero: true,
  }))
}

/**
 * Las vistas `saldos_reserva` y `cartera_por_organizacion` de la 023.
 *
 * El cálculo va por `valorACobrar`, el mismo módulo que usa la app: si alguien
 * lo cambia, la demo cambia con él. Sumar `total_calculado` aquí habría hecho
 * que la demo mostrara cartera donde no la hay —cortesías, alojamiento— y esa
 * es justamente la equivocación contra la que existe esa función.
 */
function derivarSaldos() {
  if (!VEN_DINERO.includes(rolActual())) return []
  const hoy = hoyLocal()
  return STORE.registros.map(r => {
    const ti = STORE.tipos_ingreso.find(t => t.id === r.tipo_ingreso_id)
    const pagos = STORE.pagos.filter(p => p.registro_id === r.id)
    const aCobrar = valorACobrar(r, ti)
    const pagado = pagadoDe(pagos)
    return {
      registro_id: r.id,
      fecha: r.fecha,
      estado: r.estado,
      nombre_pasajero: r.nombre_pasajero,
      nombre_grupo: r.nombre_grupo,
      agencia_id: r.agencia_id,
      agencia_nombre: r.agencia_nombre,
      forma_pago: r.forma_pago,
      a_cobrar: aCobrar,
      pagado,
      saldo: aCobrar - pagado,
      dias: diasDeDeuda(r.fecha, hoy),
    }
  })
}

function derivarCartera() {
  const hoy = hoyLocal()
  const porOrg = new Map()
  derivarSaldos()
    .filter(s => s.saldo > 0 && s.fecha <= hoy)
    .forEach(s => {
      const org = STORE.organizaciones.find(o => o.id === s.agencia_id)
      const clave = s.agencia_id || s.agencia_nombre || 'sin-organizacion'
      if (!porOrg.has(clave)) {
        porOrg.set(clave, {
          organizacion_id: s.agencia_id || 'sin-organizacion',
          organizacion: org?.nombre || s.agencia_nombre || 'Sin agencia',
          reservas: 0, total: 0,
          al_dia: 0, de_31_a_60: 0, de_61_a_90: 0, mas_de_90: 0,
          mas_viejo: 0,
        })
      }
      const fila = porOrg.get(clave)
      fila.reservas += 1
      fila.total += s.saldo
      fila[tramoDe(s.dias)] += s.saldo
      fila.mas_viejo = Math.max(fila.mas_viejo, s.dias)
    })
  return [...porOrg.values()].sort((a, b) => b.total - a.total)
}

/**
 * La vista `avance_metas` de la 026.
 *
 * El avance se calcula con `valorACobrar`, igual que la cartera: una meta que
 * contara `total_calculado` sumaría las cortesías y diría que se vendió más de
 * lo que se vendió.
 */
function derivarAvanceMetas() {
  if (!VEN_DINERO.includes(rolActual()) && rolActual() !== 'asesora') return []
  return STORE.metas.map(m => {
    const { desde, hasta } = rangoDeMeta(m.anio, m.periodo, m.numero)
    const cuentan = STORE.registros.filter(r =>
      r.fecha >= desde && r.fecha <= hasta &&
      !['cancelada', 'noshow'].includes(r.estado) &&
      (!m.responsable_id || m.incluye_equipo || r.vendida_por_id === m.responsable_id))

    const logrado = m.unidad === 'ingresos'
      ? cuentan.reduce((s, r) => {
          const ti = STORE.tipos_ingreso.find(t => t.id === r.tipo_ingreso_id)
          return s + valorACobrar(r, ti)
        }, 0)
      : cuentan.reduce((s, r) => s + r.adultos + r.ninos, 0)

    return {
      ...m,
      responsable: STORE.perfiles.find(p => p.user_id === m.responsable_id)?.nombre
        || 'Todo el pasadía',
      desde, hasta, logrado,
    }
  })
}

/** La vista `clientes_ficha` de la 025: la persona con sus visitas. */
function visitasDe(personaId) {
  const dias = new Set()
  STORE.registros
    .filter(r => !['cancelada', 'noshow'].includes(r.estado))
    .filter(r => r.persona_id === personaId
      || STORE.pasajeros.some(p => p.registro_id === r.id && p.persona_id === personaId))
    .forEach(r => dias.add(r.fecha))
  return [...dias].sort()
}

function derivarClientesFicha() {
  return STORE.personas.map(p => {
    const dias = visitasDe(p.id)
    return { ...p, visitas: dias.length, ultima: dias[dias.length - 1] || null }
  })
}

function derivarEstadoEmbarques() {
  const ultimo = new Map()
  ;[...STORE.embarques]
    .sort((a, b) => new Date(a.ocurrido_at) - new Date(b.ocurrido_at))
    .forEach(e => {
      ultimo.set(`${e.zarpe_id}|${e.pasajero_id || e.client_id}`, e)
    })
  return [...ultimo.values()].map(e => ({
    zarpe_id: e.zarpe_id,
    pasajero_id: e.pasajero_id || null,
    registro_id: e.registro_id || null,
    client_id: e.client_id,
    estado: e.evento,
    nombre: e.nombre || null,
    documento: e.documento || null,
    categoria: e.categoria || null,
    ocurrido_at: e.ocurrido_at,
    // Los dos que añadió la 011: el manifiesto de Capitanía los exige.
    tipo_documento: e.tipo_documento || null,
    pais_id: e.pais_id || null,
  }))
}

/** Espeja al trigger registrar_cambio_estado de 003_dia_operativo.sql. */
function anotarCambioEstado(registro, anterior, nuevo, origen, motivo = null) {
  STORE.cambios_estado.push({
    id: genId(),
    registro_id: registro.id,
    estado_anterior: anterior,
    estado_nuevo: nuevo,
    origen,
    motivo,
    registrado_por: MOCK_SESSION.user.id,
    ocurrido_at: new Date().toISOString(),
  })
}

const RPC = {
  /**
   * Cuentas creadas en Supabase que todavía no tienen perfil.
   *
   * En la demo no hay `auth.users`, así que se simula con dos cuentas fijas:
   * sin ellas la pantalla de usuarios se vería siempre vacía por arriba y no
   * habría forma de comprobar el caso que de verdad importa —alguien que ya
   * puede iniciar sesión pero todavía no ve nada—.
   */
  cuentas_sin_perfil() {
    const pendientes = [
      { user_id: 'mock-user-daniela', email: 'daniela@majagua.com', creada_at: new Date().toISOString() },
      { user_id: 'mock-user-isla',    email: 'isla@majagua.com',    creada_at: new Date().toISOString() },
    ]
    return {
      data: pendientes.filter(c => !STORE.perfiles.some(p => p.user_id === c.user_id)),
      error: null,
    }
  },

  cerrar_tentativo({ p_fecha }) {
    const dia = diaDe(p_fecha)
    if (dia.estado !== 'planeando') {
      return { data: null, error: { message: `El día ya no está en planeación (está en ${dia.estado})` } }
    }
    STORE.registros
      .filter(r => r.fecha === p_fecha && r.estado === 'tentativa')
      .forEach(r => {
        const antes = { ...r }
        r.estado = 'confirmada'
        // El trigger de Postgres registra TODO cambio de estado, incluidos
        // los que dispara el sistema. El mock tiene que hacer lo mismo.
        anotarCambioEstado(r, antes.estado, 'confirmada', 'sistema')
        emitirCambio('registros', 'UPDATE', r, antes)
      })
    dia.estado = 'tentativo_cerrado'
    dia.cerrado_tentativo_at = new Date().toISOString()
    dia.cerrado_tentativo_por = MOCK_SESSION.user.id
    dia.cerrado_tentativo_por_nombre = MOCK_SESSION.user.user_metadata.full_name
    emitirCambio('dias_operativos', 'UPDATE', dia)
    return { data: dia, error: null }
  },

  cerrar_dia({ p_fecha }) {
    const dia = diaDe(p_fecha)
    dia.estado = 'cerrado'
    dia.cerrado_at = new Date().toISOString()
    dia.cerrado_por = MOCK_SESSION.user.id
    dia.cerrado_por_nombre = MOCK_SESSION.user.user_metadata.full_name
    emitirCambio('dias_operativos', 'UPDATE', dia)
    return { data: dia, error: null }
  },

  programar_zarpes({ p_fecha, p_hora = null }) {
    // Como el servidor desde la 018: sin hora explícita manda el ajuste de la
    // hora de zarpe, no un número escrito aquí.
    const hora = p_hora
      || STORE.ajustes.find(a => a.clave === 'checkin_cierra_hora')?.valor
      || '08:30'
    const lanchas = [...new Set(
      STORE.registros
        .filter(r => r.fecha === p_fecha && !['cancelada', 'noshow'].includes(r.estado))
        .map(r => r.lancha_id)
    )]
    lanchas.forEach(lancha_id => {
      const ya = STORE.zarpes.some(z =>
        z.fecha === p_fecha && z.lancha_id === lancha_id && z.sentido === 'ida' && z.hora_programada === hora)
      if (ya) return
      const z = {
        id: genId(), fecha: p_fecha, lancha_id, sentido: 'ida',
        hora_programada: hora, hora_real_salida: null, hora_real_regreso: null,
        capitan: null, tripulacion: null, estado: 'programado',
        cerrado_por: null, cerrado_at: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      STORE.zarpes.push(z)
      emitirCambio('zarpes', 'INSERT', z)
    })
    return { data: STORE.zarpes.filter(z => z.fecha === p_fecha), error: null }
  },

  /**
   * "Ya le pasé este número a cocina" (013).
   *
   * El almuerzo lo comanda el mesero en la mesa, así que el conteo del
   * check-in es un pronóstico. Lo que hace falta saber es con qué número
   * preparó cocina, para poder decir cuánto se movió desde entonces.
   */
  marcar_revision_cocina({ p_fecha, p_conteo }) {
    const dia = diaDe(p_fecha)
    dia.cocina_revisado_at = new Date().toISOString()
    dia.cocina_revisado_por = MOCK_SESSION.user.id
    dia.cocina_revisado_por_nombre = MOCK_SESSION.user.user_metadata.full_name
    dia.cocina_revisado_conteo = p_conteo
    emitirCambio('dias_operativos', 'UPDATE', dia)
    return {
      data: {
        fecha: dia.fecha,
        revisado_at: dia.cocina_revisado_at,
        revisado_por: dia.cocina_revisado_por_nombre,
        conteo: dia.cocina_revisado_conteo,
      },
      error: null,
    }
  },

  revision_cocina({ p_fecha }) {
    const dia = STORE.dias_operativos.find(d => d.fecha === p_fecha)
    if (!dia) return { data: null, error: null }
    return {
      data: {
        revisado_at: dia.cocina_revisado_at || null,
        revisado_por: dia.cocina_revisado_por_nombre || null,
        conteo: dia.cocina_revisado_conteo || null,
      },
      error: null,
    }
  },

  /**
   * El regreso de las 3:30 (011). Solo vuelven las lanchas que fueron:
   * programarle el regreso a una que nunca zarpó llenaría el muelle de zarpes
   * vacíos que alguien tendría que cerrar a mano.
   */
  programar_regresos({ p_fecha, p_hora = null }) {
    const hora = p_hora || '15:30'
    const idas = STORE.zarpes.filter(z =>
      z.fecha === p_fecha && z.sentido === 'ida' && ['zarpado', 'regresado'].includes(z.estado))

    const porLancha = new Map()
    idas.forEach(z => { if (!porLancha.has(z.lancha_id)) porLancha.set(z.lancha_id, z) })

    porLancha.forEach((ida, lancha_id) => {
      const ya = STORE.zarpes.some(z =>
        z.fecha === p_fecha && z.lancha_id === lancha_id && z.sentido === 'regreso' && z.hora_programada === hora)
      if (ya) return
      const z = {
        id: genId(), fecha: p_fecha, lancha_id, sentido: 'regreso',
        hora_programada: hora, hora_real_salida: null, hora_real_regreso: null,
        piloto_id: ida.piloto_id || null,
        capitan: null, tripulacion: null, estado: 'programado',
        cerrado_por: null, cerrado_at: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      STORE.zarpes.push(z)
      emitirCambio('zarpes', 'INSERT', z)
    })
    return { data: STORE.zarpes.filter(z => z.fecha === p_fecha && z.sentido === 'regreso'), error: null }
  },

  cerrar_zarpe({ p_zarpe_id }) {
    const z = STORE.zarpes.find(x => x.id === p_zarpe_id)
    if (!z) return { data: null, error: { message: 'No existe ese zarpe' } }
    if (['zarpado', 'regresado', 'cancelado'].includes(z.estado)) {
      return { data: null, error: { message: `Ese zarpe ya está ${z.estado}` } }
    }

    const estados = derivarEstadoEmbarques().filter(e => e.zarpe_id === p_zarpe_id)

    if (z.sentido === 'ida') {
      z.estado = 'zarpado'
      z.hora_real_salida = z.hora_real_salida || new Date().toISOString()

      const subieron = new Set(
        estados.filter(e => ['check_in', 'walk_in'].includes(e.estado) && e.registro_id).map(e => e.registro_id))
      const noLlegaron = new Set(
        estados.filter(e => e.estado === 'no_show' && e.registro_id).map(e => e.registro_id))

      STORE.registros
        .filter(r => r.fecha === z.fecha && ['confirmada', 'tentativa'].includes(r.estado))
        .forEach(r => {
          const antes = { ...r }
          if (subieron.has(r.id)) r.estado = 'en_isla'
          else if (noLlegaron.has(r.id)) r.estado = 'noshow'
          if (r.estado !== antes.estado) {
            anotarCambioEstado(r, antes.estado, r.estado, 'sistema')
            emitirCambio('registros', 'UPDATE', r, antes)
          }
        })

      const dia = STORE.dias_operativos.find(d => d.fecha === z.fecha)
      if (dia && dia.estado === 'tentativo_cerrado') {
        dia.estado = 'en_operacion'
        emitirCambio('dias_operativos', 'UPDATE', dia)
      }
    } else {
      z.estado = 'regresado'
      z.hora_real_regreso = new Date().toISOString()

      // Quien bajó terminó su pasadía. Quien no bajó se queda en 'en_isla' a
      // propósito: esa es la alerta de faltantes, y no se apaga sola.
      const bajaron = new Set(
        estados.filter(e => e.estado === 'desembarque' && e.registro_id).map(e => e.registro_id))

      STORE.registros
        .filter(r => r.fecha === z.fecha && r.estado === 'en_isla' && bajaron.has(r.id))
        .forEach(r => {
          const antes = { ...r }
          r.estado = 'completada'
          anotarCambioEstado(r, antes.estado, r.estado, 'sistema')
          emitirCambio('registros', 'UPDATE', r, antes)

          // El enlace deja de editar y pasa a ser recuerdo: siete días para el
          // agradecimiento y la reseña, y después no abre más.
          const t = STORE.tokens_reserva.find(x => x.registro_id === r.id)
          if (t && t.estado !== 'expirado') {
            t.estado = 'finalizado'
            t.expira_at = t.expira_at ||
              new Date(new Date(z.fecha + 'T12:00:00').getTime() + 7 * 864e5).toISOString()
          }
        })
    }

    z.cerrado_por = MOCK_SESSION.user.id
    z.cerrado_at = new Date().toISOString()
    emitirCambio('zarpes', 'UPDATE', z)
    return { data: z, error: null }
  },

  // ── La puerta pública (008) ──────────────────────────────────────────────
  // Mismas reglas que las funciones SECURITY DEFINER: solo lo de esa
  // reserva, y nunca precios ni folios.
  reserva_publica({ p_token }) {
    const t = STORE.tokens_reserva.find(x => x.token === p_token && x.estado !== 'expirado')
    if (!t) return { data: null, error: null }
    const r = STORE.registros.find(x => x.id === t.registro_id)
    if (!r) return { data: null, error: null }
    const dia = STORE.dias_operativos.find(d => d.fecha === r.fecha)
    const hoy = hoyLocal()
    const dias = Math.round((new Date(r.fecha) - new Date(hoy)) / 86400000)

    return {
      data: {
        titular: r.nombre_pasajero, grupo: r.nombre_grupo, agencia: r.agencia_nombre,
        fecha: r.fecha, estado: r.estado,
        adultos: r.adultos, ninos: r.ninos, infantes: r.infantes, cortesias: r.cortesias,
        plan: STORE.planes.find(p => p.id === r.plan_id)?.nombre || null,
        lancha: STORE.lanchas.find(l => l.id === r.lancha_id)?.nombre || null,
        estado_dia: dia?.estado || 'planeando',
        puede_check_in: (dia?.estado || 'planeando') === 'planeando' && dias >= 0 && dias <= 2,
        edad_max_infante: STORE.ajustes.find(a => a.clave === 'edad_max_infante')?.valor || '3',
        check_in_at: r.check_in_at || null,
        tiene_firma: STORE.firmas.some(f => f.registro_id === r.id),
        opciones_plato: STORE.opciones_plato
          .filter(o => o.plan_id === r.plan_id && o.activo)
          .map(o => ({ id: o.id, es: o.nombre_es, en: o.nombre_en })),
        pasajeros: STORE.pasajeros.filter(p => p.registro_id === r.id),
        paises: STORE.paises.map(p => ({ id: p.id, nombre: p.nombre })),
      },
      error: null,
    }
  },

  marcar_token_abierto({ p_token }) {
    const t = STORE.tokens_reserva.find(x => x.token === p_token)
    if (t) t.veces_abierto = (t.veces_abierto || 0) + 1
    return { data: null, error: null }
  },

  documento_vigente({ p_idioma = 'es' }) {
    const d = STORE.documentos_legales.find(x => x.idioma === p_idioma && !x.vigente_hasta)
    return { data: d ? { id: d.id, titulo: d.titulo, contenido: d.contenido, version: d.version } : null, error: null }
  },

  /**
   * Como `consumo_tiquetes_del_dia` de la 022: **tres poblaciones**, no una.
   * Los huéspedes de alojamiento no están en `embarques` y sí consumen
   * tiquete — es el error que la planilla arrastra y que aquí no se repite.
   */
  consumo_tiquetes_del_dia({ p_fecha }) {
    const idsIda = STORE.zarpes
      .filter(z => z.fecha === p_fecha && z.sentido === 'ida').map(z => z.id)
    const estados = derivarEstadoEmbarques().filter(e => idsIda.includes(e.zarpe_id))

    const consume = registroId => {
      const r = STORE.registros.find(x => x.id === registroId)
      const ti = STORE.tipos_ingreso.find(t => t.id === r?.tipo_ingreso_id)
      return ti?.consume_tiquete ?? true   // ante la duda, se cuenta
    }

    const conReserva = estados.filter(e =>
      ['check_in', 'walk_in'].includes(e.estado) && e.registro_id && consume(e.registro_id)).length
    const sinReserva = estados.filter(e => e.estado === 'walk_in' && !e.registro_id).length
    const alojamiento = STORE.zarpe_alojamiento.filter(a => idsIda.includes(a.zarpe_id)).length

    return {
      data: {
        fecha: p_fecha,
        con_reserva: conReserva,
        walk_in_sin_reserva: sinReserva,
        alojamiento,
        total: conReserva + sinReserva + alojamiento,
      },
      error: null,
    }
  },

  saldo_tiquetes() {
    const suma = tipo => STORE.movimientos_tiquete
      .filter(m => m.tipo === tipo)
      .reduce((s, m) => s + m.cantidad, 0)
    return { data: [
      { tipo: 'parque', saldo: suma('parque') },
      { tipo: 'zarpe',  saldo: suma('zarpe') },
    ], error: null }
  },

  /** «Quedan 30 y mañana van 87.» */
  alerta_tiquetes({ p_fecha }) {
    const dia = p_fecha || hoyLocal()
    // Anclado al mediodía: sumarle un día a medianoche se corre de fecha al
    // pasar por UTC, que es justo lo que la regla 6 evita.
    const manana = new Date(dia + 'T12:00:00')
    manana.setDate(manana.getDate() + 1)
    const fechaManana = manana.toISOString().slice(0, 10)

    const necesita = STORE.registros
      .filter(r => r.fecha === fechaManana && !['cancelada', 'noshow'].includes(r.estado))
      .filter(r => {
        const ti = STORE.tipos_ingreso.find(t => t.id === r.tipo_ingreso_id)
        return ti?.consume_tiquete ?? true
      })
      .reduce((s, r) => s + r.adultos + r.ninos + (r.infantes || 0) + (r.cortesias || 0), 0)

    const saldos = {}
    let minimo = Infinity
    RPC.saldo_tiquetes().data.forEach(s => { saldos[s.tipo] = s.saldo; minimo = Math.min(minimo, s.saldo) })
    if (!Number.isFinite(minimo)) minimo = 0

    return {
      data: {
        fecha: fechaManana,
        necesita,
        saldos,
        alcanza: minimo >= necesita,
        faltan: Math.max(necesita - minimo, 0),
      },
      error: null,
    }
  },

  /** Como `liquidacion_comisiones` de la 026: el porcentaje del día del pasadía. */
  liquidacion_comisiones({ p_desde, p_hasta }) {
    const vigente = (orgId, fecha) => {
      const c = STORE.comisiones
        .filter(x => x.organizacion_id === orgId && x.desde <= fecha && (!x.hasta || x.hasta >= fecha))
        .sort((a, b) => b.desde.localeCompare(a.desde))[0]
      return c ? Number(c.porcentaje) : 0
    }

    const porOrg = new Map()
    STORE.registros
      .filter(r => r.agencia_id && r.fecha >= p_desde && r.fecha <= p_hasta
        && !['cancelada', 'noshow'].includes(r.estado))
      .forEach(r => {
        const ti = STORE.tipos_ingreso.find(t => t.id === r.tipo_ingreso_id)
        const base = valorACobrar(r, ti)
        if (!porOrg.has(r.agencia_id)) {
          porOrg.set(r.agencia_id, {
            organizacion_id: r.agencia_id,
            organizacion: STORE.organizaciones.find(o => o.id === r.agencia_id)?.nombre || 'Sin agencia',
            reservas: 0, base: 0, porcentaje: vigente(r.agencia_id, p_hasta), comision: 0,
          })
        }
        const fila = porOrg.get(r.agencia_id)
        fila.reservas += 1
        fila.base += base
        fila.comision += base * vigente(r.agencia_id, r.fecha) / 100
      })

    return {
      data: [...porOrg.values()].filter(f => f.base > 0).sort((a, b) => b.comision - a.comision),
      error: null,
    }
  },

  /** Como `ficha_persona` de la 025. */
  ficha_persona({ p_persona_id }) {
    const p = STORE.personas.find(x => x.id === p_persona_id)
    if (!p) return { data: null, error: { message: 'No existe esa persona' } }

    const suyas = STORE.registros.filter(r =>
      !['cancelada', 'noshow'].includes(r.estado) &&
      (r.persona_id === p.id ||
       STORE.pasajeros.some(pa => pa.registro_id === r.id && pa.persona_id === p.id)))

    const historial = suyas
      .map(r => ({
        fecha: r.fecha,
        registro_id: r.id,
        plan: STORE.planes.find(pl => pl.id === r.plan_id)?.nombre || null,
        titular: r.persona_id === p.id,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))

    const dias = [...new Set(suyas.map(r => r.fecha))].sort()
    const propias = suyas.filter(r => r.persona_id === p.id)
    const gastado = propias.reduce((s, r) => {
      const ti = STORE.tipos_ingreso.find(t => t.id === r.tipo_ingreso_id)
      return s + valorACobrar(r, ti)
    }, 0)

    // Las mismas etiquetas que calcula la 025, al vuelo.
    const etiquetas = []
    if (dias.length >= 3) etiquetas.push('viene seguido')
    const ultima = dias[dias.length - 1]
    if (ultima) {
      const hace = diasDeDeuda(ultima, hoyLocal())
      if (hace > 365) etiquetas.push('no vuelve hace más de un año')
    }
    if (propias.some(r => STORE.pasajeros.some(pa =>
        pa.registro_id === r.id && ['nino', 'infante'].includes(pa.categoria)))) {
      etiquetas.push('viaja con niños')
    }
    const pais = STORE.paises.find(x => x.id === p.pais_id)
    if (pais && pais.codigo !== 'CO') etiquetas.push('del exterior')

    return {
      data: {
        persona: p,
        visitas: dias.length,
        primera: dias[0] || null,
        ultima: ultima || null,
        gastado: VEN_DINERO.includes(rolActual()) ? gastado : null,
        plan_usual: historial.find(h => h.plan)?.plan || null,
        etiquetas_calculadas: etiquetas,
        etiquetas_puestas: [],
        organizaciones: [],
        historial,
      },
      error: null,
    }
  },

  /** Como `anular_pago` de la 023: un pago no se borra, se anula con motivo. */
  anular_pago({ p_pago_id, p_motivo }) {
    if (!(p_motivo || '').trim()) {
      return { data: null, error: { message: 'Anular un pago necesita motivo' } }
    }
    const pg = STORE.pagos.find(p => p.id === p_pago_id && p.estado !== 'anulado')
    if (!pg) return { data: null, error: { message: 'Ese pago no existe o ya estaba anulado' } }
    pg.estado = 'anulado'
    pg.anulado_motivo = p_motivo.trim()
    pg.anulado_at = new Date().toISOString()
    return { data: pg, error: null }
  },

  /** Como `atender_ticket` de la 021: solo quien mantiene el sistema. */
  atender_ticket({ p_ticket_id, p_estado, p_respuesta }) {
    if (rolActual() !== 'super_admin') {
      return { data: null, error: { message: 'Los reportes los atiende quien mantiene el sistema' } }
    }
    const t = STORE.tickets.find(x => x.id === p_ticket_id)
    if (!t) return { data: null, error: { message: 'No existe ese reporte' } }
    t.estado = p_estado
    if ((p_respuesta || '').trim()) t.respuesta = p_respuesta.trim()
    t.atendido_por = MOCK_SESSION.user.id
    t.atendido_at = new Date().toISOString()
    return { data: t, error: null }
  },

  /** Como `buscar_personas` de la 020: por documento o por nombre, desde 3 letras. */
  buscar_personas({ p_texto, p_limite = 8 }) {
    const texto = (p_texto || '').trim()
    if (texto.length < 3) return { data: [], error: null }
    const norm = normalizarDocumento(texto)
    const encaja = p => {
      const pd = normalizarDocumento(p.documento)
      // Contiene, no empieza por (029). Los documentos se digitan «CC 1023456»
      // y el número queda detrás de las letras: con `startsWith`, buscar el
      // número no encontraba a nadie.
      return (norm && pd && pd.includes(norm))
        || p.nombre_completo.toLowerCase().includes(texto.toLowerCase())
    }
    const veces = p => STORE.pasajeros.filter(x => x.persona_id === p.id).length
    const filas = STORE.personas.filter(encaja)
      .sort((a, b) => veces(b) - veces(a) || a.nombre_completo.localeCompare(b.nombre_completo))
      .slice(0, Math.min(p_limite || 8, 25))
      .map(p => ({ ...p, veces: veces(p) }))
    return { data: filas, error: null }
  },

  guardar_pasajeros_por_token({ p_token, p_pasajeros }) {
    const t = STORE.tokens_reserva.find(x => x.token === p_token && x.estado !== 'expirado')
    if (!t) return { data: null, error: { message: 'Este enlace ya no está disponible' } }
    const r = STORE.registros.find(x => x.id === t.registro_id)
    const dia = STORE.dias_operativos.find(d => d.fecha === r.fecha)
    if ((dia?.estado || 'planeando') !== 'planeando') {
      return { data: null, error: { message: 'La lista de este día ya se cerró' } }
    }
    // Como el servidor desde la 018: se empareja por id en vez de borrar y
    // reinsertar. Borrar a alguien que ya embarcó choca contra la
    // inmutabilidad de `embarques`, y eso hacía fallar el guardado entero
    // justo en la hora del embarque.
    const recibidos = []
    ;(p_pasajeros || []).forEach(p => {
      if (!(p.nombre || '').trim()) return
      const previo = p.id && STORE.pasajeros.find(x => x.id === p.id && x.registro_id === r.id)
      const campos = {
        nombre: p.nombre.trim(),
        tipo_documento: p.tipo_documento || null,
        documento: p.documento || null,
        pais_id: p.pais_id || null,
        categoria: p.categoria || 'adulto',
        opcion_plato_id: p.opcion_plato_id || null,
        restriccion_alimentaria: p.restriccion_alimentaria || null,
        updated_at: new Date().toISOString(),
      }
      if (previo) {
        Object.assign(previo, campos)
        previo.persona_id = enlazarPersona(previo) || previo.persona_id
        recibidos.push(previo.id)
      } else {
        const nuevo = {
          id: genId(), registro_id: r.id, ...campos,
          almuerza: p.almuerza !== false,
          created_at: new Date().toISOString(),
        }
        nuevo.persona_id = enlazarPersona(nuevo)
        STORE.pasajeros.push(nuevo)
        recibidos.push(nuevo.id)
      }
    })

    const embarcado = STORE.pasajeros.find(p =>
      p.registro_id === r.id && !recibidos.includes(p.id)
      && STORE.embarques.some(e => e.pasajero_id === p.id))
    if (embarcado) {
      return { data: null, error: { message:
        `${embarcado.nombre} ya embarcó y no se puede quitar de la lista desde aquí. En el muelle te ayudan con el cambio.` } }
    }
    STORE.pasajeros = STORE.pasajeros.filter(p =>
      p.registro_id !== r.id || recibidos.includes(p.id))

    emitirCambio('pasajeros', 'UPDATE', { registro_id: r.id })
    return RPC.reserva_publica({ p_token })
  },

  firmar_por_token({ p_token, p_documento_legal_id, p_firmante_nombre, p_firmante_documento, p_trazo, p_client_id, p_dispositivo }) {
    const t = STORE.tokens_reserva.find(x => x.token === p_token && x.estado !== 'expirado')
    if (!t) return { data: null, error: { message: 'Este enlace ya no está disponible' } }
    const r = STORE.registros.find(x => x.id === t.registro_id)
    const dia = STORE.dias_operativos.find(d => d.fecha === r.fecha)
    if ((dia?.estado || 'planeando') !== 'planeando') {
      return { data: null, error: { message: 'La lista de este día ya se cerró' } }
    }
    if (!STORE.firmas.some(f => f.client_id === p_client_id)) {
      STORE.firmas.push({
        id: genId(), registro_id: r.id, documento_legal_id: p_documento_legal_id,
        firmante_nombre: p_firmante_nombre, firmante_documento: p_firmante_documento || null,
        trazo_datos: p_trazo, dispositivo: p_dispositivo || null,
        hash: `mock-${p_client_id}`, client_id: p_client_id,
        firmado_at: new Date().toISOString(), created_at: new Date().toISOString(),
      })
    }
    r.check_in_at = r.check_in_at || new Date().toISOString()
    r.check_in_desde = 'publico'
    t.estado = 'check_in_abierto'
    emitirCambio('registros', 'UPDATE', r)
    return RPC.reserva_publica({ p_token })
  },

  cambiar_estado_manual({ p_registro_id, p_estado, p_motivo }) {
    const reg = STORE.registros.find(r => r.id === p_registro_id)
    if (!reg) return { data: null, error: { message: 'No existe la reserva' } }
    const antes = { ...reg }
    reg.estado = p_estado
    anotarCambioEstado(reg, antes.estado, p_estado, 'manual', p_motivo || null)
    emitirCambio('registros', 'UPDATE', reg, antes)
    return { data: reg, error: null }
  },
}

// ─── Query Builder ─────────────────────────────────────────────────────────────

class QB {
  constructor(tableName) {
    this._table = tableName
    this._op = 'select'
    this._filters = []
    this._ordenes = []
    this._limit = null
    this._rangeFrom = null
    this._rangeTo = null
    this._isSingle = false
    this._countMode = false
    this._insertPayload = null
    this._updatePayload = null
    this._selectCalled = false
    this._onConflict = null
  }

  select(_, opts = {}) {
    this._selectCalled = true
    if (opts && opts.count === 'exact') this._countMode = true
    return this
  }

  insert(data) {
    this._op = 'insert'
    this._insertPayload = Array.isArray(data) ? data : [data]
    return this
  }

  update(data) {
    this._op = 'update'
    this._updatePayload = data
    return this
  }

  /**
   * Reenviar la cola del iPad no debe duplicar hechos.
   *
   * Con `onConflict` se comporta como en Postgres: si ya hay una fila con esas
   * columnas, se actualiza en vez de agregar otra. Sin esto, guardar dos veces
   * el mismo ajuste dejaba dos filas con la misma clave y la demo empezaba a
   * mentir despacio — que es la peor forma de mentir.
   */
  upsert(data, opciones = {}) {
    this._op = 'insert'
    this._insertPayload = Array.isArray(data) ? data : [data]
    this._onConflict = opciones.onConflict
      ? String(opciones.onConflict).split(',').map(c => c.trim())
      : null
    return this
  }

  delete() {
    this._op = 'delete'
    return this
  }

  eq(col, val) {
    this._filters.push(r => String(r[col]) === String(val))
    return this
  }

  neq(col, val) {
    this._filters.push(r => String(r[col]) !== String(val))
    return this
  }

  in(col, valores) {
    const set = new Set((valores || []).map(String))
    this._filters.push(r => set.has(String(r[col])))
    return this
  }

  ilike(col, pattern) {
    const clean = pattern.replace(/%/g, '.*')
    const re = new RegExp(clean, 'i')
    this._filters.push(r => re.test(r[col] || ''))
    return this
  }

  /**
   * `or('nombre.ilike.*ana*,folio.eq.4471')` — la forma de PostgREST.
   *
   * La búsqueda global la necesita: una reserva se encuentra por el titular,
   * por el nombre del grupo o por el folio, y son tres columnas de la misma
   * fila. Sin esto habría que lanzar tres consultas y unirlas a mano, que es
   * justo lo que el servidor sabe hacer solo.
   *
   * Entiende `ilike` y `eq`, que es lo que se usa. Un operador que no conozca
   * no encuentra nada en vez de encontrarlo todo: en una búsqueda, de más es
   * peor que de menos.
   */
  or(expresion) {
    const partes = String(expresion).split(',').map(p => p.trim()).filter(Boolean)
    const pruebas = partes.map(parte => {
      const [col, op, ...resto] = parte.split('.')
      const valor = resto.join('.')
      if (op === 'ilike') {
        // Se escapa todo menos los comodines, y después `*` y `%` se vuelven
        // `.*`. Al revés —escapar primero el asterisco— el comodín quedaría
        // literal y la búsqueda no encontraría nada.
        const re = new RegExp(
          valor.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*'),
          'i'
        )
        return r => re.test(r[col] ?? '')
      }
      if (op === 'eq') return r => String(r[col] ?? '') === valor
      return () => false
    })
    this._filters.push(r => pruebas.some(p => p(r)))
    return this
  }

  lte(col, val) {
    this._filters.push(r => r[col] <= val)
    return this
  }

  gte(col, val) {
    this._filters.push(r => r[col] >= val)
    return this
  }

  /**
   * `is('col', null)` es como se pregunta por nulo en PostgREST — `eq` no
   * sirve, porque en SQL nada es igual a null. Lo usa la lista de comisiones
   * para traer solo las vigentes (`hasta is null`).
   */
  is(col, val) {
    if (val === null) this._filters.push(r => r[col] === null || r[col] === undefined)
    else this._filters.push(r => r[col] === val)
    return this
  }

  /**
   * Se acumulan, como en PostgREST: el primer `order` manda y los siguientes
   * desempatan. Antes el segundo pisaba al primero, así que una lista pedida
   * "lo bloqueante primero, y dentro de eso lo más reciente" salía solo por
   * fecha —y en la demo se veía bien ordenada, que es lo peor que puede pasar:
   * el fallo no aparece hasta producción.
   */
  order(col, opts = {}) {
    this._ordenes.push({ col, asc: opts.ascending !== false })
    return this
  }

  limit(n) {
    this._limit = n
    return this
  }

  range(from, to) {
    this._rangeFrom = from
    this._rangeTo = to
    return this
  }

  single() {
    this._isSingle = true
    return this
  }

  maybeSingle() {
    this._isSingle = true
    return this
  }

  then(resolve, reject) {
    return Promise.resolve(this._run()).then(resolve, reject)
  }

  _getRows() {
    // La vista estado_embarques no es una tabla: se deriva del último
    // evento de cada persona, igual que en Postgres.
    if (this._table === 'estado_embarques') return derivarEstadoEmbarques()
    // Y `reservas` tampoco: es registros con los precios en null para quien no
    // puede verlos. Sin esto en la demo no habría forma de comprobar que el
    // mesero no ve plata, que es la promesa central de la fase de roles.
    if (this._table === 'reservas') return derivarReservas()
    // Las vistas de dinero de la 023: se derivan, no se guardan.
    if (this._table === 'clientes_ficha') return derivarClientesFicha()
    if (this._table === 'avance_metas') return derivarAvanceMetas()
    if (this._table === 'saldos_reserva') return derivarSaldos()
    if (this._table === 'cartera_por_organizacion') return derivarCartera()
    // Un reporte puede llevar una foto de la pantalla con la reserva de
    // alguien: no lo lee todo el equipo. Es la política de la 021, replicada
    // aquí para que la demo no muestre de más.
    if (this._table === 'tickets') {
      const rol = rolActual()
      if (['super_admin', 'gerencia', 'directora'].includes(rol)) return STORE.tickets
      return STORE.tickets.filter(t => t.reportado_por === MOCK_SESSION.user.id)
    }
    return STORE[this._table] || []
  }

  _applyFilters(rows) {
    return this._filters.reduce((acc, f) => acc.filter(f), rows)
  }

  _applyOrder(rows) {
    if (!this._ordenes.length) return rows
    return [...rows].sort((a, b) => {
      for (const { col, asc } of this._ordenes) {
        const av = a[col], bv = b[col]
        if (av == null && bv == null) continue
        if (av == null) return 1
        if (bv == null) return -1
        // Los booleanos se comparan como número: en PostgreSQL false < true,
        // así que `ascending: false` pone los `true` de primeros — que es
        // justo lo que pide una lista donde lo bloqueante va arriba.
        const x = typeof av === 'boolean' ? Number(av) : av
        const y = typeof bv === 'boolean' ? Number(bv) : bv
        const cmp = x < y ? -1 : x > y ? 1 : 0
        if (cmp !== 0) return asc ? cmp : -cmp
      }
      return 0
    })
  }

  _joinIfRegistros(rows) {
    // `reservas` es una vista sobre `registros`: lleva los mismos joins y el
    // mismo total calculado. Sin esto la vista devolvería filas a medias y
    // parecería que el enmascarado rompió la pantalla.
    if (this._table === 'registros' || this._table === 'reservas') return rows.map(joinRegistro)
    if (this._table === 'pasajeros') {
      return rows.map(p => ({
        ...p,
        paises: STORE.paises.find(x => x.id === p.pais_id) || null,
        opciones_plato: STORE.opciones_plato.find(o => o.id === p.opcion_plato_id) || null,
      }))
    }
    if (this._table === 'empleados' || this._table === 'zarpe_alojamiento') {
      return rows.map(e => ({
        ...e,
        paises: STORE.paises.find(x => x.id === e.pais_id) || null,
      }))
    }
    if (this._table === 'zarpe_empleados') {
      return rows.map(ze => ({
        ...ze,
        empleados: STORE.empleados.find(e => e.id === ze.empleado_id) || null,
      }))
    }
    if (this._table === 'zarpes') {
      return rows.map(z => ({
        ...z,
        lanchas: STORE.lanchas.find(l => l.id === z.lancha_id) || null,
        pilotos: STORE.pilotos.find(p => p.id === z.piloto_id) || null,
      }))
    }
    return rows
  }

  /** ON DELETE CASCADE de pasajeros: lo hace Postgres, aquí se imita. */
  _cascadeDelete(borrados) {
    if (this._table !== 'registros') return
    const ids = new Set(borrados.map(r => r.id))
    STORE.pasajeros = STORE.pasajeros.filter(p => !ids.has(p.registro_id))
  }

  /** Espeja al trigger marcar_cambio_tardio de 003_dia_operativo.sql. */
  _marcarSiEsTardio(fila, cambios) {
    if (this._table !== 'registros') return
    const dia = STORE.dias_operativos.find(d => d.fecha === fila.fecha)
    if (!dia || dia.estado === 'planeando') return

    const relevantes = ['adultos', 'ninos', 'infantes', 'cortesias', 'plan_id', 'lancha_id', 'fecha', 'nombre_grupo']
    const cambioRelevante =
      relevantes.some(c => c in cambios && cambios[c] !== fila[c]) ||
      (cambios.estado === 'cancelada' && fila.estado !== 'cancelada')

    if (cambioRelevante) {
      fila.cambio_tardio = true
      fila.cambio_tardio_at = new Date().toISOString()
      fila.cambio_tardio_por = MOCK_SESSION.user.id
    }
  }

  _run() {
    // Append-only, igual que los triggers de 006: los embarques no se
    // corrigen, se registra un evento nuevo.
    if (this._table === 'embarques' && (this._op === 'update' || this._op === 'delete')) {
      return { data: null, error: { message: 'Los embarques no se corrigen: se registra un evento nuevo' } }
    }

    if (this._op === 'insert') {
      const inserted = this._insertPayload.map(item => {
        // client_id único: reenviar la misma cola dos veces no duplica nada.
        if (this._table === 'embarques' && item.client_id) {
          const ya = STORE.embarques.find(e => e.client_id === item.client_id)
          if (ya) return ya
        }
        // Un id que venga en la fila manda, como en Postgres: la columna tiene
        // default, y un valor explícito gana. El muelle depende de eso —genera
        // el id del pasajero para poder embarcarlo en el mismo gesto, sin
        // esperar respuesta del servidor—, y un mock que lo reemplaza rompe
        // ese enlace sin que la base real lo rompa.
        const row = {
          ...item,
          id: item.id || genId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        // `upsert(..., { onConflict })`: si ya existe la fila con esas
        // columnas, se actualiza. Va antes que la comprobación del id porque
        // el conflicto que importa es el que declaró quien llamó.
        if (this._onConflict) {
          const choca = (STORE[this._table] || []).find(
            x => this._onConflict.every(c => String(x[c]) === String(item[c]))
          )
          if (choca) {
            Object.assign(choca, item, { updated_at: new Date().toISOString() })
            emitirCambio(this._table, 'UPDATE', choca)
            return choca
          }
        }

        // Y la clave primaria sigue siendo única. Reenviar la cola dos veces
        // devuelve la fila que ya estaba, igual que hace arriba con el
        // client_id de los embarques: no duplica y no falla.
        const repetido = (STORE[this._table] || []).find(x => x.id === row.id)
        if (repetido) return repetido

        // El trigger de la 020: quien trae documento se vuelve persona sin que
        // nadie tenga que acordarse de crearla.
        if (this._table === 'pasajeros') {
          row.persona_id = enlazarPersona(row) || row.persona_id || null
        }

        // El sello de la 024: quién, en toda tabla, puesto por el servidor.
        // Se ignora lo que mande el cliente — si el autor se pudiera mandar,
        // no sería una firma.
        if (!['bitacora', 'cambios_estado', 'embarques', 'firmas', 'tickets'].includes(this._table)) {
          row.creado_por = MOCK_SESSION.user.id
          row.actualizado_por = MOCK_SESSION.user.id
        }

        // Y el de la 030, con el nombre del negocio: quién repartió el turno.
        if (this._table === 'guardias') {
          row.asignada_por = MOCK_SESSION.user.id
          row.asignada_at = new Date().toISOString()
        }
        if (this._table === 'registros') {
          row.generada_por = MOCK_SESSION.user.id
          delete row.creado_por          // la reserva usa `generada_por`, no dos columnas
        }

        // El de la 021: quién reporta lo sella el servidor con la sesión, no
        // lo manda el aparato. Y el estado siempre nace en 'nuevo'.
        if (this._table === 'tickets') {
          const yo = STORE.perfiles.find(p => p.user_id === MOCK_SESSION.user.id)
          Object.assign(row, {
            reportado_por: MOCK_SESSION.user.id,
            reportado_por_nombre: yo?.nombre || 'alguien',
            rol: yo?.rol || null,
            estado: 'nuevo',
            respuesta: null,
            atendido_por: null,
            atendido_at: null,
          })
        }

        STORE[this._table].push(row)
        if (this._table === 'registros') {
          row.cambio_tardio = false
          diaDe(row.fecha)   // el día se abre solo, como en Postgres
        }
        emitirCambio(this._table, 'INSERT', row)
        return row
      })
      if (this._isSingle) {
        const row = this._table === 'registros' ? joinRegistro(inserted[0]) : inserted[0]
        return { data: row, error: null }
      }
      return { data: inserted, error: null }
    }

    if (this._op === 'update') {
      const rows = this._getRows()
      const matched = this._applyFilters(rows)
      matched.forEach(row => {
        const antes = { ...row }
        this._marcarSiEsTardio(row, this._updatePayload)
        Object.assign(row, this._updatePayload, { updated_at: new Date().toISOString() })

        // El sello de la 024, también al modificar: quién la tocó de último.
        // Se pone después del payload a propósito — pisa lo que mande el
        // cliente, igual que el trigger.
        if (!['bitacora', 'cambios_estado', 'embarques', 'firmas'].includes(this._table)) {
          row.actualizado_por = MOCK_SESSION.user.id
          if ('creado_por' in antes) row.creado_por = antes.creado_por   // el pasado no se reescribe
        }

        if (this._table === 'registros' && row.estado !== antes.estado) {
          anotarCambioEstado(row, antes.estado, row.estado, 'manual')
        }
        emitirCambio(this._table, 'UPDATE', row, antes)
      })
      if (this._isSingle) {
        const row = matched[0]
        const joined = this._table === 'registros' && row ? joinRegistro(row) : row
        return { data: joined || null, error: null }
      }
      return { data: matched, error: null }
    }

    if (this._op === 'delete') {
      const rows = this._getRows()
      const borrados = this._applyFilters(rows)
      const toDelete = new Set(borrados.map(r => r.id))
      STORE[this._table] = rows.filter(r => !toDelete.has(r.id))
      this._cascadeDelete(borrados)
      borrados.forEach(r => emitirCambio(this._table, 'DELETE', r))
      return { data: null, error: null }
    }

    // SELECT
    let rows = this._getRows()
    rows = this._applyFilters(rows)
    rows = this._applyOrder(rows)

    const total = rows.length

    if (this._rangeFrom !== null) {
      rows = rows.slice(this._rangeFrom, this._rangeTo + 1)
    }

    if (this._limit !== null) {
      rows = rows.slice(0, this._limit)
    }

    rows = this._joinIfRegistros(rows)

    if (this._isSingle) {
      const item = rows[0] || null
      return { data: item, error: null }
    }

    if (this._countMode) {
      return { data: rows, count: total, error: null }
    }

    return { data: rows, error: null }
  }
}

// ─── Mock auth ─────────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  user: {
    id: 'mock-user-demo',
    email: 'demo@daypass.co',
    user_metadata: { full_name: 'Usuario Demo' },
  },
}

/**
 * Cambiar de rol en la demo, para ver la app como la ve cada persona.
 * En la consola:  __daypass_rol('mesero')
 */
if (typeof window !== 'undefined') {
  window.__daypass_rol = rol => {
    const p = STORE.perfiles.find(x => x.user_id === MOCK_SESSION.user.id)
    if (!p) return
        p.rol = rol
        try { localStorage.setItem('daypass:demo-rol', rol) } catch { /* sin persistencia */ }
        location.reload()
  }
}

const mockAuth = {
  getSession: () => Promise.resolve({ data: { session: MOCK_SESSION }, error: null }),
  signInWithPassword: () => Promise.resolve({ data: { session: MOCK_SESSION }, error: null }),
  signOut: () => Promise.resolve({ error: null }),
  onAuthStateChange: (cb) => {
    setTimeout(() => cb('SIGNED_IN', MOCK_SESSION), 0)
    return { data: { subscription: { unsubscribe: () => {} } } }
  },
}

// ─── Export ────────────────────────────────────────────────────────────────────

/**
 * Los datos del demo, para las comprobaciones automáticas.
 *
 * Se exporta solo para poder vaciar una tabla y verificar qué quedó dentro
 * después de una operación. La app **no** lo usa: pasa por `createMockClient`
 * como si fuera Supabase, que es lo único que hace fiel a la demo.
 */
export const __store = STORE

export function createMockClient() {
  return {
    from: (table) => new QB(table),
    auth: mockAuth,
    rpc: (nombre, params = {}) => {
      const fn = RPC[nombre]
      if (!fn) return Promise.resolve({ data: null, error: { message: `Función ${nombre} no disponible en modo demo` } })
      return Promise.resolve(fn(params))
    },
    channel: (nombre, opciones) => new CanalMock(nombre, opciones),
    removeChannel: (canal) => canal?.unsubscribe?.() ?? Promise.resolve('ok'),
  }
}
