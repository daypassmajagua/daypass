# DayPASS — Especificación del ciclo Reserva → Check-in → QR → Embarque → Regreso

Documento de detalle para que no queden ambigüedades en la parte más delicada del sistema.
Complementa el plan unificado v5.

---

## 1. La idea que aclara todo: el QR no contiene información, es una llave

Este es el punto que hace que todo lo demás encaje.

**El QR contiene un solo dato: el token de la reserva.** Nada más. Ni la lancha, ni la hora, ni el
plan, ni los nombres. Al escanearlo, el iPad busca ese token en su copia local del día y muestra
todo lo demás **leído en ese momento**.

Consecuencias, todas buenas:

- **La lancha puede cambiar veinte veces y el QR sigue sirviendo.** No hay que regenerarlo ni
  reenviarlo. Lo que cambia es lo que el sistema responde al leerlo.
- **El mismo QR sirve de ida, en la isla y de regreso.** Es la identidad de la reserva durante todo
  el día, no un boleto para un viaje específico.
- **Funciona sin señal**, porque la respuesta sale de la copia local que el iPad descargó en la
  oficina.
- **No se puede falsificar por adivinación**: el token es largo y aleatorio, no un consecutivo.

Lo que sí lleva **fecha de validez** es el token: solo es válido para su fecha de servicio. Un QR
del sábado escaneado el domingo responde "esta reserva no es de hoy".

---

## 2. Los dos momentos del cliente

| | **Registro de pasajeros** | **Check-in** |
|---|---|---|
| Cuándo | Al crear la reserva | Desde 48 h antes (o de inmediato si es para mañana) |
| Qué pide | Nombre, documento y país de cada persona | Plato de cada uno + condiciones + firma del titular |
| Por qué ahí | Son datos que no cambian y los exige Capitanía | Nadie sabe con dos semanas qué querrá comer; y la firma cerca de la fecha aplica a la versión vigente de las condiciones |
| Qué produce | La lista nominal del manifiesto | **El QR** |
| Si no se hace | Se marca pendiente; se resuelve en el muelle | Se marca "sin plato"; nunca bloquea el embarque |

Ambos ocurren en **la misma URL** (`/r/{token}`), que muestra la etapa que corresponde según el
momento. El cliente nunca recibe dos direcciones distintas.

---

## 3. Línea de tiempo completa

```
VENTA           Se crea la reserva. Nace el token. Se envía el link.
                → El cliente puede registrar a su gente desde ya.

−48 h           Se abre el check-in. Correo: "elige tu almuerzo".

−1 día 18:00    Recordatorio SOLO a quien no ha hecho check-in.

−1 día ~19:00   Daniela cierra el día.
                → Se congela el conteo de cocina.
                → Se generan tickets impresos y tarjetas.
                → Se precarga todo a los dispositivos de muelle e isla.
                → Pantalla "Enviar tarjetas" para el envío por WhatsApp.

DÍA 08:30       Embarque. Se escanea el QR (o se busca por nombre).
                → El iPad responde desde su copia local.

DÍA ~09:00      Cierra el zarpe. Se genera y envía el manifiesto.

DÍA ~14:45      La isla informa "salió Majagua 1" con un clic.

DÍA ~15:30      Daniela recibe en el muelle. Conteo: subieron vs. bajaron.
                → Se invalida el QR. Se cierran folios y día.

+1 día mañana   Correo de agradecimiento + enlace de reseña.

+7 días         El link expira. El historial queda para siempre.
```

---

## 4. Venta tardía: vender de noche para mañana

**Regla base: vender nunca se bloquea.** Si hay cupo, la venta entra. El sistema se adapta.

### Caso A — Vende antes del cierre (ej. 6:00 p.m.)

Flujo normal completo. El check-in se abre **de inmediato** al crear la reserva (la ventana de 48 h
solo aplica a fechas lejanas). Alcanza a hacer check-in antes de las 7 y entra en el conteo de
cocina como cualquier otra.

### Caso B — Vende después del cierre (ej. 9:00 p.m.)

Aquí está el caso que hay que resolver bien, porque cocina, los tickets y la precarga ya salieron.

1. La reserva se crea normal y **se marca automáticamente como cambio tardío**.
2. **Notificación específica a cocina y a la isla**: *"+2 Silver para mañana — agregados 9:14 p.m."*
   No una alerta genérica: el delta exacto, que es lo único que necesitan.
3. **Los dispositivos se resincronizan solos** — el iPad y la tablet de la isla actualizan su copia
   local en cuanto tengan red. Si el iPad ya está apagado, la precarga se refresca al abrirlo en
   la mañana, todavía con wifi de oficina.
4. El cliente recibe su link con **check-in abierto de inmediato**; si lo hace esa noche, su plato
   entra igual y cocina ve el conteo actualizado. Si no, llega marcado "sin plato" y se resuelve en
   el muelle o en la mesa.
5. **Los tiquetes se revalidan**: si la venta tardía deja el inventario corto, alerta inmediata a
   Daniela y a Financiera.
6. El ticket impreso de esa reserva se puede imprimir suelto (una hoja), sin reimprimir el lote.

**Resuelto: se vende hasta las 11:59 p.m. del día anterior.**

Eso tiene una consecuencia grande de diseño: **el "cambio tardío" deja de ser la excepción y pasa
a ser rutina.** Entre el cierre (~7 p.m.) y la medianoche hay cinco horas de venta abierta, y en
ese lapso casi nadie va a hacer check-in ni elegir plato. Por eso:

- **Doble corte de cocina.** El del cierre (~7 p.m.) es el conteo de trabajo; hace falta un
  **segundo corte automático en la madrugada** —a las 6:00 a.m., configurable— con el conteo
  definitivo del día, incluyendo todo lo vendido de noche. Cocina recibe el delta acumulado
  temprano, no una notificación por cada venta a las 11 p.m.
- **Esas ventas casi siempre llegan sin plato**, y eso está bien: el respaldo del muelle no es un
  parche, es parte del flujo normal. Refuerza la regla de que nunca se bloquea el embarque.
- **Los tiquetes se revalidan al segundo corte**, no solo al cierre.
- La precarga del iPad se refresca en la mañana con wifi de oficina, así que alcanza a traer todo
  lo vendido de madrugada.

---

## 5. La lancha en la tarjeta: ida sí, regreso no

Tienes razón en la intuición, y la respuesta cae limpia porque el QR es una llave y no un boleto.

**La tarjeta muestra la lancha y hora de ida** — ese dato sí importa: es dónde y cuándo debe
presentarse la persona.

**No muestra nada del regreso.** A nadie le importa en qué lancha vuelve, y ponerlo genera dos
problemas: información que nadie usa, y un compromiso que el hotel no puede cumplir (el regreso se
arma según cómo esté la isla ese día).

En su lugar, la tarjeta dice del regreso solo lo útil: **"Regreso entre 2:30 y 3:30 p.m."** — que
es exactamente lo que ya dicen las condiciones del Day Tour.

**En el embarque de regreso**, el mismo QR sirve: se escanea y el sistema registra a esa persona en
la lancha en la que efectivamente se subió, sin importar en cuál vino. El manifiesto de regreso se
arma con la realidad, no con una asignación previa.

Y si la lancha de ida cambia después de enviada la tarjeta, **la tarjeta se actualiza sola** porque
es una página, no una imagen. Quien la abra ve la lancha correcta. Por eso el link vivo es mejor
que mandar un PNG.

---

## 6. Casos borde y qué hace el sistema

| Situación | Comportamiento |
|---|---|
| No hizo check-in | Se busca por nombre en el iPad. Embarca igual. Plato se resuelve en el muelle o en la mesa |
| Venta de última hora (10–11:59 p.m.) | Entra normal, marcada tardía. Cocina la ve en el corte de las 6 a.m. Llega sin plato y se resuelve en el muelle |
| QR no escanea (sol, pantalla, papel mojado) | Búsqueda por nombre o documento, siempre a un toque. **El QR nunca es requisito** |
| QR de otra fecha | "Esta reserva es del [fecha]" — no embarca por error |
| QR ya usado hoy | "Ya embarcado a las 8:42" — evita el doble conteo |
| Grupo con un solo QR | Se escanea una vez y aparece la lista completa: "embarcar los 14 listos" o uno por uno |
| Llegan más personas de las reservadas | Walk-in colgado de la misma reserva; queda el rastro para cobro |
| Llegan menos | No-show marcado desde el muelle, nunca desde la oficina |
| Sin señal en el muelle | Todo funciona contra la copia local; los eventos se encolan y suben después |
| Cambió la lancha tras enviar la tarjeta | La tarjeta se actualiza sola al abrirla |
| Alguien se queda en la isla | Se marca en el conteo de regreso, con motivo (se hospeda, vuelve en otra lancha) |

---

## 7. La app en el celular de todos

La decisión de PWA ya tomada soporta esto sin cambios de arquitectura: cada persona instala la app
desde el navegador (compartir → añadir a pantalla de inicio) y recibe notificaciones push.

Dos límites que conviene conocer antes de prometerlo:

- **En iPhone, las notificaciones push solo funcionan si la app está instalada** en la pantalla de
  inicio (iOS 16.4 o superior). Abierta en Safari sin instalar, no llegan. En Android funcionan más
  fácil.
- Cada persona debe **autorizar** las notificaciones la primera vez. Conviene pedirlo en un momento
  con contexto, no al primer segundo: la primera vez que entre a la pantalla donde le sirven.

Por eso la instalación en el celular debería ser parte de la puesta en marcha con cada usuario —
cinco minutos por persona, una sola vez— y no algo que se deja a que cada quien descubra.

---

## 8. Respuestas que cerraron el diseño

**Venta hasta las 11:59 p.m. del día anterior.** → Doble corte de cocina (cierre + 6 a.m.), ventas
tardías como rutina, respaldo del muelle siempre disponible. Ver §4.

**En los grupos de agencia firma el titular del grupo, no la agencia.** → Excelente noticia: el
texto legal actual sirve tal cual, sin versión adicional. Pero ajusta el modo A del link de
agencia: la agencia carga los nombres y puede elegir los platos, **la firma se la queda el
titular**. Dos caminos, ambos soportados:
- La agencia designa al titular y el sistema le manda a él un link corto solo para firmar.
- O el titular firma en el iPad al embarcar (respaldo de siempre).

**Los infantes de 0 a 3 SÍ almuerzan. De 3 a 6 depende de lo que los padres compren.**
→ **Esto corrige un error en el código actual**, donde el conteo de cocina asume que los infantes
no almuerzan (deducido de la regla de precios). La lección de modelo:

> **Quién paga y quién come son dos ejes distintos.** El precio no puede derivar el conteo de
> cocina, igual que el plan no puede derivar el plato.

Concretamente: `pasajeros` necesita un booleano `almuerza`, derivado por defecto de la categoría
(infante 0–3 → sí) pero editable. Y el rango 3–6 es una **decisión de venta, no de check-in**: si
los padres compran plan Niño, el niño va como categoría `nino` (paga y come); si no, va como
`infante` (no paga) — pero **igual almuerza si tiene menos de 3**. Confirmar con Daniela cómo se
registra hoy a un niño de 4 al que no le compran plan.

**Cuentas separadas:** pendiente de la reunión con Daniela. Mientras tanto, la pregunta en el
check-in ("¿pagan junto o separado?") cubre el caso sin construir la división de folios.
