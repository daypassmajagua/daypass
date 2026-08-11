/**
 * Interpreta la lista que manda la agencia.
 *
 * La realidad: llegan pegadas desde Excel (tabulaciones), desde WhatsApp
 * (una por línea), desde un correo (con viñetas o numeradas), con o sin
 * documento, con o sin país, a veces con encabezado. Nada de eso se rechaza:
 * lo que no se entiende se marca para que la asesora lo corrija a mano.
 */

const TIPOS_DOC = {
  cc: ['cc', 'c.c', 'cedula', 'cédula', 'ti-cc'],
  ce: ['ce', 'c.e', 'extranjeria', 'extranjería'],
  pasaporte: ['pasaporte', 'pass', 'passport', 'ps', 'pa'],
  ti: ['ti', 't.i', 'tarjeta de identidad'],
  rc: ['rc', 'r.c', 'registro civil'],
}

// Palabras que delatan un encabezado de tabla, no una persona.
const ENCABEZADOS = [
  'nombre', 'nombres', 'apellido', 'apellidos', 'documento', 'cedula', 'cédula',
  'identificacion', 'identificación', 'pasajero', 'pasajeros', 'pais', 'país',
  'nacionalidad', 'tipo', 'edad', 'no.', 'item', 'ítem', 'total',
]

const MARCAS_CATEGORIA = [
  { categoria: 'infante', palabras: ['infante', 'bebe', 'bebé', 'lactante'] },
  { categoria: 'nino', palabras: ['nino', 'niño', 'nina', 'niña', 'menor', 'child', 'kid'] },
  { categoria: 'cortesia', palabras: ['cortesia', 'cortesía', 'guia', 'guía', 'free', 'invitado'] },
]

function sinTildes(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Un documento: sobre todo dígitos (con puntos/guiones) o un pasaporte alfanumérico. */
function pareceDocumento(txt) {
  const limpio = txt.replace(/[.\-\s]/g, '')
  if (limpio.length < 5 || limpio.length > 15) return false
  const digitos = (limpio.match(/\d/g) || []).length
  if (digitos === limpio.length) return true                    // 45789123
  return digitos >= 4 && /^[a-z0-9]+$/i.test(limpio)            // AB123456
}

/** Un nombre: letras y espacios, al menos una palabra de 2+ letras, sin exceso de dígitos. */
function pareceNombre(txt) {
  if (!txt || txt.length < 2) return false
  if ((txt.match(/\d/g) || []).length > 2) return false
  return /[a-záéíóúñü]{2,}/i.test(txt)
}

function detectarTipoDoc(txt) {
  const t = sinTildes(txt).replace(/[.\s]/g, '')
  for (const [tipo, alias] of Object.entries(TIPOS_DOC)) {
    if (alias.some(a => sinTildes(a).replace(/[.\s]/g, '') === t)) return tipo
  }
  return null
}

function detectarCategoria(linea) {
  const t = sinTildes(linea)
  for (const { categoria, palabras } of MARCAS_CATEGORIA) {
    if (palabras.some(p => new RegExp(`\\b${sinTildes(p)}\\b`).test(t))) return categoria
  }
  return null
}

/** "Tomás Martínez (niño)" → "Tomás Martínez". La marca ya se guardó en categoría. */
function quitarMarcaCategoria(nombre) {
  const todas = MARCAS_CATEGORIA.flatMap(m => m.palabras)
  let limpio = nombre
  for (const palabra of todas) {
    // Sin \b final: en JS una letra acentuada no es carácter de palabra, así
    // que "bebé" al final de línea nunca haría frontera. El ancla es el $.
    limpio = limpio.replace(
      new RegExp(`[\\s,;-]*[(\\[]?${palabra}[)\\]]?[\\s.,;]*$`, 'i'),
      ''
    )
  }
  return limpio.trim() || nombre.trim()
}

function esEncabezado(campos) {
  const texto = sinTildes(campos.join(' '))
  const aciertos = ENCABEZADOS.filter(h => texto.includes(sinTildes(h))).length
  return aciertos >= 2 || (campos.length === 1 && ENCABEZADOS.includes(sinTildes(campos[0])))
}

/** Parte una línea por el separador que realmente traiga. */
function partirCampos(linea) {
  if (linea.includes('\t')) return linea.split('\t')
  if (linea.includes(';')) return linea.split(';')
  if (linea.includes(',')) return linea.split(',')
  if (/\s{2,}/.test(linea)) return linea.split(/\s{2,}/)   // columnas pegadas de un PDF
  return [linea]
}

/**
 * Une campos contiguos que son puro nombre. Cubre dos casos reales a la vez:
 * un nombre partido por espacios de más ("Carolina  Martínez") y las columnas
 * separadas de Excel ("Nombres" | "Apellidos"). No toca países ni tipos de
 * documento, que también son puras letras.
 */
function unirFragmentosDeNombre(campos, esPais) {
  const salida = []
  for (const campo of campos) {
    const esFragmento = !/\d/.test(campo) && !esPais(campo) && !detectarTipoDoc(campo) && pareceNombre(campo)
    const previo = salida[salida.length - 1]
    if (esFragmento && previo && previo._fragmento) {
      previo.txt += ' ' + campo
    } else {
      salida.push({ txt: campo, _fragmento: esFragmento })
    }
  }
  return salida.map(c => c.txt)
}

/** Quita viñetas y numeración: "1.", "1)", "-", "•". */
function limpiarPrefijo(linea) {
  return linea.replace(/^\s*(\d{1,3}\s*[.)\-–]\s*|[-•*·]\s+)/, '')
}

/**
 * @param {string} texto  Lo que la asesora pegó.
 * @param {Array}  paises Catálogo [{ id, codigo, nombre }] para resolver origen.
 * @returns {Array} filas { nombre, tipo_documento, documento, pais_id, categoria,
 *                          restriccion_alimentaria, _dudosa, _original }
 *   `_dudosa: true` = se leyó algo pero no se entendió bien. No se descarta:
 *   se muestra marcada para que la corrija antes de confirmar.
 */
export function parsePasajeros(texto, paises = []) {
  if (!texto || !texto.trim()) return []

  const porNombre = new Map()
  paises.forEach(p => {
    porNombre.set(sinTildes(p.nombre), p.id)
    // El código solo si no es también una forma de escribir un documento.
    // Con los 249 de la 028 entró 'CC' —Islas Cocos— y una línea normal de
    // agencia, «Juan Pérez, CC, 45789123», habría salido con el pasajero
    // nacido en un atolón del Índico. El nombre completo sigue resolviendo.
    if (p.codigo && !detectarTipoDoc(p.codigo)) porNombre.set(sinTildes(p.codigo), p.id)
  })

  const filas = []

  texto.split(/\r?\n/).forEach(lineaCruda => {
    const linea = limpiarPrefijo(lineaCruda).trim()
    if (!linea) return

    const crudos = partirCampos(linea).map(c => c.trim()).filter(Boolean)
    if (!crudos.length) return
    if (esEncabezado(crudos)) return

    const campos = unirFragmentosDeNombre(crudos, c => porNombre.has(sinTildes(c)))

    const fila = {
      nombre: '',
      tipo_documento: null,
      documento: '',
      pais_id: null,
      categoria: detectarCategoria(linea) || 'adulto',
      restriccion_alimentaria: '',
      _dudosa: false,
      _original: linea,
    }

    const sobrantes = []

    campos.forEach(campo => {
      const paisId = porNombre.get(sinTildes(campo))
      if (paisId && !fila.pais_id) { fila.pais_id = paisId; return }

      const tipo = detectarTipoDoc(campo)
      if (tipo && !fila.tipo_documento) { fila.tipo_documento = tipo; return }

      // "CC 45789123" en un solo campo
      const conTipo = campo.match(/^([a-záéíóú.]+)\s+(.+)$/i)
      if (conTipo && !fila.documento) {
        const t = detectarTipoDoc(conTipo[1])
        if (t && pareceDocumento(conTipo[2])) {
          fila.tipo_documento = fila.tipo_documento || t
          fila.documento = conTipo[2].trim()
          return
        }
      }

      if (pareceDocumento(campo) && !fila.documento) { fila.documento = campo; return }
      if (pareceNombre(campo) && !fila.nombre) { fila.nombre = campo.replace(/\s+/g, ' '); return }

      sobrantes.push(campo)
    })

    // Lo que sobró y parece una nota alimentaria se conserva; el resto marca la fila.
    if (sobrantes.length) {
      const nota = sobrantes.join(' ')
      if (/sin |alergi|celiac|vegetarian|vegan|gluten|lactosa|diabet|no come/i.test(nota)) {
        fila.restriccion_alimentaria = nota
      } else if (!fila.nombre) {
        fila.nombre = nota
        fila._dudosa = true
      }
    }

    if (!fila.nombre) {
      fila.nombre = linea
      fila._dudosa = true
    }

    if (fila.categoria !== 'adulto') fila.nombre = quitarMarcaCategoria(fila.nombre)

    filas.push(fila)
  })

  return filas
}

/** Resumen para el contador siempre visible: "Plan: 40 · Con nombre: 38 · Faltan: 2". */
export function resumenPasajeros(registro, pasajeros = []) {
  const plan = (registro?.adultos || 0) + (registro?.ninos || 0) +
               (registro?.infantes || 0) + (registro?.cortesias || 0)
  const conNombre = pasajeros.length
  return { plan, conNombre, faltan: Math.max(0, plan - conNombre), sobran: Math.max(0, conNombre - plan) }
}
