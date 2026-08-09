/**
 * Cada rol ve lo suyo, y solo lo suyo.
 *
 * Esto no prueba la seguridad —eso lo hacen las políticas de RLS de la
 * migración 015, en la base—. Prueba lo otro, que también importa: que cada
 * persona abra la app y encuentre su trabajo, sin un menú lleno de cosas que
 * no puede tocar.
 *
 * Corre contra `npm run demo`, donde el rol se puede cambiar:
 *
 *     npm run roles
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] || process.env.DAYPASS_URL || 'http://localhost:5175'

/**
 * Lo que debe ver cada rol. Es la traducción de `src/lib/navegacion.js` a lo
 * que se espera en pantalla: si alguien cambia el archivo sin querer, esto lo
 * dice.
 *
 * `dinero` es la promesa central de la fase: la isla, recepción y el mesero no
 * ven precios. No es solo permisos — esa pantalla la ven el pasajero, el guía
 * y la fila entera.
 */
const ESPERADO = {
  directora: {
    inicio: '/',
    menu: ['Hoy', 'Nueva reserva', 'El día', 'Embarque', 'Isla', 'Almuerzos',
           'Folios', 'Lanchas y equipo', 'Historial', 'Informes', 'Usuarios',
           'Configuración'],
    dinero: true,
  },
  asesora: {
    inicio: '/',
    menu: ['Hoy', 'Nueva reserva', 'El día', 'Embarque', 'Isla', 'Almuerzos',
           'Folios', 'Lanchas y equipo', 'Historial', 'Informes'],
    dinero: true,
  },
  asesora_comercial: {
    inicio: '/',
    menu: ['Hoy', 'Nueva reserva', 'El día', 'Embarque', 'Historial'],
    dinero: true,
  },
  gerencia: {
    inicio: '/informes',
    menu: ['Informes', 'Historial', 'El día', 'Usuarios'],
    dinero: true,
  },
  admin_isla: { inicio: '/isla', menu: ['Isla', 'Almuerzos', 'El día'], dinero: false },
  recepcion:  { inicio: '/isla', menu: ['Isla', 'El día'],              dinero: false },
  // El mesero tiene una sola pantalla, así que NO ve barra: un botón que
  // lleva a donde ya estás es ruido. Que su menú venga vacío es lo correcto.
  mesero:     { inicio: '/isla', menu: [],                              dinero: false },
}

function buscarChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidatos = process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe',
       'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return candidatos.find(p => existsSync(p)) || candidatos[0]
}

const esperar = ms => new Promise(r => setTimeout(r, ms))

async function vive(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(2500) })).ok }
  catch { return false }
}

let demo = null
if (!await vive(BASE)) {
  if (BASE !== 'http://localhost:5175') {
    console.error(`\nNo hay nada en ${BASE}.\n`); process.exit(2)
  }
  console.log('Levantando el demo…')
  demo = spawn('npm', ['run', 'demo'], { shell: true, stdio: 'ignore' })
  let listo = false
  for (let i = 0; i < 40 && !listo; i++) { await esperar(500); listo = await vive(BASE) }
  if (!listo) { console.error('\nEl demo no respondió.\n'); process.exit(2) }
}

const navegador = await puppeteer.launch({
  executablePath: buscarChrome(),
  headless: 'new',
  // Ancho de sobra: el menú completo solo se despliega desde 1536px, y por
  // debajo se esconde en el cajón táctil.
  args: ['--no-sandbox', '--window-size=1700,1000'],
})

let fallas = 0

for (const [rol, esp] of Object.entries(ESPERADO)) {
  const p = await navegador.newPage()
  await p.setViewport({ width: 1700, height: 1000 })
  const errores = []
  p.on('pageerror', e => errores.push(e.message))
  p.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text())
  })

  // El rol se siembra antes de que arranque la app: el mock lo lee de ahí.
  await p.evaluateOnNewDocument(r => {
    try { localStorage.setItem('daypass:demo-rol', r) } catch { /* modo privado */ }
  }, rol)

  await p.goto(BASE + '/', { waitUntil: 'networkidle2' })
  await esperar(1800)

  const visto = await p.evaluate(() => ({
    ruta: location.pathname,
    // La barra de oficina o la navegación mínima de la isla, según dónde caiga.
    menu: [...document.querySelectorAll('header nav a')].map(a => a.textContent.trim()),
  }))

  // El dinero se mira donde de verdad se muestra. Para quien no puede abrir el
  // listado, se mira en su propio inicio.
  const donde = esp.menu.includes('El día') ? '/dia' : esp.inicio
  await p.goto(BASE + donde, { waitUntil: 'networkidle2' })
  await esperar(1600)
  const veDinero = await p.evaluate(() => /\$\s?\d[\d.,]{3,}/.test(document.body.innerText))

  // La pantalla que reparte los roles se escribe a mano en la barra de
  // direcciones tan fácil como cualquier otra. Quien no la tiene en el menú
  // tampoco debe quedarse en ella: rebota a su inicio.
  let coladoEnUsuarios = false
  if (!esp.menu.includes('Usuarios')) {
    await p.goto(BASE + '/usuarios', { waitUntil: 'networkidle2' })
    await esperar(1400)
    coladoEnUsuarios = await p.evaluate(() => location.pathname === '/usuarios')
  }

  const sobra = visto.menu.filter(m => !esp.menu.includes(m))
  const falta = esp.menu.filter(m => !visto.menu.includes(m))
  const bien = visto.ruta === esp.inicio && !sobra.length && !falta.length
    && veDinero === esp.dinero && !coladoEnUsuarios && !errores.length

  if (!bien) fallas++
  console.log(
    `${bien ? '  ok  ' : 'FALLA '} ${rol.padEnd(18)} → ${visto.ruta.padEnd(10)} ` +
    `${String(visto.menu.length).padStart(2)} secciones · ${veDinero ? 've $' : 'sin $'}`
  )
  if (visto.ruta !== esp.inicio) console.log(`         esperaba caer en ${esp.inicio}`)
  if (sobra.length) console.log(`         sobra en el menú: ${sobra.join(', ')}`)
  if (falta.length) console.log(`         falta en el menú: ${falta.join(', ')}`)
  if (veDinero !== esp.dinero) {
    console.log(`         DINERO en ${donde}: ve=${veDinero}, debería=${esp.dinero}`)
  }
  if (coladoEnUsuarios) console.log('         se quedó en /usuarios y no debería')
  errores.slice(0, 2).forEach(e => console.log(`         ${e.slice(0, 130)}`))

  await p.close()
}

await navegador.close()
if (demo) demo.kill()

const total = Object.keys(ESPERADO).length
console.log(`\n${total - fallas} de ${total} roles ven lo que les toca\n`)
process.exit(fallas ? 1 : 0)
