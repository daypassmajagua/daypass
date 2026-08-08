import { formatDate, FORMA_PAGO_LABELS, IMPUESTOS_LABELS } from './utils.js'
import { calcularConteoCocina } from './conteoCocina.js'
import { ETIQUETA_DOCUMENTO as ETIQUETA_DOC } from './manifiesto.js'

// ─── Estilos base compartidos ──────────────────────────────────────────────────
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #111827; background: white;
    font-size: 12px; line-height: 1.5;
  }
  .page { padding: 28px 32px; max-width: 820px; margin: 0 auto; }

  /* ── Header ── */
  .doc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 14px; border-bottom: 3px solid #1e2045; margin-bottom: 20px;
  }
  .hotel-name { font-size: 17px; font-weight: 800; color: #1e2045; }
  .hotel-sub  { font-size: 10.5px; color: #6b7280; margin-top: 2px; }
  .hotel-wave { font-size: 22px; margin-right: 6px; }
  .doc-title  { font-size: 20px; font-weight: 900; color: #1e2045; text-align: right; letter-spacing: -0.5px; }
  .doc-date   { font-size: 11.5px; color: #374151; text-align: right; margin-top: 3px; }
  .doc-stamp  { font-size: 10px; color: #9ca3af; text-align: right; margin-top: 2px; }

  /* ── Summary box ── */
  .summary {
    background: #f4f5fa; border: 1px solid #cdd1e6;
    border-radius: 10px; padding: 14px 22px;
    display: flex; gap: 0; margin-bottom: 20px;
  }
  .stat { flex: 1; text-align: center; padding: 0 16px; }
  .stat + .stat { border-left: 1px solid #cdd1e6; }
  .stat-value { font-size: 26px; font-weight: 900; color: #1e2045; display: block; line-height: 1.1; }
  .stat-label { font-size: 9.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 3px; display: block; }

  /* ── Section ── */
  .section-title {
    font-size: 10px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 1.2px; color: #1e2045;
    border-bottom: 1.5px solid #e8eaf4;
    padding-bottom: 5px; margin-bottom: 10px; margin-top: 20px;
  }

  /* ── Lancha header ── */
  .lancha-header {
    background: #1e2045; color: white;
    padding: 7px 14px; border-radius: 6px 6px 0 0;
    font-weight: 700; font-size: 12.5px;
    margin-top: 18px; display: flex; justify-content: space-between; align-items: center;
  }
  .lancha-pax { font-size: 11px; font-weight: 400; opacity: 0.85; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th {
    background: #1e2045; color: white;
    padding: 7px 10px; text-align: left;
    font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  }
  th:last-child { text-align: center; }
  td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  tr:nth-child(even) td { background: #f9fafb; }
  tr:last-child td { border-bottom: none; }
  .table-wrap { border: 1px solid #e5e7eb; border-radius: 0 0 6px 6px; overflow: hidden; }

  /* ── Tags ── */
  .tag {
    display: inline-block; padding: 1px 7px; border-radius: 4px;
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px;
    vertical-align: middle; margin-right: 3px;
  }
  .tag-grp  { background: #ede9fe; color: #5b21b6; }
  .tag-ind  { background: #e8eaf4; color: #1e2045; }
  .tag-si   { background: #d1fae5; color: #065f46; }
  .tag-no   { background: #fee2e2; color: #991b1b; }
  .tag-exe  { background: #f3f4f6; color: #4b5563; }

  /* ── Folio blank ── */
  .folio-blank {
    display: inline-block; min-width: 90px; border-bottom: 1.5px solid #374151;
    color: #374151; font-family: monospace; font-size: 11px;
    text-align: center; padding: 0 4px;
  }
  .folio-filled {
    font-family: monospace; font-size: 11.5px; font-weight: 700;
    color: #065f46; background: #d1fae5; padding: 2px 8px; border-radius: 4px;
  }

  /* ── Registro row (tentativo) ── */
  .reg { padding: 7px 0; border-bottom: 1px dashed #e5e7eb; }
  .reg:last-child { border-bottom: none; }
  .reg-name   { font-weight: 700; color: #111827; font-size: 12px; }
  .reg-sub    { color: #6b7280; font-size: 10.5px; margin-top: 1px; }
  .reg-detail { color: #374151; font-size: 11px; margin-top: 2px; }

  /* ── Warning ── */
  .warning-box {
    background: #fffbeb; border: 1.5px solid #fcd34d;
    border-radius: 8px; padding: 12px 16px; margin-top: 20px;
  }
  .warning-title { color: #92400e; font-weight: 800; font-size: 12px; margin-bottom: 8px; }
  .warning-row { color: #78350f; font-size: 11.5px; padding: 2px 0; }

  /* ── Canal table ── */
  .canal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 4px; }
  .canal-item {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
    padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;
  }
  .canal-name { color: #374151; font-size: 11px; }
  .canal-pax  { font-weight: 800; color: #1e2045; font-size: 14px; }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 28px; padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-left  { font-size: 9.5px; color: #9ca3af; }
  .footer-right { font-size: 9.5px; color: #9ca3af; text-align: right; }
  .footer-brand { font-weight: 700; color: #1e2045; }

  /* ── Print ── */
  @media print {
    body { font-size: 11px; }
    .no-print { display: none !important; }
    .page { padding: 16px 20px; }
    .lancha-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .summary { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`

function esc(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function impTag(imp) {
  if (imp === 'si')  return `<span class="tag tag-si">SÍ</span>`
  if (imp === 'no')  return `<span class="tag tag-no">NO ⚠</span>`
  if (imp === 'exe') return `<span class="tag tag-exe">EXE</span>`
  return ''
}

function now() {
  return new Date().toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Abre ventana de impresión ─────────────────────────────────────────────────
export function openPrintWindow(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=860,height=1050,scrollbars=yes')
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para esta página y vuelve a intentarlo.')
    return false
  }
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  ${bodyHtml}
  <script>
    window.onload = function() { setTimeout(function() { window.print() }, 350) }
  <\/script>
</body>
</html>`)
  win.document.close()
  return true
}

// ─── Tentativo ─────────────────────────────────────────────────────────────────
export function buildTentativoHTML(registros, fecha) {
  const activos    = registros.filter(r => !['cancelada', 'noshow'].includes(r.estado))
  const confirmados = registros.filter(r => ['confirmada', 'en_isla', 'completada'].includes(r.estado))
  const tentativas  = registros.filter(r => r.estado === 'tentativa')
  const grupos      = activos.filter(r => r.tipo === 'grupo')
  const individuales = activos.filter(r => r.tipo === 'individual')

  const totalPax      = activos.reduce((s, r) => s + r.adultos + r.ninos, 0)
  const totalAdultos  = activos.reduce((s, r) => s + r.adultos, 0)
  const totalNinos    = activos.reduce((s, r) => s + r.ninos, 0)
  const totalCortesias = activos.reduce((s, r) => s + r.cortesias, 0)
  const totalInfantes = activos.reduce((s, r) => s + r.infantes, 0)
  const totalTentPax  = tentativas.reduce((s, r) => s + r.adultos + r.ninos, 0)

  // Canal breakdown
  const canalMap = {}
  activos.forEach(r => {
    const key = r.canales?.nombre || 'Otro'
    if (!canalMap[key]) canalMap[key] = 0
    canalMap[key] += r.adultos + r.ninos
  })
  const canalItems = Object.entries(canalMap)
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, pax]) => `
      <div class="canal-item">
        <span class="canal-name">${esc(nombre)}</span>
        <span class="canal-pax">${pax} pax</span>
      </div>`)
    .join('')

  // Agrupar por lancha
  const lanchaMap = {}
  activos.forEach(r => {
    const key = r.lanchas?.nombre || 'Sin lancha'
    if (!lanchaMap[key]) lanchaMap[key] = { grupos: [], individuales: [] }
    if (r.tipo === 'grupo') lanchaMap[key].grupos.push(r)
    else lanchaMap[key].individuales.push(r)
  })

  const lanchaSections = Object.entries(lanchaMap).map(([nombre, regs]) => {
    const pax = [...regs.grupos, ...regs.individuales].reduce((s, r) => s + r.adultos + r.ninos, 0)

    const grupoRows = regs.grupos.map(r => `
      <div class="reg">
        <div class="reg-name">
          <span class="tag tag-grp">GRUPO</span> ${esc(r.nombre_pasajero)}
          ${r.nombre_grupo ? `· <em>${esc(r.nombre_grupo)}</em>` : ''}
        </div>
        <div class="reg-detail">
          ${r.agencia_nombre ? `<strong>${esc(r.agencia_nombre)}</strong> ·` : ''}
          ${r.adultos} adultos${r.ninos > 0 ? ` + ${r.ninos} niños` : ''}${r.cortesias > 0 ? ` + ${r.cortesias} cortesías` : ''} ·
          ${esc(r.planes?.nombre || '')} ·
          ${impTag(r.impuestos_puerto)}
          ${r.forma_pago ? `<span style="color:#6b7280">· ${esc(FORMA_PAGO_LABELS[r.forma_pago] || '')}</span>` : ''}
        </div>
        ${r.voucher_os ? `<div class="reg-sub">Voucher / OS: <strong>${esc(r.voucher_os)}</strong></div>` : ''}
        ${r.observaciones ? `<div class="reg-sub">Obs: ${esc(r.observaciones)}</div>` : ''}
      </div>`).join('')

    const indRows = regs.individuales.map(r => `
      <div class="reg">
        <div class="reg-name">
          <span class="tag tag-ind">IND</span> ${esc(r.nombre_pasajero)}
        </div>
        <div class="reg-detail">
          ${r.adultos} adultos${r.ninos > 0 ? ` + ${r.ninos} niños` : ''}${r.cortesias > 0 ? ` + ${r.cortesias} cortesías` : ''} ·
          ${esc(r.planes?.nombre || '')} ·
          ${r.agencia_nombre ? esc(r.agencia_nombre) + ' ·' : ''}
          ${impTag(r.impuestos_puerto)}
          ${r.forma_pago ? `<span style="color:#6b7280">· ${esc(FORMA_PAGO_LABELS[r.forma_pago] || '')}</span>` : ''}
        </div>
        ${r.observaciones ? `<div class="reg-sub">Obs: ${esc(r.observaciones)}</div>` : ''}
      </div>`).join('')

    return `
      <div class="lancha-header">
        <span>${esc(nombre)}</span>
        <span class="lancha-pax">${pax} personas</span>
      </div>
      <div style="padding: 8px 12px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
        ${grupoRows}${indRows}
      </div>`
  }).join('')

  const tentativasSection = tentativas.length > 0 ? `
    <div class="warning-box">
      <div class="warning-title">⚠ TENTATIVAS — ${totalTentPax} personas sin confirmar</div>
      ${tentativas.map(r => `
        <div class="warning-row">
          · ${esc(r.nombre_pasajero)}${r.nombre_grupo ? ` (${esc(r.nombre_grupo)})` : ''} —
          ${r.adultos + r.ninos} pax — ${esc(r.planes?.nombre || '')} — ${esc(r.lanchas?.nombre || '')}
        </div>`).join('')}
    </div>` : ''

  return `
<div class="page">
  <div class="doc-header">
    <div>
      <div class="hotel-name"><span class="hotel-wave">ðŸŒŠ</span> Hotel San Pedro de Majagua</div>
      <div class="hotel-sub">Islas del Rosario · Cartagena de Indias, Colombia</div>
    </div>
    <div>
      <div class="doc-title">TENTATIVO DAYPASS</div>
      <div class="doc-date">${formatDate(fecha)}</div>
      <div class="doc-stamp">Generado: ${now()}</div>
    </div>
  </div>

  <div class="summary">
    <div class="stat">
      <span class="stat-value">${totalPax}</span>
      <span class="stat-label">Total personas</span>
    </div>
    <div class="stat">
      <span class="stat-value">${totalAdultos}</span>
      <span class="stat-label">Adultos</span>
    </div>
    <div class="stat">
      <span class="stat-value">${totalNinos}</span>
      <span class="stat-label">Niños</span>
    </div>
    <div class="stat">
      <span class="stat-value">${totalCortesias}</span>
      <span class="stat-label">Cortesías</span>
    </div>
    <div class="stat">
      <span class="stat-value">${totalInfantes}</span>
      <span class="stat-label">Infantes</span>
    </div>
    ${tentativas.length > 0 ? `
    <div class="stat" style="background: #fffbeb; border-radius: 6px;">
      <span class="stat-value" style="color: #d97706;">${totalTentPax}</span>
      <span class="stat-label" style="color: #92400e;">Tentativas</span>
    </div>` : ''}
  </div>

  <div class="section-title">Distribución por canal</div>
  <div class="canal-grid">${canalItems}</div>

  <div class="section-title">Detalle por lancha y pasajero</div>
  ${lanchaSections}

  ${tentativasSection}

  <div class="doc-footer">
    <div class="footer-left">
      ${activos.length} registros activos · ${grupos.length} grupos · ${individuales.length} individuales
    </div>
    <div class="footer-right">
      <span class="footer-brand">DayPASS</span> · Hotel San Pedro de Majagua
    </div>
  </div>
</div>`
}

// ─── Listado para Folios ───────────────────────────────────────────────────────
export function buildFoliosHTML(registros, fecha) {
  const activos = registros.filter(r => !['cancelada', 'noshow'].includes(r.estado))

  const lanchaMap = {}
  activos.forEach(r => {
    const key = r.lanchas?.nombre || 'Sin lancha'
    if (!lanchaMap[key]) lanchaMap[key] = []
    lanchaMap[key].push(r)
  })

  const totalPax = activos.reduce((s, r) => s + r.adultos + r.ninos, 0)

  const lanchaSections = Object.entries(lanchaMap).map(([nombre, regs]) => {
    const pax = regs.reduce((s, r) => s + r.adultos + r.ninos, 0)

    const rows = regs.map((r, i) => {
      const paxStr = `${r.adultos}A${r.ninos > 0 ? ` ${r.ninos}N` : ''}${r.infantes > 0 ? ` ${r.infantes}I` : ''}`
      const folio = r.folio_zeus
        ? `<span class="folio-filled">${esc(r.folio_zeus)}</span>`
        : `<span class="folio-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>`

      return `
        <tr>
          <td style="text-align:center; font-weight:700; color:#6b7280; width:36px;">${i + 1}</td>
          <td>
            <div style="font-weight:700; font-size:11.5px;">
              ${r.tipo === 'grupo' ? `<span class="tag tag-grp">GRP</span>` : ''}
              ${esc(r.nombre_pasajero)}
            </div>
            ${r.nombre_grupo ? `<div style="font-size:10px; color:#6b7280;">${esc(r.nombre_grupo)}</div>` : ''}
            ${r.agencia_nombre ? `<div style="font-size:10px; color:#6b7280;">${esc(r.agencia_nombre)}</div>` : ''}
          </td>
          <td style="font-size:11px; color:#374151;">${esc(r.planes?.nombre || '—')}</td>
          <td style="text-align:center; font-weight:700; width:50px;">${paxStr}</td>
          <td style="text-align:center; width:46px;">${impTag(r.impuestos_puerto)}</td>
          <td style="width:48px; font-size:10.5px; color:#6b7280; text-align:center;">
            ${r.forma_pago ? esc(FORMA_PAGO_LABELS[r.forma_pago] || '') : '<span style="color:#f59e0b;">—</span>'}
          </td>
          <td style="text-align:center; width:120px; padding: 6px 8px;">${folio}</td>
        </tr>`
    }).join('')

    return `
      <div class="lancha-header">
        <span>${esc(nombre)}</span>
        <span class="lancha-pax">${pax} personas · ${regs.length} registro(s)</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:36px;">#</th>
              <th>Pasajero / Grupo</th>
              <th>Plan</th>
              <th style="text-align:center; width:50px;">Pax</th>
              <th style="text-align:center; width:46px;">Imp.</th>
              <th style="text-align:center; width:70px;">Pago</th>
              <th style="text-align:center; width:120px;">Folio Zeus</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  const sinFolio = activos.filter(r => !r.folio_zeus).length
  const impuestoNo = activos.filter(r => r.impuestos_puerto === 'no')

  return `
<div class="page">
  <div class="doc-header">
    <div>
      <div class="hotel-name"><span class="hotel-wave">ðŸŒŠ</span> Hotel San Pedro de Majagua</div>
      <div class="hotel-sub">Islas del Rosario · Cartagena de Indias, Colombia</div>
    </div>
    <div>
      <div class="doc-title">LISTADO PARA FOLIOS ZEUS</div>
      <div class="doc-date">${formatDate(fecha)}</div>
      <div class="doc-stamp">Impreso: ${now()}</div>
    </div>
  </div>

  <div class="summary">
    <div class="stat">
      <span class="stat-value">${totalPax}</span>
      <span class="stat-label">Total personas</span>
    </div>
    <div class="stat">
      <span class="stat-value">${activos.length}</span>
      <span class="stat-label">Registros</span>
    </div>
    <div class="stat">
      <span class="stat-value">${Object.keys(lanchaMap).length}</span>
      <span class="stat-label">Lanchas</span>
    </div>
    <div class="stat" style="${sinFolio > 0 ? 'background:#fffbeb;' : 'background:#ecfdf5;'} border-radius:6px;">
      <span class="stat-value" style="color:${sinFolio > 0 ? '#d97706' : '#059669'};">${sinFolio}</span>
      <span class="stat-label" style="color:${sinFolio > 0 ? '#92400e' : '#065f46'};">Sin folio</span>
    </div>
  </div>

  ${impuestoNo.length > 0 ? `
    <div class="warning-box" style="margin-bottom: 16px;">
      <div class="warning-title">⚠ IMPUESTOS DE PUERTO PENDIENTES — cobrar en muelle</div>
      ${impuestoNo.map(r => `
        <div class="warning-row">· ${esc(r.nombre_pasajero)} — ${r.adultos + r.ninos} pax — ${esc(r.lanchas?.nombre || '')}</div>
      `).join('')}
    </div>` : ''}

  ${lanchaSections}

  <div class="doc-footer">
    <div class="footer-left">
      ${activos.length} registros · ${totalPax} personas en ${Object.keys(lanchaMap).length} lanchas
    </div>
    <div class="footer-right">
      <span class="footer-brand">DayPASS</span> · Hotel San Pedro de Majagua
    </div>
  </div>
</div>`
}

// ─── Conteo de cocina (D-1) ────────────────────────────────────────────────────
/**
 * Lo que cocina necesita saber la noche anterior: cuántos platos de cada tipo
 * y qué restricciones alimentarias vienen. Se imprime en impresoras viejas,
 * así que la jerarquía no depende del color.
 *
 * El cálculo vive en conteoCocina.js, compartido con la pantalla del cierre:
 * si estuviera en dos sitios, tarde o temprano dirían cosas distintas.
 *
 * @param registros      Reservas del día, con planes(nombre) resuelto.
 * @param pasajeros      Pasajeros nominales del día, con plato y restricción.
 * @param opcionesPlato  Catálogo de opciones, para saber qué planes preguntan.
 */
export function buildCocinaHTML(registros, pasajeros, opcionesPlato, fecha, edadMaxInfante = 3) {
  const {
    filasPlato, filasMenuFijo, sinElegir, infantes, restricciones,
    totalAdultos, totalNinos, totalCortesias, totalInfantes, totalAlmuerzos,
  } = calcularConteoCocina(registros, pasajeros, opcionesPlato)

  return `
<div class="page">
  <div class="doc-header">
    <div>
      <div class="hotel-name">Hotel San Pedro de Majagua</div>
      <div class="hotel-sub">Islas del Rosario · Cartagena</div>
    </div>
    <div>
      <div class="doc-title">CONTEO DE COCINA</div>
      <div class="doc-date">${esc(formatDate(fecha))}</div>
      <div class="doc-stamp">Generado ${now()}</div>
    </div>
  </div>

  <div class="summary">
    <div class="stat"><span class="stat-value">${totalAlmuerzos}</span><span class="stat-label">Almuerzos</span></div>
    <div class="stat"><span class="stat-value">${totalAdultos}</span><span class="stat-label">Adultos</span></div>
    <div class="stat"><span class="stat-value">${totalNinos}</span><span class="stat-label">Niños</span></div>
    <div class="stat"><span class="stat-value">${totalCortesias}</span><span class="stat-label">Cortesías</span></div>
    <div class="stat"><span class="stat-value">${totalInfantes}</span><span class="stat-label">Infantes</span></div>
  </div>

  <div class="section-title">Qué se cocina</div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Plato</th>
          <th>Plan</th>
          <th style="text-align:center">Cantidad</th>
        </tr>
      </thead>
      <tbody>
        ${filasPlato.map(f => `
        <tr>
          <td style="font-weight:700; font-size:13px">${esc(f.nombre)}</td>
          <td style="font-size:10.5px; color:#6b7280">${esc(f.plan)}</td>
          <td style="text-align:center; font-weight:800; font-size:15px">${f.cantidad}</td>
        </tr>`).join('')}

        ${filasMenuFijo.map(f => `
        <tr>
          <td style="font-weight:700; font-size:13px">Menú fijo</td>
          <td style="font-size:10.5px; color:#6b7280">${esc(f.plan)} — sin opciones</td>
          <td style="text-align:center; font-weight:800; font-size:15px">${f.cantidad}</td>
        </tr>`).join('')}

        ${sinElegir > 0 ? `
        <tr>
          <td style="font-weight:700; font-size:13px">Sin plato elegido</td>
          <td style="font-size:10.5px; color:#6b7280">confirmar con la oficina antes de servir</td>
          <td style="text-align:center; font-weight:800; font-size:15px">${sinElegir}</td>
        </tr>` : ''}

        ${infantes > 0 ? `
        <tr>
          <td style="font-weight:700; font-size:13px">Infantes</td>
          <td style="font-size:10.5px; color:#6b7280">menores de ${edadMaxInfante} años — comen, pero no eligen plato</td>
          <td style="text-align:center; font-weight:800; font-size:15px">${infantes}</td>
        </tr>` : ''}

        <tr>
          <td colspan="2" style="font-weight:800; border-top:2px solid #1e2045">TOTAL DE ALMUERZOS</td>
          <td style="text-align:center; font-weight:800; font-size:15px; border-top:2px solid #1e2045">${totalAlmuerzos}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p style="font-size:10.5px; color:#6b7280; margin-top:6px">
    ${totalAdultos} adultos · ${totalNinos} niños · ${totalCortesias} cortesías${totalInfantes > 0 ? ` · ${totalInfantes} ${totalInfantes === 1 ? 'infante' : 'infantes'}` : ''}.
    Las cortesías comen. Los infantes menores de ${edadMaxInfante} años también:
    cuentan como porción aunque no elijan plato del menú.
  </p>

  ${restricciones.length ? `
  <div class="warning-box">
    <div class="warning-title">RESTRICCIONES ALIMENTARIAS — ${restricciones.length} ${restricciones.length === 1 ? 'persona' : 'personas'}</div>
    ${restricciones.map(r => `
      <div class="warning-row">
        <strong>${esc(r.nota.toUpperCase())}</strong> · ${esc(r.nombre)}${r.grupo ? ` (${esc(r.grupo)})` : ''}${r.plato ? ` · pidió ${esc(r.plato)}` : ''}${r.lancha ? ` · ${esc(r.lancha)}` : ''}
      </div>`).join('')}
  </div>` : `
  <div class="section-title">Restricciones alimentarias</div>
  <p style="font-size:11.5px; color:#374151">
    Ninguna reportada. Ojo: solo aparecen las de pasajeros con nombre cargado.
  </p>`}

  <div class="doc-footer">
    <div class="footer-left">Conteo del día anterior · confirmar cambios de última hora con la oficina</div>
    <div class="footer-right"><span class="footer-brand">DayPASS</span> · Hotel San Pedro de Majagua</div>
  </div>
</div>`
}

// ─── Tentativo en texto plano ──────────────────────────────────────────────────
/**
 * El mismo tentativo, pero para pegar en WhatsApp.
 *
 * Es lo único que la pantalla /tentativo hacía y que no existía en otro lado;
 * vive aquí porque el sitio natural para compartir el día es el cierre.
 */
export function buildTentativoTexto(registros, fecha) {
  const activos = registros.filter(r => !['cancelada', 'noshow'].includes(r.estado))
  const tentativas = registros.filter(r => r.estado === 'tentativa')

  const totalAdultos = activos.reduce((s, r) => s + r.adultos, 0)
  const totalNinos = activos.reduce((s, r) => s + r.ninos, 0)
  const totalCortesias = activos.reduce((s, r) => s + r.cortesias, 0)
  const totalPax = activos.reduce((s, r) => s + r.adultos + r.ninos, 0)

  const porLancha = {}
  activos.forEach(r => {
    const nombre = r.lanchas?.nombre || 'Sin lancha'
    if (!porLancha[nombre]) porLancha[nombre] = []
    porLancha[nombre].push(r)
  })

  let texto = `TENTATIVO — ${formatDate(fecha)}\n`
  texto += `${'─'.repeat(42)}\n\n`
  texto += `Total: ${totalPax} personas\n`
  texto += `${totalAdultos} adultos · ${totalNinos} niños`
  if (totalCortesias > 0) texto += ` · ${totalCortesias} cortesías`
  texto += '\n\n'

  Object.entries(porLancha).forEach(([lancha, regs]) => {
    const pax = regs.reduce((s, r) => s + r.adultos + r.ninos, 0)
    texto += `${lancha.toUpperCase()} — ${pax} pax\n`
    regs.forEach(r => {
      const quien = r.nombre_grupo || r.agencia_nombre || r.nombre_pasajero
      texto += `  · ${quien} — ${r.adultos + r.ninos} pax`
      if (r.planes?.nombre) texto += ` — ${r.planes.nombre}`
      texto += '\n'
    })
    texto += '\n'
  })

  if (tentativas.length > 0) {
    const tPax = tentativas.reduce((s, r) => s + r.adultos + r.ninos, 0)
    texto += `SIN CONFIRMAR: ${tPax} personas\n`
    tentativas.forEach(r => {
      texto += `  · ${r.nombre_grupo || r.nombre_pasajero} — ${r.adultos + r.ninos} pax\n`
    })
  }

  return texto.trim()
}

// ─── Manifiesto de Capitanía ───────────────────────────────────────────────────
/**
 * La lista nominal de quién va a bordo, para la Capitanía de Puerto.
 *
 * Es el único documento de aquí que sale del hotel hacia una autoridad, así que
 * se escribe distinto que los demás: sin emoji, sin colores que dependan de la
 * impresora, con casilla de firma, y con el número de personas repetido en el
 * pie para que no haya duda de cuántas se declararon.
 *
 * El armado de las filas vive en manifiesto.js, compartido con la pantalla del
 * muelle. Aquí solo se dibuja.
 */
export function buildManifiestoHTML(zarpe, manifiesto, fecha, lancha) {
  const { filas, total, pasajeros, alojados, tripulacion, sinNombre, sinDocumento } = manifiesto

  const hora = zarpe?.hora_real_salida
    ? new Date(zarpe.hora_real_salida).toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit',
      })
    : (zarpe?.hora_programada || '').slice(0, 5)

  const GRUPO = {
    pasajero: 'Pasajero',
    alojamiento: 'Alojamiento',
    tripulacion: 'Tripulación',
  }

  const fila = (f, i) => {
    // Una plaza que subió sin nombre se declara como lo que es. Esconderla
    // sería declarar menos gente de la que va a bordo.
    const nombre = f.sinNombre
      ? `<span style="color:#92400e; font-style:italic;">Sin nombre — ${esc(f.reserva || 'reserva')} (${f.posicion})</span>`
      : esc(f.nombre)

    const doc = f.documento
      ? `${esc(ETIQUETA_DOC[f.tipo_documento] || '')} ${esc(f.documento)}`.trim()
      : `<span class="folio-blank"></span>`

    return `
      <tr>
        <td style="text-align:center; color:#6b7280; width:34px;">${i + 1}</td>
        <td style="font-weight:${f.sinNombre ? '400' : '700'};">${nombre}</td>
        <td style="width:150px; font-family:monospace; font-size:11px;">${doc}</td>
        <td style="width:110px;">${esc(f.pais || '')}</td>
        <td style="width:96px; font-size:10.5px; color:#374151;">
          ${f.cargo ? esc(f.cargo) : GRUPO[f.grupo]}
        </td>
      </tr>`
  }

  const seccion = (grupo, titulo) => {
    const suyas = filas.filter(f => f.grupo === grupo)
    if (!suyas.length) return ''
    return `
      <div class="section-title">${titulo} — ${suyas.length}</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:34px;">#</th>
              <th>Nombre completo</th>
              <th style="width:150px;">Identificación</th>
              <th style="width:110px;">País</th>
              <th style="width:96px;">Calidad</th>
            </tr>
          </thead>
          <tbody>${suyas.map(fila).join('')}</tbody>
        </table>
      </div>`
  }

  const pendientes = []
  // El piloto de primero: sin él el documento no lo recibe nadie, mientras que
  // un pasajero sin documento se completa en la ventanilla.
  if (!manifiesto.piloto) pendientes.push('SIN PILOTO ASIGNADO')
  if (sinNombre > 0) pendientes.push(`${sinNombre} sin nombre`)
  if (sinDocumento > 0) pendientes.push(`${sinDocumento} sin identificación`)

  return `
<div class="page">
  <div class="doc-header">
    <div>
      <div class="hotel-name">Hotel San Pedro de Majagua</div>
      <div class="hotel-sub">Islas del Rosario &middot; Cartagena de Indias, Colombia</div>
    </div>
    <div>
      <div class="doc-title">MANIFIESTO DE PASAJEROS</div>
      <div class="doc-date">${formatDate(fecha)}${hora ? ` &middot; ${esc(hora)}` : ''}</div>
      <div class="doc-stamp">Impreso: ${now()}</div>
    </div>
  </div>

  <div class="summary">
    <div class="stat">
      <span class="stat-value">${total}</span>
      <span class="stat-label">Total a bordo</span>
    </div>
    <div class="stat">
      <span class="stat-value">${pasajeros}</span>
      <span class="stat-label">Pasajeros</span>
    </div>
    <div class="stat">
      <span class="stat-value">${alojados}</span>
      <span class="stat-label">Alojamiento</span>
    </div>
    <div class="stat">
      <span class="stat-value">${tripulacion}</span>
      <span class="stat-label">Tripulación</span>
    </div>
  </div>

  <div class="canal-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom:18px;">
    <div class="canal-item">
      <span class="canal-name">Embarcación</span>
      <span style="font-weight:700; color:#1e2045;">${esc(lancha?.nombre || '')}</span>
    </div>
    <div class="canal-item">
      <span class="canal-name">Sentido</span>
      <span style="font-weight:700; color:#1e2045;">
        ${zarpe?.sentido === 'regreso' ? 'Regreso a La Bodeguita' : 'Ida a Islas del Rosario'}
      </span>
    </div>
  </div>

  ${pendientes.length ? `
    <div class="warning-box" style="margin-top:0; margin-bottom:16px;">
      <div class="warning-title">REVISAR ANTES DE ENTREGAR</div>
      <div class="warning-row">
        ${pendientes.join(' &middot; ')}. Las personas van a bordo y se declaran igual;
        completar los datos en el muelle si la autoridad lo exige.
      </div>
    </div>` : ''}

  ${seccion('pasajero', 'Pasajeros')}
  ${seccion('alojamiento', 'Huéspedes de alojamiento')}
  ${seccion('tripulacion', 'Tripulación')}

  <div style="margin-top:34px; display:flex; gap:40px;">
    <div style="flex:1;">
      <div style="border-top:1px solid #374151; padding-top:5px; font-size:10.5px; color:#374151;">
        Piloto${manifiesto.piloto ? ` — ${esc(manifiesto.piloto.nombre)}` : ''}
      </div>
    </div>
    <div style="flex:1;">
      <div style="border-top:1px solid #374151; padding-top:5px; font-size:10.5px; color:#374151;">
        Capitanía de Puerto
      </div>
    </div>
  </div>

  <div class="doc-footer">
    <div class="footer-left">
      Se declaran ${total} personas a bordo &middot; ${esc(lancha?.nombre || '')} &middot; ${formatDate(fecha)}
    </div>
    <div class="footer-right">
      <span class="footer-brand">DayPASS</span> &middot; Hotel San Pedro de Majagua
    </div>
  </div>
</div>`
}
