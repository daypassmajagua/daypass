/**
 * Los textos de la página pública, en los dos idiomas.
 *
 * Van aquí y no repartidos por el componente porque el cliente puede llegar
 * en inglés y todo tiene que cambiar a la vez. Español primero: es el idioma
 * de la mayoría y el que se muestra por defecto.
 */
export const T = {
  es: {
    idioma: 'Español',
    otro: 'English',
    cargando: 'Buscando tu reserva…',
    noExiste: 'Este enlace ya no está disponible',
    noExisteDetalle: 'Puede que haya expirado o que el enlace esté incompleto. Escríbenos y te enviamos uno nuevo.',
    hola: 'Hola',
    tuReserva: 'Tu Day Tour en Majagua',
    para: 'Para el',
    personas: 'personas',
    persona: 'persona',
    plan: 'Plan',
    lancha: 'Lancha',

    // Etapa 1
    paso1Titulo: '¿Quiénes vienen?',
    paso1Ayuda: 'Necesitamos el nombre y el documento de cada persona: la Capitanía de Puerto lo exige para poder zarpar.',
    nombre: 'Nombre completo',
    documento: 'Documento',
    pais: 'País',
    categoria: 'Categoría',
    adulto: 'Adulto',
    nino: 'Niño (3 a 8)',
    infante: 'Infante (menor de 3)',
    cortesia: 'Cortesía',
    restriccion: '¿Alguna restricción alimentaria?',
    restriccionPlaceholder: 'Ej: sin gluten, vegetariano',
    agregarPersona: 'Agregar otra persona',
    quitar: 'Quitar',
    guardarPersonas: 'Guardar los nombres',
    guardado: 'Listo, guardamos los nombres',

    // Etapa 2
    paso2Titulo: 'Elige tu almuerzo',
    paso2Ayuda: 'Cada persona escoge su plato. Así lo tenemos listo cuando llegues.',
    plato: 'Plato',
    elegirPlato: 'Elegir plato',
    sinOpciones: 'Tu plan trae un menú fijo: no hay nada que elegir.',

    condicionesTitulo: 'Condiciones del Day Tour',
    condicionesAyuda: 'Léelas completas antes de firmar.',
    leerCompleto: 'Debes leer hasta el final para poder firmar',
    firmaTitulo: 'Firma del titular',
    firmaAyuda: 'Firma con el dedo o con el mouse. Firmas por ti y por quienes registraste.',
    firmaNombre: 'Tu nombre completo',
    firmaDocumento: 'Tu documento',
    limpiar: 'Borrar y volver a firmar',
    confirmar: 'Confirmar mi asistencia',
    faltaFirma: 'Falta tu firma',
    faltaNombre: 'Falta tu nombre',

    // Pase
    paseTitulo: '¡Todo listo!',
    paseAyuda: 'Muestra este código en el muelle. No necesitas imprimirlo.',
    paseGuardar: 'Toma una captura de pantalla por si te quedas sin señal.',
    tuPase: 'Tu pase',
    verDetalle: 'Ver el detalle de mi reserva',

    // Estados
    cerrado: 'La lista de este día ya se cerró',
    cerradoDetalle: 'Si necesitas cambiar algo, escríbenos directamente.',
    aunNo: 'Todavía es pronto',
    aunNoDetalle: 'El check-in se abre dos días antes de tu Day Tour. Te avisamos.',
    yaPaso: 'Este Day Tour ya pasó',
    gracias: '¡Gracias por venir!',
    graciasDetalle: 'Esperamos que la hayas pasado increíble en Majagua.',

    error: 'Algo no salió bien',
    reintentar: 'Volver a intentar',
    guardando: 'Guardando…',
  },

  en: {
    idioma: 'English',
    otro: 'Español',
    cargando: 'Finding your booking…',
    noExiste: 'This link is no longer available',
    noExisteDetalle: 'It may have expired or be incomplete. Write to us and we will send a new one.',
    hola: 'Hello',
    tuReserva: 'Your Day Tour at Majagua',
    para: 'On',
    personas: 'people',
    persona: 'person',
    plan: 'Plan',
    lancha: 'Boat',

    paso1Titulo: 'Who is coming?',
    paso1Ayuda: 'We need each person’s name and ID: the Port Authority requires it before we can sail.',
    nombre: 'Full name',
    documento: 'ID / Passport',
    pais: 'Country',
    categoria: 'Category',
    adulto: 'Adult',
    nino: 'Child (3 to 8)',
    infante: 'Infant (under 3)',
    cortesia: 'Complimentary',
    restriccion: 'Any dietary restriction?',
    restriccionPlaceholder: 'e.g. gluten free, vegetarian',
    agregarPersona: 'Add another person',
    quitar: 'Remove',
    guardarPersonas: 'Save names',
    guardado: 'Done, names saved',

    paso2Titulo: 'Choose your lunch',
    paso2Ayuda: 'Each person picks a dish, so it is ready when you arrive.',
    plato: 'Dish',
    elegirPlato: 'Choose dish',
    sinOpciones: 'Your plan comes with a set menu: nothing to choose.',

    condicionesTitulo: 'Day Tour Terms',
    condicionesAyuda: 'Please read them in full before signing.',
    leerCompleto: 'You must read to the end before signing',
    firmaTitulo: 'Signature of the lead guest',
    firmaAyuda: 'Sign with your finger or mouse. You sign for yourself and for those you registered.',
    firmaNombre: 'Your full name',
    firmaDocumento: 'Your ID',
    limpiar: 'Clear and sign again',
    confirmar: 'Confirm my attendance',
    faltaFirma: 'Your signature is missing',
    faltaNombre: 'Your name is missing',

    paseTitulo: 'All set!',
    paseAyuda: 'Show this code at the dock. No need to print it.',
    paseGuardar: 'Take a screenshot in case you lose signal.',
    tuPase: 'Your pass',
    verDetalle: 'See my booking details',

    cerrado: 'This day’s list is already closed',
    cerradoDetalle: 'If you need to change anything, please write to us directly.',
    aunNo: 'A little early',
    aunNoDetalle: 'Check-in opens two days before your Day Tour. We will let you know.',
    yaPaso: 'This Day Tour has passed',
    gracias: 'Thank you for coming!',
    graciasDetalle: 'We hope you had an amazing time at Majagua.',

    error: 'Something went wrong',
    reintentar: 'Try again',
    guardando: 'Saving…',
  },
}

export function textos(idioma) {
  return T[idioma] || T.es
}
