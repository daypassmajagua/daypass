/**
 * Qué ve cada rol, en un solo archivo.
 *
 * De aquí salen tres cosas que antes estaban sueltas y podían contradecirse:
 * el menú de la barra, a dónde cae cada persona al entrar, y qué rutas la
 * dejan pasar. Con siete roles, tres listas separadas se desincronizan en la
 * primera semana.
 *
 * ── El menú lista sustantivos del negocio ───────────────────────────────────
 *
 * Llegó a tener **dieciséis entradas** porque cada pantalla nueva agregaba la
 * suya, y porque mezclaba sustantivos del negocio —Folios, Cartera— con
 * funciones del software —Usuarios, Reportes, Configuración— al mismo nivel.
 *
 * Ahora son **siete sustantivos y un engranaje**. El engranaje va aparte, no
 * como octava entrada: no es otro destino, es otra clase de sitio. Lo diario
 * arriba; lo ocasional, adentro.
 *
 * El criterio para repartir: **lo que se toca todos los días está a un toque;
 * lo que se toca cada mes está a dos.** Configuración y Nueva reserva pesaban
 * igual, y una se usa cuarenta veces al día y la otra cuatro veces al año.
 *
 * ── Y una salvedad que manda sobre la ubicación ─────────────────────────────
 *
 * Lanchas, pilotos y empleados viven en Configuración porque se tocan de vez
 * en cuando, **no porque sean de otro**. Son de la coordinadora del pasadía,
 * con acceso pleno y sin pedirle permiso a nadie (regla 21, y la migración 019
 * ya lo hace cumplir en la base). Estar guardado no es estar restringido: por
 * eso en su Configuración esas secciones van de primeras.
 *
 * ⚠ Esto **no es seguridad**. Es lo que se muestra. Lo que de verdad protege
 * son las políticas de RLS — si alguien escribe la ruta a mano, la base le
 * responde vacío igual.
 */

/** Toda ruta de la app, con su etiqueta y su icono. */
export const RUTAS = {
  '/':          { etiqueta: 'Hoy',              icono: 'LayoutDashboard' },
  '/reservas':  { etiqueta: 'Reservas',         icono: 'List' },
  '/embarque':  { etiqueta: 'Embarque',         icono: 'Anchor' },
  '/isla':      { etiqueta: 'Isla',             icono: 'Palmtree' },
  '/folios':    { etiqueta: 'Folios',           icono: 'ClipboardList' },
  '/cartera':   { etiqueta: 'Cartera',          icono: 'Wallet' },
  '/informes':  { etiqueta: 'Informes',         icono: 'BarChart2' },
  '/config':    { etiqueta: 'Configuración',    icono: 'Settings' },

  // Destinos que existen pero no son del menú: se llega a ellos desde su
  // sustantivo, desde el buscador o desde una acción.
  '/nuevo':     { etiqueta: 'Nueva reserva',    icono: 'PlusCircle', oculta: true },
  '/editar':    { etiqueta: 'Editar reserva',   icono: null,         oculta: true },
  '/cerrar':    { etiqueta: 'Cerrar el día',    icono: 'Lock',       oculta: true },
  '/historial': { etiqueta: 'Historial',        icono: 'History',    oculta: true },
  '/cocina':    { etiqueta: 'Almuerzos',        icono: 'ChefHat',    oculta: true },
  '/clientes':  { etiqueta: 'Clientes',         icono: 'Users',      oculta: true },
  '/metas':     { etiqueta: 'Metas',            icono: 'Target',     oculta: true },
  '/reportes':  { etiqueta: 'Reportes',         icono: 'LifeBuoy',   oculta: true },
  '/equipo':    { etiqueta: 'Lanchas y equipo', icono: 'Ship',       oculta: true },
  '/usuarios':  { etiqueta: 'Usuarios',         icono: 'UserCog',    oculta: true },
}

/**
 * Las secciones de Configuración, en el orden en que se muestran.
 *
 * `ruta` es a dónde lleva; `porque` es la línea que explica para qué sirve,
 * porque una lista de diez nombres sin contexto se lee tan mal como un menú
 * de dieciséis.
 */
export const SECCIONES_CONFIG = {
  equipo: {
    etiqueta: 'Lanchas, pilotos y empleados',
    porque: 'Quiénes navegan y quiénes van a bordo. Se desactivan, nunca se borran.',
    ruta: '/equipo',
    icono: 'Ship',
  },
  // Va de segundas, justo detrás del equipo: es la sección que se toca cada
  // semana, no cada temporada. Y sin ella la Fase 6 no arranca — las
  // notificaciones se enrutan al turno, no a la persona.
  turnos: {
    etiqueta: 'Turnos y guardias',
    porque: 'Quién está en el muelle y en la isla cada día. El turno habilita, el rol no cambia.',
    ruta: '/config/turnos',
    icono: 'CalendarDays',
  },
  agencias: {
    etiqueta: 'Agencias y organizaciones',
    porque: 'Con quién trata el hotel: agencias, operadores, aliados e instituciones.',
    ruta: '/config/agencias',
    icono: 'Building2',
  },
  planes: {
    etiqueta: 'Planes, platos y tarifas',
    porque: 'Lo que se vende y a qué precio. El precio se congela al crear la reserva.',
    ruta: '/config/planes',
    icono: 'Tag',
  },
  temporadas: {
    etiqueta: 'Temporadas',
    porque: 'Qué fechas son de temporada alta.',
    ruta: '/config/temporadas',
    icono: 'CalendarDays',
  },
  mensajes: {
    etiqueta: 'Destinatarios y mensajes',
    porque: 'Lo que el cliente recibe por WhatsApp y a dónde salen los correos del hotel.',
    ruta: '/config/mensajes',
    icono: 'Mail',
  },
  operacion: {
    etiqueta: 'Ajustes de la operación',
    porque: 'Hora de zarpe, cierre de cocina, modo del aparato, canales y países.',
    ruta: '/config/operacion',
    icono: 'Settings',
  },
  usuarios: {
    etiqueta: 'Usuarios',
    porque: 'Quién entra y qué ve cada quien.',
    ruta: '/usuarios',
    icono: 'UserCog',
  },
  actividad: {
    etiqueta: 'Actividad',
    porque: 'Quién cambió qué y cuándo. Consultar no deja rastro; cambiar una tarifa, sí.',
    ruta: '/config/actividad',
    icono: 'History',
  },
  // Solo super_admin: es herramienta de quien mantiene el sistema, no de quien
  // lo usa. A Daniela una página de muestrarios solo le ocuparía sitio.
  estilo: {
    etiqueta: 'El sistema',
    porque: 'Los tokens, los primitivos y los patrones. Antes de inventar algo, mirar si ya está.',
    ruta: '/estilo',
    icono: 'Palette',
  },
  reportes: {
    etiqueta: 'Reportes al sistema',
    porque: 'Lo que el equipo reporta cuando algo no sirve.',
    ruta: '/reportes',
    icono: 'LifeBuoy',
  },
}

/**
 * Por rol: dónde cae al entrar, qué ve en el menú, qué rutas puede abrir y
 * qué secciones de Configuración le tocan.
 *
 * `menu` es el orden del menú: primero lo que más usa.
 * `ver` incluye el menú **más** los destinos ocultos a los que sí puede entrar.
 */
export const POR_ROL = {
  // AISA, el proveedor. Ve todo porque mantiene el sistema — y por eso mismo
  // queda auditado como todos los demás.
  super_admin: {
    home: '/',
    menu: ['/', '/reservas', '/embarque', '/isla', '/folios', '/cartera', '/informes'],
    config: ['equipo', 'turnos', 'agencias', 'planes', 'temporadas', 'mensajes', 'operacion', 'usuarios', 'actividad', 'estilo', 'reportes'],
    extra: ['/nuevo', '/editar', '/cerrar', '/historial', '/cocina', '/clientes', '/metas'],
  },

  directora: {
    home: '/',
    menu: ['/', '/reservas', '/embarque', '/isla', '/folios', '/cartera', '/informes'],
    config: ['equipo', 'turnos', 'agencias', 'planes', 'temporadas', 'mensajes', 'operacion', 'usuarios', 'actividad', 'reportes'],
    extra: ['/nuevo', '/editar', '/cerrar', '/historial', '/cocina', '/clientes', '/metas'],
  },

  // Daniela. Es quien más usa la app y quien tiene el día completo.
  // Lanchas, pilotos y empleados de primeras: son suyos (regla 21).
  asesora: {
    home: '/',
    menu: ['/', '/reservas', '/embarque', '/isla', '/folios', '/cartera', '/informes'],
    // Los mensajes son suyos: es ella quien los manda sesenta veces al mes.
    // Actividad porque la 024 le abrió la bitácora: cierra días y mueve
    // inventario, y no poder ver su propio rastro es un candado sin puerta.
    config: ['equipo', 'turnos', 'agencias', 'mensajes', 'operacion', 'actividad', 'reportes'],
    extra: ['/nuevo', '/editar', '/cerrar', '/historial', '/cocina', '/clientes', '/metas'],
  },

  // Mira el negocio, no lo opera día a día.
  //
  // Sin Reservas, Embarque, Isla ni Folios a propósito: llenarle la pantalla
  // de la operación diaria sería darle siete puertas para no entrar por
  // ninguna. Sí ve tarifas y temporadas: ahí se decide la plata.
  //
  // **Ya tiene «Hoy», y es el suyo.** No es el de la operación: es el del
  // periodo —la meta arriba, el día contra el promedio, la cartera vencida—.
  // Una misma entrada de menú que muestra cosas distintas según quién entra,
  // que es lo que evita un «Panorama» en el menú: ese sería el nombre que le
  // pone el software a una pantalla, no algo que exista en la operación.
  gerencia: {
    home: '/',
    menu: ['/', '/cartera', '/informes'],
    config: ['turnos', 'planes', 'temporadas', 'usuarios', 'actividad', 'reportes'],
    extra: ['/historial', '/clientes', '/metas'],
  },

  // Vende y puede cubrir turnos de muelle, pero no cierra el día ni cobra.
  //
  // Con Agencias en Configuración: al vender aparece la agencia que todavía no
  // existe, y mandarla a pedir que se la creen es justo el paso que este
  // producto viene a quitar.
  asesora_comercial: {
    home: '/',
    menu: ['/', '/reservas', '/embarque'],
    // Turnos porque puede tomar y ceder los de muelle: es su propia agenda,
    // no la de otro (la política `guardias_escritura` de la 015 la deja).
    config: ['turnos', 'agencias', 'reportes'],
    extra: ['/nuevo', '/editar', '/historial', '/clientes'],
  },

  // La isla. Entra viendo la isla, no un menú. Su «Hoy» le dice cuántos
  // vienen y a qué hora; los almuerzos viven dentro de Isla.
  // Y el regreso: desde la 032 lo cierra la isla. Va en `extra` y no en el
  // menú porque no es un destino de todos los días — es de las 3:30.
  admin_isla: {
    home: '/isla',
    menu: ['/', '/isla'],
    config: ['reportes'],
    extra: ['/cocina', '/embarque'],
  },

  // No hay `recepcion`. Lo hubo un rato, por la regla 18 —recepción cobra el
  // tiquete de las cortesías—, pero en la práctica eso lo hace la isla: quien
  // esté de guardia o `admin_isla`. Migración 017.

  // Tampoco hay `mesero`, desde el 11 de agosto (migración 033). No se retiró
  // por simplificar el menú: **estaba roto**. Su `home` era `/isla` pero su
  // lista de rutas solo tenía `/cocina`, así que la puerta lo devolvía a
  // `/isla`, que tampoco podía abrir. Entrar con esa cuenta era rebotar.
  //
  // Y al ir a arreglarlo, el arreglo no se sostenía: un rol de una sola
  // pantalla y sin menú es un rol que nadie sabe mantener. Quien atiende mesas
  // entra como `admin_isla` y ve Hoy, Isla y Almuerzos — más de lo que el
  // mesero podía ver. La comanda sigue siendo de Zeus; lo que cambia es la
  // cuenta con la que se consulta el pronóstico.
}

/**
 * Quién opera el muelle por su rol, sin contar guardias.
 *
 * Espeja a `puedo_operar_muelle()` de la 015, **menos los turnos**: saber si
 * alguien tiene guardia hoy es una consulta al servidor, y esta pregunta se
 * hace para decidir qué pintar, en una pantalla que tiene que funcionar sin
 * señal. Quien tenga guardia y no esté en esta lista igual puede escribir —lo
 * decide la base, que es la que manda— solo que verá el regreso y no la ida.
 *
 * Se usa para no ofrecerle a la isla las lanchas de la mañana: la base se las
 * rechazaría, y cuatro botones que responden con un error son peores que no
 * tener botones.
 */
export function operaElMuelle(rol) {
  return ['super_admin', 'gerencia', 'directora', 'asesora', 'asesora_comercial'].includes(rol)
}

/** El rol con el que se trabaja mientras no haya perfil. */
export const ROL_POR_DEFECTO = 'asesora'

/** Rutas viejas que siguen respondiendo, para no romper un enlace guardado. */
export const REDIRECCIONES = {
  '/dia': '/reservas',
}

/** Todo lo que este rol puede abrir: su menú, sus extras y su Configuración. */
function rutasDe(rol) {
  const c = POR_ROL[rol]
  if (!c) return []
  const deConfig = c.config.length
    ? ['/config', ...c.config.map(s => SECCIONES_CONFIG[s]?.ruta).filter(Boolean)]
    : []
  return [...c.menu, ...c.extra, ...deConfig]
}

/** ¿Este rol puede abrir esta ruta? */
export function puedeVer(rol, ruta) {
  const config = POR_ROL[rol]
  if (!config) return false
  const base = ruta.startsWith('/editar') ? '/editar' : ruta
  const permitidas = rutasDe(rol)
  if (permitidas.includes(base)) return true

  /**
   * Una ficha cuelga de donde vive: `/clientes/:id` de `/clientes`,
   * `/config/planes/:id` de `/config/planes`. Quien puede ver la sección
   * puede ver un registro suyo.
   *
   * **`/config` no cuenta como padre.** Está en la lista de todo el que tenga
   * al menos una sección, así que aceptarlo como prefijo le abriría
   * `/config/temporadas` a quien solo tiene `/config/agencias`. La trampa es
   * fácil de no ver y por eso está escrita.
   */
  const partes = base.split('/').filter(Boolean)
  for (let n = partes.length - 1; n >= 1; n--) {
    const padre = '/' + partes.slice(0, n).join('/')
    if (padre === '/config') continue
    if (permitidas.includes(padre)) return true
  }
  return false
}

/** A dónde mandar a alguien al entrar, o cuando pide algo que no puede ver. */
export function inicioDe(rol) {
  return POR_ROL[rol]?.home || '/'
}

/** El menú de este rol, en orden. Los siete sustantivos, sin el engranaje. */
export function menuDe(rol) {
  const config = POR_ROL[rol]
  if (!config) return []
  return config.menu
    .filter(r => RUTAS[r] && !RUTAS[r].oculta)
    .map(r => ({ a: r, ...RUTAS[r] }))
}

/** Las secciones de Configuración de este rol, en orden. Vacío = sin engranaje. */
export function seccionesDe(rol) {
  const config = POR_ROL[rol]
  if (!config) return []
  return config.config
    .map(id => ({ id, ...SECCIONES_CONFIG[id] }))
    .filter(s => s.etiqueta)
}

/** Los roles asignables, para la pantalla que los reparte. */
export const ROLES = Object.keys(POR_ROL)

export const ETIQUETA_ROL = {
  super_admin: 'Administrador del sistema',
  gerencia: 'Gerencia',
  directora: 'Directora',
  asesora: 'Coordinadora de pasadía',
  asesora_comercial: 'Asesora comercial',
  // Decía solo «Isla», y nadie lo reconocía en una lista de roles: parecía un
  // lugar y no un cargo.
  admin_isla: 'Administrador de isla',
  // Los dos retirados conservan etiqueta por si un perfil viejo todavía la
  // dice: sin esto, la pantalla de Usuarios mostraría el valor crudo de la
  // base. No son asignables — `ROLES` sale de `POR_ROL`, y la restricción
  // `perfiles_rol_vigente` los rechaza aunque alguien escriba directo.
  recepcion: 'Recepción (ya no se usa)',
  mesero: 'Mesero (ya no se usa)',
}
