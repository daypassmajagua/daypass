import { todayISO } from './utils'

// ─── Catálogos ────────────────────────────────────────────────────────────────

const LANCHAS = [
  { id: 'l-maj1', codigo: 'MAJ1', nombre: 'Majagua 1', capacidad: 40, activa: true },
  { id: 'l-maj2', codigo: 'MAJ2', nombre: 'Majagua 2', capacidad: 40, activa: true },
  { id: 'l-cat1', codigo: 'CAT1', nombre: 'Catalina 1', capacidad: 30, activa: true },
  { id: 'l-cat2', codigo: 'CAT2', nombre: 'Catalina 2', capacidad: 30, activa: true },
  { id: 'l-cat3', codigo: 'CAT3', nombre: 'Catalina 3', capacidad: 30, activa: true },
  { id: 'l-cat4', codigo: 'CAT4', nombre: 'Catalina 4', capacidad: 30, activa: true },
  { id: 'l-pop',  codigo: 'POP',  nombre: 'Popeye',     capacidad: 20, activa: true },
  { id: 'l-arc',  codigo: 'ARC',  nombre: 'Arco',       capacidad: 20, activa: true },
  { id: 'l-otr',  codigo: 'OTR',  nombre: 'Otra',       capacidad: null, activa: true },
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

const PAISES = [
  { id: 'pa-col', codigo: 'COL',   nombre: 'Colombia' },
  { id: 'pa-usa', codigo: 'USA',   nombre: 'Estados Unidos' },
  { id: 'pa-mex', codigo: 'MEX',   nombre: 'México' },
  { id: 'pa-esp', codigo: 'ESP',   nombre: 'España' },
  { id: 'pa-arg', codigo: 'ARG',   nombre: 'Argentina' },
  { id: 'pa-bra', codigo: 'BRA',   nombre: 'Brasil' },
  { id: 'pa-can', codigo: 'CAN',   nombre: 'Canadá' },
  { id: 'pa-chi', codigo: 'CHI',   nombre: 'Chile' },
  { id: 'pa-ecu', codigo: 'ECU',   nombre: 'Ecuador' },
  { id: 'pa-ita', codigo: 'ITA',   nombre: 'Italia' },
  { id: 'pa-ing', codigo: 'ING',   nombre: 'Inglaterra' },
  { id: 'pa-fra', codigo: 'FRA',   nombre: 'Francia' },
  { id: 'pa-ale', codigo: 'ALE',   nombre: 'Alemania' },
  { id: 'pa-otr', codigo: 'OTR',   nombre: 'Otro' },
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

const AGENCIAS = [
  { id: 'ag-1', nombre: 'Aviatur',          contacto: 'María Ríos',     email: 'mrios@aviatur.com',      activa: true },
  { id: 'ag-2', nombre: 'Despegar',         contacto: 'Juan Mora',      email: 'jmora@despegar.com',     activa: true },
  { id: 'ag-3', nombre: 'Decameron Travel', contacto: 'Claudia Pineda', email: 'cpineda@decameron.com',  activa: true },
  { id: 'ag-4', nombre: 'Copa Airlines',    contacto: 'Luis Arango',    email: 'larango@copaair.com',    activa: true },
  { id: 'ag-5', nombre: 'Viajes Éxito',     contacto: 'Patricia Mora',  email: 'pmora@viajesexito.com',  activa: true },
  { id: 'ag-6', nombre: 'Hotelbeds',        contacto: 'Steve Carter',   email: 'scarter@hotelbeds.com',  activa: true },
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
    total_calculado: calcTotal(r),
    lanchas:  STORE.lanchas.find(l => l.id === r.lancha_id) || null,
    planes:   STORE.planes.find(p => p.id === r.plan_id)   || null,
    canales:  STORE.canales.find(c => c.id === r.canal_id) || null,
    paises:   STORE.paises.find(p => p.id === r.pais_id)   || null,
    agencias: r.agencia_id ? STORE.agencias.find(a => a.id === r.agencia_id) : null,
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
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
  const hoy = todayISO()
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
  agencias:   [...AGENCIAS],
  clientes:   [],
  registros:  buildRegistros(),
}

// ─── Query Builder ─────────────────────────────────────────────────────────────

class QB {
  constructor(tableName) {
    this._table = tableName
    this._op = 'select'
    this._filters = []
    this._orderField = null
    this._orderAsc = true
    this._rangeFrom = null
    this._rangeTo = null
    this._isSingle = false
    this._countMode = false
    this._insertPayload = null
    this._updatePayload = null
    this._selectCalled = false
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

  ilike(col, pattern) {
    const clean = pattern.replace(/%/g, '.*')
    const re = new RegExp(clean, 'i')
    this._filters.push(r => re.test(r[col] || ''))
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

  order(col, opts = {}) {
    this._orderField = col
    this._orderAsc = opts.ascending !== false
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

  then(resolve, reject) {
    return Promise.resolve(this._run()).then(resolve, reject)
  }

  _getRows() {
    return STORE[this._table] || []
  }

  _applyFilters(rows) {
    return this._filters.reduce((acc, f) => acc.filter(f), rows)
  }

  _applyOrder(rows) {
    if (!this._orderField) return rows
    return [...rows].sort((a, b) => {
      const av = a[this._orderField], bv = b[this._orderField]
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return this._orderAsc ? cmp : -cmp
    })
  }

  _joinIfRegistros(rows) {
    if (this._table !== 'registros') return rows
    return rows.map(joinRegistro)
  }

  _run() {
    if (this._op === 'insert') {
      const inserted = this._insertPayload.map(item => {
        const row = {
          ...item,
          id: genId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        STORE[this._table].push(row)
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
        Object.assign(row, this._updatePayload, { updated_at: new Date().toISOString() })
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
      const toDelete = new Set(this._applyFilters(rows).map(r => r.id))
      STORE[this._table] = rows.filter(r => !toDelete.has(r.id))
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

export function createMockClient() {
  return {
    from: (table) => new QB(table),
    auth: mockAuth,
  }
}
