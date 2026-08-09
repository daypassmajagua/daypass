# Despliegue de DayPASS

Hosting temporal en Vercel, para que la página del cliente
(`/r/{token}`) tenga una dirección pública.

## Configuración del proyecto en Vercel

| Ajuste | Valor | Por qué |
|---|---|---|
| **Root Directory** | `daypass` | La app vive en un subdirectorio del repo |
| Framework Preset | Vite | Lo detecta solo |
| Build Command | `npm run build` | |
| Output Directory | `dist` | |

> ### ⚠ Si el Root Directory se cambia, el despliegue falla en silencio
>
> Pasó el 8 de agosto de 2026: quedó en `.` y estuvo así ocho horas sin que
> nadie lo notara. **Vercel no da error.** El despliegue sale `● Ready`, se le
> asignan los alias, y sirve 404 en todas las rutas — porque en la raíz del repo
> no hay `package.json` ni `index.html` que publicar.
>
> Peor: en el navegador **no se nota**. La app es una PWA y el service worker
> sigue sirviendo la copia guardada de la última versión que sí existió. Se entra,
> se ve todo normal, y lo que se ve es de hace horas. El síntoma que llega es
> "ingreso y veo lo mismo que veía antes", que suena a caché y no lo es.
>
> **Cómo se reconoce en diez segundos:**
>
> ```bash
> npx vercel project inspect daypass       # ¿Root Directory dice daypass?
> npx vercel inspect --logs <url-del-ultimo-despliegue>
> ```
>
> En los registros de un despliegue sano se ve `> vite build` y dura segundos. En
> uno roto se ve esto y no hay forma de confundirlo:
>
> ```
> Build Completed in /vercel/output [132ms]
> Skipping cache upload because no files were prepared
> ```
>
> Ahí no compiló nada. Y si el Root Directory está en `.`, **`daypass/vercel.json`
> tampoco se lee**: Vercel busca ese archivo dentro del Root Directory, así que
> toda la configuración de cabeceras y reescrituras queda sin efecto.

## Variables de entorno

Se configuran en Vercel → Settings → Environment Variables, para
Production, Preview y Development:

```
VITE_SUPABASE_URL       = https://ubtmixgqwfwvartciqyr.supabase.co
VITE_SUPABASE_ANON_KEY  = (la anon public del proyecto)
```

La `anon key` es pública por diseño: viaja en el paquete del
navegador de todas formas. Lo que protege los datos es RLS, no
esconder esa llave. **La `service_role` no va aquí ni en ninguna
parte del front.**

Sin estas variables, la app se despliega en modo demo con datos de
muestra — útil para mostrarle DayPASS al hotel desde una URL, pero no
es la app real.

## Qué hace `daypass/vercel.json`

- **`rewrites`**: la app es una sola página. `/r/{token}`,
  `/embarque` y las demás rutas las resuelve React Router en el
  navegador. Vercel busca el archivo primero, así que los assets y
  `sw.js` se siguen sirviendo tal cual; solo lo que no existe cae a
  `index.html`. Sin esto, recargar en `/r/abc123` daría 404.

- **`sw.js` y `manifest.webmanifest` sin caché**: si un service
  worker viejo se queda pegado, el iPad del muelle sigue con una
  versión de la app que ya no existe y no hay forma de actualizarlo.

- **`/assets/*` con caché de un año**: Vite les pone hash en el
  nombre, así que un archivo con ese nombre nunca cambia.

- **`/r/*` con `noindex`**: cada enlace es de una sola reserva y no
  tiene por qué aparecer en Google.

## Dominio

Mientras se define el definitivo (`majagua.co/r/...`), Vercel da uno
de la forma `daypass-xxxx.vercel.app`. Los tokens funcionan igual: lo
único que cambia al mover el dominio es el prefijo del enlace que se
manda por WhatsApp, que se arma con `window.location.origin`.

## Después de desplegar, revisar

1. `/` pide login.
2. `/r/{token}` de una reserva real abre sin login y **no muestra
   precios ni folios**.
3. Recargar estando en `/r/{token}` no da 404.
4. Desde Safari en el iPad: Compartir → Agregar a inicio, y que abra
   a pantalla completa.
5. Modo avión en `/embarque`: se puede seguir marcando y el indicador
   pasa a ámbar con el conteo.
