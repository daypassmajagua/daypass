# Auditoría funcional — 11 de agosto de 2026

Motivo: *«Hay problemas en cargar el sistema, se demora todo. Estoy creando una reserva y marca a
veces problemas de servidor… no me deja modificar la reserva una vez guardada, no guarda
nuevamente.»*

Son tres síntomas y **no tienen la misma causa**. Uno está encontrado y arreglado, otro tiene una
causa muy probable que se puede medir, y el tercero necesita datos de producción que yo no puedo
—ni debo— sacar.

---

## 1 · CRÍTICO · Una reserva guardada no se podía volver a guardar — **arreglado**

### Qué pasaba

Zod, la validación del formulario, distingue entre «no está» (`undefined`) y «está vacío»
(`null`). **`z.string().optional()` acepta lo primero y rechaza lo segundo.**

Y la base guarda `null`, no `undefined`. Al abrir una reserva para editarla, el formulario se llena
con exactamente lo que hay en la fila:

```
nombre_grupo · identificacion · pais_id · agencia_nombre · forma_pago
voucher_os · folio_zeus · observaciones · vendida_por · telefono · email · tipo_ingreso_id
```

Casi todos en `null` en casi cualquier reserva. Con uno solo que lo estuviera, **la validación
fallaba antes de intentar guardar**, con un mensaje de Zod en inglés —*«Invalid input: expected
string, received null»*— colgado de un campo que a lo mejor ni estaba a la vista.

Y el formulario no avisaba de nada: `handleSubmit` no tenía qué hacer cuando la validación falla.
**Desde afuera, el botón «Guardar cambios» simplemente no hacía nada.**

> No era una reserva rara. Era casi cualquiera, y con más razón las de agencia: ahí el contacto es
> la agencia, así que el teléfono y el correo del pasajero **están vacíos por definición** — y los
> dos eran obligatorios.

### Qué se cambió

- Todo campo opcional acepta `null` y lo normaliza a vacío. El `''` no llega así a la base:
  `limpiarVacios` lo vuelve `null` antes de guardar, que es lo que Postgres necesita en una
  columna `uuid`.
- **El teléfono y el correo se piden pero no se exigen.** Sin ellos no hay enlace de check-in, y
  eso la pantalla lo dice debajo del campo; pero no puede impedir corregir la lancha de un grupo a
  las siete de la mañana.
- **`tipo_ingreso_id` tampoco se exige al editar.** Es nullable en la base —la 007 lo agregó a una
  tabla que ya tenía reservas— así que exigirlo dejaba sin editar todo lo anterior a esa migración.
- **Si la validación falla, se dice**: un aviso que nombra los campos y aclara que la reserva no se
  guardó. Un fallo silencioso justo en el paso de guardar es la peor clase de fallo: quien lo sufre
  no sabe si el sistema está lento, roto, o si ya guardó.

Comprobado en el navegador con tres reservas distintas —individual con documento, grupo de agencia
sin contacto, y una con folio— y las tres vuelven a guardar. Hay una prueba que impide que el
patrón `z.string().optional()` regrese al formulario.

---

## 2 · Lo que casi seguro explica la lentitud — **medible, no arreglado todavía**

### Las vistas de dinero llaman a una función por fila, cuatro veces

`saldos_reserva` está escrita así:

```sql
valor_a_cobrar(r.id)                              as a_cobrar,
pagado_de_reserva(r.id)                           as pagado,
valor_a_cobrar(r.id) - pagado_de_reserva(r.id)    as saldo
```

Son **cuatro llamadas por reserva**, y cada una de esas funciones hace su propia consulta —un join
contra `tipos_ingreso`, una suma sobre `pagos`—. Sobre la tabla entera, porque la vista no filtra
por fecha.

`cartera_por_organizacion` se construye encima, así que hereda el costo **antes** de filtrar por
saldo. Y `avance_metas` hace `sum(valor_a_cobrar(reg.id))` sobre el rango de cada meta.

Con unos miles de reservas eso son decenas de miles de sub-consultas por carga de pantalla. Es la
explicación más probable de que Cartera, Informes y el «Hoy» de gerencia se arrastren.

**Se arregla reescribiendo las vistas** para calcular una sola vez con un `join` en vez de llamar
funciones por fila. Es una migración y no la escribo a ciegas: primero hay que medir, porque si el
número real es de 80 ms no vale la pena tocar nada.

### Al guardar, los pasajeros se actualizaban uno por uno — **arreglado**

`guardarPasajeros` hacía un `update` por persona, **en serie**. Guardar un grupo de veintiocho eran
veintiocho viajes al servidor uno detrás de otro, cada vez que se tocaba «Guardar», aunque no
hubiera cambiado un solo nombre. Ahora es una sola llamada.

### Cómo medir el resto

Dejé **`daypass/supabase/consultas/por_que_se_demora.sql`**. Solo lee, se puede correr con gente
trabajando, y cada bloque dice qué número sería malo. Lo que más sirve es el punto 7: si
`pg_stat_statements` está encendido, dice **qué consulta se lleva el tiempo** en vez de suponerlo.

Con esa salida escribo la migración que haga falta, o descarto esta hipótesis.

---

## 3 · CRÍTICO · La app se quedaba en «Viendo qué te toca hoy…» — **arreglado**

Las dos capturas lo resolvieron: la pantalla de carga que no abre, y después **«El servidor no
respondió a tiempo»** con nada en la consola. Ese mensaje es nuestro —es el límite de doce
segundos que tiene el arranque— así que **no había ningún error del servidor**. Había una consulta
que no volvía.

### Por qué no volvía

`usePerfil()` lo llaman **quince componentes**: `ProtectedRoute`, `Navbar`, `FranjaDia`,
`BarraVerComo`, y casi cada pantalla. Y era un hook con estado propio, así que **cada llamada
hacía su propio trabajo**: un `getSession()`, una consulta a `perfiles` y **un escucha de sesión**.

Abrir «Hoy» disparaba cinco veces lo mismo. Y cada refresco de token despertaba a los quince
escuchas a la vez.

Encima de eso, lo que lo convertía en un cuelgue y no solo en lentitud:

> El cliente de Supabase protege la sesión con un candado — mientras uno la refresca, los demás
> esperan. El hook pedía la sesión **dentro** del callback de `onAuthStateChange`, que es pedirla
> desde adentro del candado. Con quince listeners haciéndolo a la vez, la espera no se acababa.

Cuadra con que apareciera al buscar: el buscador lanza cuatro consultas más encima de las que ya
se atropellaban.

### Qué se cambió

Un **`ProveedorPerfil`** que resuelve quién eres **una sola vez** para toda la app: un escucha, una
sesión, una consulta. `usePerfil()` sigue existiendo con la misma forma —los quince sitios no
cambiaron ni una línea— pero ahora solo lee.

Y el escucha **usa la sesión que le llega por parámetro** en vez de volver a pedirla, que es la
forma de no entrar al candado desde adentro. El refresco de token ya no vuelve a consultar
`perfiles`: renovar el token no cambia quién es nadie.

Comprobado: la app abre, y «Ver la app como» sigue cambiando de rol sin recargar.

> **`useDiaOperativo` ya estaba bien** y sirve de modelo: lee del store compartido y no consulta
> por instancia. Era `usePerfil` el que se había quedado atrás.

---

## 4 · Lo que revisé y está bien

- **Los permisos de escritura.** La política de `UPDATE` sobre `registros` (019) deja escribir a
  `super_admin`, `directora`, `asesora` y `asesora_comercial`. No era el bloqueo.
- **El sellado de autoría (024).** El trigger reescribe `generada_por` en cada `UPDATE` con el
  valor viejo, así que mandarlo desde el formulario no rompe nada.
- **Las columnas generadas.** `total_calculado` llega en la consulta de edición pero Zod la
  descarta antes de guardar —un esquema de objeto quita lo que no declara— así que nunca se
  intenta escribir. Habría sido un error duro de Postgres.
- **La precarga de personas** al escribir un documento: tiene 350 ms de espera y descarta las
  respuestas viejas. No es la lentitud.

---

## 5 · Lo que sigue, en orden

1. **Probar la app otra vez.** Con el perfil resuelto una sola vez, el arranque debería dejar de
   colgarse y toda la navegación debería sentirse más liviana — son cuatro consultas menos y
   catorce escuchas menos por pantalla.
2. **Correr `por_que_se_demora.sql`** y pegarme la salida. Sigue haciendo falta: si Cartera,
   Informes o el «Hoy» de gerencia siguen pesados, la causa es la del punto 2 y se arregla con una
   migración.
3. Si vuelve a aparecer un cuelgue después de esto, **el momento exacto en que pasa** —qué
   pantalla, qué se acababa de tocar—. Ya no quedan sospechas de este tamaño, así que la siguiente
   habrá que buscarla con datos.
