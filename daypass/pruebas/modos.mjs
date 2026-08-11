import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

/**
 * El modo del aparato mueve píxeles.
 *
 * La prueba estática de `modo.test.js` cuida que no vuelvan los tamaños en
 * píxeles; esta cuida lo otro: que el cambio de modo **se vea**. Mide la raíz
 * y una fila real en las dos pantallas de afuera, en los tres modos.
 *
 *   npm run modos                    # asume el demo en el 5175
 *   npm run modos -- http://otro     # o contra otra dirección
 */

const BASE = process.argv[2] || process.env.DAYPASS_URL || 'http://localhost:5175'

/** Lo que cada modo tiene que producir en la raíz. De `lib/modo.js`. */
const ESPERADO = { oficina: 16, muelle: 18, isla: 20 }

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
if (!await vive(BASE)) {
  if (BASE !== 'http://localhost:5175') {
    console.error(`\nNo hay nada en ${BASE}.\n`)
    process.exit(2)
  }
  console.log('Levantando el demo…')
  demo = spawn('npm', ['run', 'demo'], { shell: true, stdio: 'ignore' })
  let arriba = false
  for (let i = 0; i < 40 && !arriba; i++) { await esperar(500); arriba = await vive(BASE) }
  if (!arriba) { console.error('\nEl demo no respondió.\n'); process.exit(2) }
}

const navegador = await puppeteer.launch({
  executablePath: buscarChrome(),
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1180,820'],
})

let fallos = 0
const medidas = {}

for (const modo of Object.keys(ESPERADO)) {
  const pagina = await navegador.newPage()
  await pagina.setViewport({ width: 1180, height: 820 })   // iPad en horizontal

  await pagina.goto(BASE, { waitUntil: 'networkidle2' })
  await pagina.evaluate(m => localStorage.setItem('daypass:modo', m), modo)

  await pagina.goto(`${BASE}/isla`, { waitUntil: 'networkidle2' })
  await esperar(1200)

  const m = await pagina.evaluate(() => ({
    raiz: parseFloat(getComputedStyle(document.documentElement).fontSize),
    marca: document.documentElement.dataset.modo,
    fila: document.querySelector('li')?.getBoundingClientRect().height ?? 0,
    // Que nada se salga: en el iPad no hay dónde arrastrar de lado.
    desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }))
  medidas[modo] = m
  await pagina.close()

  const bien = m.raiz === ESPERADO[modo] && m.marca === modo && !m.desborde && m.fila > 0
  if (!bien) fallos += 1
  console.log(
    `  ${bien ? 'ok  ' : 'FALLA'}  ${modo.padEnd(8)} raíz ${m.raiz}px · fila ${Math.round(m.fila)}px` +
    (m.desborde ? ' · SE DESBORDA' : '')
  )
}

// Y que de verdad crezcan, no solo que la raíz cambie.
if (!(medidas.oficina.fila < medidas.muelle.fila && medidas.muelle.fila < medidas.isla.fila)) {
  console.log('  FALLA  las filas no crecen con el modo')
  fallos += 1
}

await navegador.close()
if (demo) demo.kill()

console.log(fallos === 0
  ? '\nEl modo del aparato mueve píxeles en los tres.\n'
  : `\n${fallos} comprobaciones fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
