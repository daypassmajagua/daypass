import { formatDate, FORMA_PAGO_LABELS, IMPUESTOS_LABELS } from './utils'

// â”€â”€â”€ Estilos base compartidos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #111827; background: white;
    font-size: 12px; line-height: 1.5;
  }
  .page { padding: 28px 32px; max-width: 820px; margin: 0 auto; }

  /* â”€â”€ Header â”€â”€ */
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

  /* â”€â”€ Summary box â”€â”€ */
  .summary {
    background: #f4f5fa; border: 1px solid #cdd1e6;
    border-radius: 10px; padding: 14px 22px;
    display: flex; gap: 0; margin-bottom: 20px;
  }
  .stat { flex: 1; text-align: center; padding: 0 16px; }
  .stat + .stat { border-left: 1px solid #cdd1e6; }
  .stat-value { font-size: 26px; font-weight: 900; color: #1e2045; display: block; line-height: 1.1; }
  .stat-label { font-size: 9.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 3px; display: block; }

  /* â”€â”€ Section â”€â”€ */
  .section-title {
    font-size: 10px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 1.2px; color: #1e2045;
    border-bottom: 1.5px solid #e8eaf4;
    padding-bottom: 5px; margin-bottom: 10px; margin-top: 20px;
  }

  /* â”€â”€ Lancha header â”€â”€ */
  .lancha-header {
    background: #1e2045; color: white;
    padding: 7px 14px; border-radius: 6px 6px 0 0;
    font-weight: 700; font-size: 12.5px;
    margin-top: 18px; display: flex; justify-content: space-between; align-items: center;
  }
  .lancha-pax { font-size: 11px; font-weight: 400; opacity: 0.85; }

  /* â”€â”€ Tables â”€â”€ */
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

  /* â”€â”€ Tags â”€â”€ */
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

  /* â”€â”€ Folio blank â”€â”€ */
  .folio-blank {
    display: inline-block; min-width: 90px; border-bottom: 1.5px solid #374151;
    color: #374151; font-family: monospace; font-size: 11px;
    text-align: center; padding: 0 4px;
  }
  .folio-filled {
    font-family: monospace; font-size: 11.5px; font-weight: 700;
    color: #065f46; background: #d1fae5; padding: 2px 8px; border-radius: 4px;
  }

  /* â”€â”€ Registro row (tentativo) â”€â”€ */
  .reg { padding: 7px 0; border-bottom: 1px dashed #e5e7eb; }
  .reg:last-child { border-bottom: none; }
  .reg-name   { font-weight: 700; color: #111827; font-size: 12px; }
  .reg-sub    { color: #6b7280; font-size: 10.5px; margin-top: 1px; }
  .reg-detail { color: #374151; font-size: 11px; margin-top: 2px; }

  /* â”€â”€ Warning â”€â”€ */
  .warning-box {
    background: #fffbeb; border: 1.5px solid #fcd34d;
    border-radius: 8px; padding: 12px 16px; margin-top: 20px;
  }
  .warning-title { color: #92400e; font-weight: 800; font-size: 12px; margin-bottom: 8px; }
  .warning-row { color: #78350f; font-size: 11.5px; padding: 2px 0; }

  /* â”€â”€ Canal table â”€â”€ */
  .canal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 4px; }
  .canal-item {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
    padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;
  }
  .canal-name { color: #374151; font-size: 11px; }
  .canal-pax  { font-weight: 800; color: #1e2045; font-size: 14px; }

  /* â”€â”€ Footer â”€â”€ */
  .doc-footer {
    margin-top: 28px; padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-left  { font-size: 9.5px; color: #9ca3af; }
  .footer-right { font-size: 9.5px; color: #9ca3af; text-align: right; }
  .footer-brand { font-weight: 700; color: #1e2045; }

  /* â”€â”€ Print â”€â”€ */
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
  if (imp === 'si')  return `<span class="tag tag-si">SÃ</span>`
  if (imp === 'no')  return `<span class="tag tag-no">NO âš </span>`
  if (imp === 'exe') return `<span class="tag tag-exe">EXE</span>`
  return ''
}

function now() {
  return new Date().toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// â”€â”€â”€ Abre ventana de impresiÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function openPrintWindow(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=860,height=1050,scrollbars=yes')
  if (!win) {
    alert('El navegador bloqueÃ³ la ventana emergente. Por favor, permite ventanas emergentes para esta pÃ¡gina y vuelve a intentarlo.')
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

// â”€â”€â”€ Tentativo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          ${r.nombre_grupo ? `Â· <em>${esc(r.nombre_grupo)}</em>` : ''}
        </div>
        <div class="reg-detail">
          ${r.agencia_nombre ? `<strong>${esc(r.agencia_nombre)}</strong> Â·` : ''}
          ${r.adultos} adultos${r.ninos > 0 ? ` + ${r.ninos} niÃ±os` : ''}${r.cortesias > 0 ? ` + ${r.cortesias} cortesÃ­as` : ''} Â·
          ${esc(r.planes?.nombre || '')} Â·
          ${impTag(r.impuestos_puerto)}
          ${r.forma_pago ? `<span style="color:#6b7280">Â· ${esc(FORMA_PAGO_LABELS[r.forma_pago] || '')}</span>` : ''}
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
          ${r.adultos} adultos${r.ninos > 0 ? ` + ${r.ninos} niÃ±os` : ''}${r.cortesias > 0 ? ` + ${r.cortesias} cortesÃ­as` : ''} Â·
          ${esc(r.planes?.nombre || '')} Â·
          ${r.agencia_nombre ? esc(r.agencia_nombre) + ' Â·' : ''}
          ${impTag(r.impuestos_puerto)}
          ${r.forma_pago ? `<span style="color:#6b7280">Â· ${esc(FORMA_PAGO_LABELS[r.forma_pago] || '')}</span>` : ''}
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
      <div class="warning-title">âš ï¸ TENTATIVAS â€” ${totalTentPax} personas sin confirmar</div>
      ${tentativas.map(r => `
        <div class="warning-row">
          Â· ${esc(r.nombre_pasajero)}${r.nombre_grupo ? ` (${esc(r.nombre_grupo)})` : ''} â€”
          ${r.adultos + r.ninos} pax â€” ${esc(r.planes?.nombre || '')} â€” ${esc(r.lanchas?.nombre || '')}
        </div>`).join('')}
    </div>` : ''

  return `
<div class="page">
  <div class="doc-header">
    <div>
      <div class="hotel-name"><span class="hotel-wave">ðŸŒŠ</span> Hotel San Pedro de Majagua</div>
      <div class="hotel-sub">Islas del Rosario Â· Cartagena de Indias, Colombia</div>
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
      <span class="stat-label">NiÃ±os</span>
    </div>
    <div class="stat">
      <span class="stat-value">${totalCortesias}</span>
      <span class="stat-label">CortesÃ­as</span>
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

  <div class="section-title">DistribuciÃ³n por canal</div>
  <div class="canal-grid">${canalItems}</div>

  <div class="section-title">Detalle por lancha y pasajero</div>
  ${lanchaSections}

  ${tentativasSection}

  <div class="doc-footer">
    <div class="footer-left">
      ${activos.length} registros activos Â· ${grupos.length} grupos Â· ${individuales.length} individuales
    </div>
    <div class="footer-right">
      <span class="footer-brand">DayPASS</span> Â· Hotel San Pedro de Majagua
    </div>
  </div>
</div>`
}

// â”€â”€â”€ Listado para Folios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          <td style="font-size:11px; color:#374151;">${esc(r.planes?.nombre || 'â€”')}</td>
          <td style="text-align:center; font-weight:700; width:50px;">${paxStr}</td>
          <td style="text-align:center; width:46px;">${impTag(r.impuestos_puerto)}</td>
          <td style="width:48px; font-size:10.5px; color:#6b7280; text-align:center;">
            ${r.forma_pago ? esc(FORMA_PAGO_LABELS[r.forma_pago] || '') : '<span style="color:#f59e0b;">â€”</span>'}
          </td>
          <td style="text-align:center; width:120px; padding: 6px 8px;">${folio}</td>
        </tr>`
    }).join('')

    return `
      <div class="lancha-header">
        <span>${esc(nombre)}</span>
        <span class="lancha-pax">${pax} personas Â· ${regs.length} registro(s)</span>
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
      <div class="hotel-sub">Islas del Rosario Â· Cartagena de Indias, Colombia</div>
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
      <div class="warning-title">âš ï¸ IMPUESTOS DE PUERTO PENDIENTES â€” cobrar en muelle</div>
      ${impuestoNo.map(r => `
        <div class="warning-row">Â· ${esc(r.nombre_pasajero)} â€” ${r.adultos + r.ninos} pax â€” ${esc(r.lanchas?.nombre || '')}</div>
      `).join('')}
    </div>` : ''}

  ${lanchaSections}

  <div class="doc-footer">
    <div class="footer-left">
      ${activos.length} registros Â· ${totalPax} personas en ${Object.keys(lanchaMap).length} lanchas
    </div>
    <div class="footer-right">
      <span class="footer-brand">DayPASS</span> Â· Hotel San Pedro de Majagua
    </div>
  </div>
</div>`
}
