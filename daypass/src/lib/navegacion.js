/**
 * Qué ve cada rol, en un solo archivo.
 *
 * De aquí salen tres cosas que antes estaban sueltas y podían contradecirse:
 * el menú de la barra, a dónde cae cada persona al entrar, y qué rutas la
 * dejan pasar. Con ocho roles llegando, tres listas separadas se desincronizan
 * en la primera semana.
 *
 * **Lo que un rol no puede usar no aparece.** Nada en gris, nada deshabilitado
 * con un candado. Un menú lleno de cosas que no puedes tocar es un menú que se
 * lee mal todos los días.
 *
 * Y el `home` importa más de lo que parece: es lo que hace que cada persona
 * abra la app y vea **su trabajo**, no un menú donde adivinar. El mesero entra
 * y ve la isla; Daniela entra y ve el día.
 *
 * ⚠ Esto **no es seguridad**. Es lo que se muestra. Lo que de verdad protege
 * son las políticas de RLS de la migración 015 — si alguien escribe la ruta a
 * mano, la base le responde vacío igual.
 */

/** Toda ruta de la app, con su etiqueta y su icono para la barra. */
export const RUTAS = {
  '/':          { etiqueta: 'Hoy',               icono: 'LayoutDashboard' },
  '/nuevo':     { etiqueta: 'Nueva reserva',     icono: 'PlusCircle' },
  '/dia':       { etiqueta: 'El día',            icono: 'List' },
  '/cerrar':    { etiqueta: 'Cerrar el día',     icono: 'Lock', oculta: true },
  '/embarque':  { etiqueta: 'Embarque',          icono: 'Anchor' },
  '/isla':      { etiqueta: 'Isla',              icono: 'Palmtree' },
  '/cocina':    { etiqueta: 'Almuerzos',         icono: 'ChefHat' },
  '/folios':    { etiqueta: 'Folios',            icono: 'ClipboardList' },
  '/equipo':    { etiqueta: 'Lanchas y equipo',  icono: 'Ship' },
  '/historial': { etiqueta: 'Historial',         icono: 'History' },
  '/informes':  { etiqueta: 'Informes',          icono: 'BarChart2' },
  '/usuarios':  { etiqueta: 'Usuarios',           icono: 'UserCog' },
  '/reportes':  { etiqueta: 'Reportes',          icono: 'LifeBuoy' },
  '/config':    { etiqueta: 'Configuración',     icono: 'Settings' },
  '/editar':    { etiqueta: 'Editar reserva',    icono: null, oculta: true },
}

/**
 * Por rol: dónde cae al entrar y qué puede ver.
 *
 * El orden de `ver` es el orden del menú: primero lo que más usa.
 */
export const POR_ROL = {
  // AISA, el proveedor. Ve todo porque mantiene el sistema — y por eso mismo
  // queda auditado como todos los demás.
  super_admin: {
    home: '/',
    ver: ['/', '/nuevo', '/dia', '/cerrar', '/embarque', '/isla', '/cocina',
          '/folios', '/equipo', '/historial', '/informes', '/usuarios', '/reportes',
          '/config', '/editar'],
  },

  // Mira el negocio, no lo opera día a día. Entra directo a los números.
  //
  // `/` no está en su lista a propósito: si lo estuviera, el menú tendría una
  // entrada "Hoy" que al tocarla rebotaría de vuelta a Informes, porque la raíz
  // redirige al inicio de cada rol. Un enlace que no lleva a ninguna parte es
  // peor que no tenerlo.
  gerencia: {
    home: '/informes',
    ver: ['/informes', '/historial', '/dia', '/usuarios', '/reportes'],
  },

  directora: {
    home: '/',
    ver: ['/', '/nuevo', '/dia', '/cerrar', '/embarque', '/isla', '/cocina',
          '/folios', '/equipo', '/historial', '/informes', '/usuarios', '/reportes',
          '/config', '/editar'],
  },

  // Daniela. Es quien más usa la app y quien tiene el día completo.
  asesora: {
    home: '/',
    ver: ['/', '/nuevo', '/dia', '/cerrar', '/embarque', '/isla', '/cocina',
          '/folios', '/equipo', '/historial', '/informes', '/reportes', '/editar'],
  },

  // Vende y puede cubrir turnos de muelle, pero no cierra el día ni toca
  // catálogos.
  asesora_comercial: {
    home: '/',
    ver: ['/', '/nuevo', '/dia', '/embarque', '/historial', '/reportes', '/editar'],
  },

  // La isla. Entra viendo la isla, no un menú.
  admin_isla: {
    home: '/isla',
    ver: ['/isla', '/cocina', '/dia', '/reportes'],
  },

  // No hay `recepcion`. Lo hubo un rato, por la regla 18 —recepción cobra el
  // tiquete de las cortesías—, pero en la práctica eso lo hace la isla: quien
  // esté de guardia o `admin_isla`. Un rol que nadie usa es un rol que se
  // asigna por error. Migración 017.

  // Una pregunta, de pie junto a la mesa: ¿a qué cuenta va esto?
  //
  // Sin `/reportes` a propósito, y no por desconfianza: su diseño entero es
  // **una sola pantalla**, y agregarle una segunda por un canal que usará tres
  // veces al año sería deshacer lo que la hace usable. El botón de reportar sí
  // lo tiene —está en todas las pantallas y en los tres modos—, así que puede
  // contar lo que le pase; lo que no ve es la lista con los estados.
  mesero: {
    home: '/isla',
    ver: ['/isla'],
  },
}

/** El rol con el que se trabaja mientras no haya perfil. */
export const ROL_POR_DEFECTO = 'asesora'

/** ¿Este rol puede abrir esta ruta? */
export function puedeVer(rol, ruta) {
  const config = POR_ROL[rol]
  if (!config) return false
  // `/editar/:id` llega con el id pegado; se compara por el prefijo.
  const base = ruta.startsWith('/editar') ? '/editar' : ruta
  return config.ver.includes(base)
}

/** A dónde mandar a alguien al entrar, o cuando pide algo que no puede ver. */
export function inicioDe(rol) {
  return POR_ROL[rol]?.home || '/'
}

/** El menú de este rol, en orden, ya sin las rutas que no se muestran. */
export function menuDe(rol) {
  const config = POR_ROL[rol]
  if (!config) return []
  return config.ver
    .filter(r => RUTAS[r] && !RUTAS[r].oculta)
    .map(r => ({ a: r, ...RUTAS[r] }))
}

/** Los ocho, para la pantalla que administra usuarios. */
export const ROLES = Object.keys(POR_ROL)

export const ETIQUETA_ROL = {
  super_admin: 'Administrador del sistema',
  gerencia: 'Gerencia',
  directora: 'Directora',
  asesora: 'Coordinadora de pasadía',
  asesora_comercial: 'Asesora comercial',
  admin_isla: 'Isla',
  mesero: 'Mesero',
  // Se conserva la etiqueta por si algún perfil viejo todavía la dice: sin
  // esto, la pantalla de Usuarios mostraría el valor crudo de la base.
  recepcion: 'Recepción (ya no se usa)',
}
