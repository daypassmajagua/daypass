/**
 * Prueba de humo: cargar cada pantalla y escuchar la consola.
 *
 * Existe porque `npm run build` no ve los errores de ejecución. Ya atrapó tres
 * que habrían llegado a producción:
 *
 *   · un `const` leído antes de declararse en /cerrar — zona muerta temporal,
 *     ReferenceError, pantalla en blanco;
 *   · un icono de lucide usado sin importar en la barra — esbuild no revisa
 *     identificadores sueltos, así que compilaba y reventaba al pintar;
 *   · `openPrintWindow` llamado con un argumento en vez de dos, que abría el
 *     documento de cocina en blanco.
 *
 * Corre contra `npm run demo`, nunca contra producción: son datos de muestra
 * en memoria y ninguna de estas rutas escribe nada.
 *
 *   npm run humo                     # asume el demo en el 5175
 *   npm run humo -- http://localhost:5180
 */
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] || process.env.DAYPASS_URL || 'http://localhost:5175'

/**
 * Cada pantalla y lo que tiene que decir. El texto esperado no es decoración:
 * sin él, una pantalla que renderiza el cascarón vacío pasaría la prueba.
 */
const RUTAS = [
  ['/',          'Hoy',                 /Hoy|reserva/i],
  ['/dia',       'Listado del día',     /Listado del día/i],
  ['/cerrar',    'Cerrar el día',       /Cerrar|cocina/i],
  ['/nuevo',     'Nueva reserva',       /reserva/i],
  ['/embarque',  'Embarque',            /lancha/i],
  ['/isla',      'Isla',                /cuenta/i],
  ['/cocina',    'Almuerzos',           /Almuerzos/i],
  ['/usuarios',  'Usuarios',            /Quién entra/i],
  ['/reportes',  'Reportes',            /reporte/i],
  ['/cartera',   'Cartera',             /cobrar|Cartera/i],
  ['/r/tokenquenoexiste0000000000000000000000000000', 'Check-in público', /./],
]

/** Chrome, donde suela estar. */
function buscarChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidatos = process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe',
       'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return candidatos.find(p => {
    try { return require('node:fs').existsSync(p) } catch { return false }
  }) || candidatos[0]
}

async function vive(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) })
    return r.ok
  } catch { return false }
}

const esperar = ms => new Promise(r => setTimeout(r, ms))

let demo = null

/** Si el demo no está arriba, se levanta y se apaga al terminar. */
async function asegurarDemo() {
  if (await vive(BASE)) return false
  if (BASE !== 'http://localhost:5175') {
    console.error(`\nNo hay nada en ${BASE}. Levanta el servidor o pasa otra dirección.\n`)
    process.exit(2)
  }
  console.log('Levantando el demo…')
  demo = spawn('npm', ['run', 'demo'], { shell: true, stdio: 'ignore' })
  for (let i = 0; i < 40; i++) {
    await esperar(500)
    if (await vive(BASE)) return true
  }
  console.error('\nEl demo no respondió en 20 segundos.\n')
  process.exit(2)
}

const propio = await asegurarDemo()

const navegador = await puppeteer.launch({
  executablePath: buscarChrome(),
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1440,900'],
})

let fallas = 0

for (const [ruta, nombre, esperado] of RUTAS) {
  const pagina = await navegador.newPage()
  await pagina.setViewport({ width: 1440, height: 900 })
  const problemas = []

  pagina.on('console', m => {
    if (m.type() !== 'error') return
    // Un 401 o 404 de red no es un fallo de la pantalla.
    if (/Failed to load resource/.test(m.text())) return
    problemas.push(m.text())
  })
  pagina.on('pageerror', e => problemas.push(`pageerror: ${e.message}`))

  await pagina.goto(BASE + ruta, { waitUntil: 'networkidle2', timeout: 30000 })
    .catch(e => problemas.push(`no cargó: ${e.message}`))
  await esperar(1200)

  const texto = await pagina.evaluate(() => document.body.innerText.trim())
  if (texto.length < 20) problemas.push(`pantalla en blanco (${texto.length} caracteres)`)
  else if (!esperado.test(texto)) problemas.push(`no dice lo que debería (${esperado})`)

  if (problemas.length) {
    fallas++
    console.log(`\n  FALLA  ${nombre}  ${ruta}`)
    problemas.slice(0, 4).forEach(p => console.log(`         ${p.slice(0, 200)}`))
  } else {
    console.log(`  ok     ${nombre}`)
  }
  await pagina.close()
}

await navegador.close()
if (propio && demo) demo.kill()

console.log(`\n${RUTAS.length - fallas} de ${RUTAS.length} pantallas cargan limpias\n`)
process.exit(fallas ? 1 : 0)
