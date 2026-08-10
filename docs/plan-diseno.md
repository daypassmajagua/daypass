# Plan de diseño y accesos — antes de las últimas fases

Sale de tres cosas que reportaste el 10 de agosto: no podías verte como `super_admin`, no
encontrabas el rol de la isla, y el diseño no se siente terminado. Más dos decisiones tuyas:
**crear cuentas desde la app** y **retirar el rol de mesero**.

Va **antes** de las fases 6, 7 y 8 a propósito. Esas tres traen pantallas nuevas —notificaciones,
eventos masivos, informes rehechos— y arrancarlas sobre un diseño a medias es garantizar que la
deuda se duplique. Es el mismo argumento por el que la Fase 1 iba antes de la 2, y esa vez
funcionó.

---

## 0 · Lo que ya se corrigió al revisar

Tres cosas de las que reportaste no eran del diseño, eran fallos concretos. Dos ya están:

| Qué veías | Qué era | Estado |
|---|---|---|
| No podías elegir «Super Admin» en *Ver como* | La lista **excluía tu propio rol** —«para qué ofrecerte lo que ya eres»— y el regreso era un botón aparte. Si no lo veías, parecía que faltaba | ✅ Ahora tu rol aparece marcado *(tú)* y elegirlo te devuelve |
| No veías el rol de administrador de isla | **Sí estaba**, pero etiquetado solo «Isla»: parecía un lugar y no un cargo | ✅ Ahora dice «Administrador de isla» |
| Las cuentas se crean en Supabase | Es verdad, y hoy es a propósito: crearlas desde el navegador exige la clave de servicio, que **nunca** puede viajar al front | ⬜ Tiene solución buena — la Fase D1 |

---

## 1 · Fase D1 · Crear cuentas desde la app

**Lo que hay hoy.** `/usuarios` reparte roles pero no crea cuentas: eso se hace en Supabase →
Authentication → Users, y la pantalla lo dice y enlaza. Entre los dos pasos, la persona puede
entrar y no ver nada — por eso las cuentas sin perfil salen arriba en coral.

**Por qué no se resolvió antes, dicho claro.** Crear un usuario exige la clave `service_role`. Esa
clave **abre la base entera saltándose la RLS**: si viaja al navegador, cualquiera la saca del
paquete y tiene todo. No es una precaución exagerada — es la misma familia de error que dejó
`estado_embarques` legible sin sesión hasta la 018.

**La solución correcta: una Edge Function.**

```
El navegador                    Supabase (servidor)
─────────────                   ───────────────────
/usuarios                       crear-usuario
  "crea a Camila"      ──────►    1. ¿quién llama? (la sesión viaja en la petición)
  con TU sesión                   2. ¿puede_administrar()? si no, 403
                                  3. crea la cuenta con service_role
                       ◄──────    4. le pone su perfil y su rol
```

La clave vive **como secreto de Supabase**, nunca en el repo, nunca en Vercel, nunca en el
paquete del navegador. Es exactamente el mismo patrón que la regla 16 exige para el envío de
correos: *el envío lo hace el servidor, nunca el dispositivo*.

**Qué queda:**
- Crear la persona con nombre real, correo y rol, en un solo paso
- Invitación por correo para que ponga su clave (no inventarle una y decírsela por WhatsApp)
- Desactivar y reactivar, que ya existe
- Todo firmado en la bitácora (024): crear una cuenta es de las acciones que más hay que poder auditar

**Bloqueado por ti:** hay que instalar el CLI de Supabase y darle un token para desplegar
funciones. Es una vez.

**Riesgo: MEDIO.** Es la primera Edge Function del proyecto —no hay `supabase/functions/`— así que
hay que montar el andamiaje. Pero es aditivo: si falla, el camino de hoy sigue funcionando.

---

## 2 · Fase D2 · Los roles, otra vez

### 2.1 · Retirar el mesero

Dices que quedamos en eliminarlo. **En mis registros no está esa decisión** —`CLAUDE.md` todavía
documenta siete roles con `mesero` dentro— así que la tomo como decisión de hoy, no como algo que
se me pasó. Si me equivoco y ya lo habías dicho, el resultado es el mismo.

Es exactamente el caso de `recepcion` en la 017, y se resuelve igual: PostgreSQL no deja quitar un
valor de un enum sin desmontar la RLS de 30 tablas, así que **el valor se queda huérfano y se
cierra la puerta con un CHECK**; quien lo tuviera pasa a `admin_isla`.

> **Una consecuencia que conviene decidir con los ojos abiertos.** El mesero está diseñado como
> **una sola pantalla**: entra y ve la isla, sin menú, sin barra. La pregunta que responde es una
> —*¿a qué cuenta va esto?*— de pie junto a la mesa. `admin_isla` tiene cuatro entradas de menú y
> ve Almuerzos y El día.
>
> Al retirarlo, quien atiende las mesas pasa a ver esas cuatro. No es grave, pero es más de lo que
> necesita. **Dos salidas:** dejarlo así, o que `admin_isla` entre a `/isla` sin barra igual que
> hoy y las otras pantallas queden a un toque. Lo segundo conserva lo bueno del mesero sin el rol.

### 2.2 · Nombres que se reconozcan

Ya se corrigió «Isla» → «Administrador de isla». Vale la pena repasar los otros con la operación
delante: «Coordinadora de pasadía» es Daniela, «Directora», «Gerencia». Si alguno no es como se
dicen entre ustedes, se cambia — son etiquetas, no datos.

**Riesgo: BAJO.** Una migración corta y un repaso de textos.

---

## 3 · Fase D3 · El diseño

Aquí está el grueso. Lo que sigue **no es opinión**: sale de contar el código.

### 3.1 · Lo que ya está sano

La Fase 1 dejó el sistema en pie: tokens completos con sus dos paletas (oficina y sol), cero
colores escritos a mano fuera de la hoja de impresión, cero controles nativos, los tres estados en
las 13 pantallas, y esqueletos en vez de «Cargando…». Eso no hay que rehacerlo.

### 3.2 · Lo que falta, en orden de lo que más se nota

**a) El modo no llega a donde más importa.** Embarque e Isla se dimensionaron a mano
—`text-[18px]`, `min-h-[64px]`— **antes** de que el modo existiera. Cambiar el aparato a isla no
las mueve: siempre se ven como muelle. Es la deuda que dejé anotada en la Fase 1 y es la más
visible de todas, porque son las dos pantallas que se usan de pie.

**b) Las tablas de oficina nunca pasaron por diseño.** Informes (50 clases `gray-*`), ListadoDia
(27), Historial (24), Folios (13). Son las que quedaron del principio y se nota: densidad
distinta, jerarquía distinta, encabezados distintos.

**c) El teléfono.** Todo se probó en computador y en iPad. El menú se pliega en cajón táctil por
debajo de 1536 px, y las tablas hacen scroll horizontal — pero **nadie ha abierto esto en un
teléfono de verdad**. Las asesoras venden desde el celular.

**d) No hay dónde ver el sistema.** La página `/estilo` que el plan pide para `super_admin` no
existe. Sin ella, cada pantalla nueva se compara con la anterior de memoria.

**e) Los documentos impresos.** 84 colores a mano en `printDoc.js` y una paleta de grises distinta
a la de pantalla. Son defendibles —una hoja impresa no lee Tailwind— pero conviene una sola
constante.

### 3.3 · Cómo lo abordaría

| Paso | Qué | Riesgo |
|---|---|---|
| **D3.1** | Embarque e Isla a unidades relativas, para que respondan al modo | MEDIO-ALTO — son las pantallas del día a día |
| **D3.2** | Página `/estilo` con tokens, primitivos y patrones en los tres modos | BAJO — es nueva, no toca nada |
| **D3.3** | Repaso en teléfono real, con la lista de arreglos que salga | BAJO |
| **D3.4** | ListadoDia, Historial y Folios con los patrones | MEDIO |
| **D3.5** | Informes: partirla y repintarla (800 líneas en un componente) | MEDIO |

**D3.2 primero, aunque no sea lo que más se nota.** Es la que hace que las demás se puedan
comparar contra algo en vez de contra el recuerdo.

**Bloqueado por ti:** el repaso en teléfono necesita que abras la app en el tuyo y me digas qué se
ve mal. Eso no lo puedo ver desde aquí, y ninguna prueba automática lo ve tampoco.

---

## 4 · El orden que propongo

```
D1 · Cuentas desde la app      ← lo que más te estorba hoy
D2 · Roles (mesero, nombres)   ← corto, y despeja D3
D3 · Diseño
   D3.2 /estilo
   D3.1 Embarque e Isla al modo
   D3.3 teléfono real
   D3.4 tablas de oficina
   D3.5 Informes
────────────────────────────
Fase 6 · Comunicación
Fase 7 · Operación ampliada
Fase 8 · Cierre
```

**Y algo que no es de este plan pero pesa más que todo esto:** los catálogos reales siguen sin
cargar. Nada de lo de arriba acerca a Daniela a operar un día; los catálogos sí, y son media hora
en dos pantallas.

---

## 5 · Qué decidir para poder arrancar

1. **El mesero: ¿se retira?** Y si sí, ¿`admin_isla` conserva la pantalla única de la isla o pasa
   al menú de cuatro entradas? (§2.1)
2. **¿Instalas el CLI de Supabase** para poder desplegar la Edge Function de cuentas? Sin eso, D1
   no arranca.
3. **¿Los nombres de los roles** son como los dicen ustedes? (§2.2)
4. **¿Prefieres D1 primero o D3?** Yo empezaría por D1 porque es lo que te está estorbando cada
   vez que entra alguien al equipo.
