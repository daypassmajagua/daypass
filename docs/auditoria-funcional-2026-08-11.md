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

## 3 · «A veces problemas de servidor» — **falta información**

No lo puedo diagnosticar desde el código: «problema de servidor» puede ser un 400 de PostgREST, un
500 de un trigger, un tiempo agotado, o la sesión vencida. Cada uno se arregla distinto.

Lo que necesito es **el mensaje exacto**. Dos formas, la que sea más cómoda:

- Cuando salga, la consola del navegador (F12 → Consola) muestra la respuesta completa.
- O el botón de reportar que ya está en todas las pantallas: guarda la pantalla y el rol, y queda
  en `/reportes`.

Con un solo caso concreto es cuestión de minutos.

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

1. **Correr `por_que_se_demora.sql`** y pegarme la salida. Es lo único que separa una corazonada
   de una causa.
2. **Un caso concreto del «problema de servidor»**, con su mensaje.
3. Con lo uno y lo otro: la migración de las vistas, si los números la justifican.
