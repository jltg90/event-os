# Migración de Wix a Clerk — puesta en marcha

> Hecha el 2026-08-20, cuando EventOS dejó de vivir embebido en Wix y pasó a ser
> una página propia en Vercel.

Antes, la identidad la ponía la página de Wix que contenía la app: mandaba un JWT
por `postMessage` y Convex verificaba su firma HMAC contra `WIX_APP_SECRET`.
Ahora la identidad la pone **Clerk**, y Convex la verifica sola.

**El código ya está migrado.** Lo que queda son pasos de configuración que solo
puedes hacer tú, porque requieren tus cuentas.

---

## 1. Crear la aplicación en Clerk

1. Entra a <https://dashboard.clerk.com>.
2. En el **selector de aplicación** de la barra superior, pulsa **➕ Create application**.
   EventOS necesita su **propia** aplicación: no reutilices la de otro producto,
   porque cada aplicación tiene su propio padrón de usuarios.
3. Nombre: `EventOS`. Métodos de acceso: **Email** y **Google** (los habituales).

### ⚠️ Development vs Production — leer antes de seguir

Clerk crea toda aplicación con un **instance de Development**. Sirve para probar y es
lo que conviene usar durante la migración. Cuando pulses **Go to prod**, Clerk genera
**valores distintos** que hay que actualizar en dos sitios:

| | Development | Production |
|---|---|---|
| Publishable key (`app-config.js`) | `pk_test_...` | `pk_live_...` |
| Issuer (`CLERK_JWT_ISSUER_DOMAIN` en Convex) | `https://<algo>.clerk.accounts.dev` | `https://clerk.<tu-dominio>` |

Además, el instance de producción exige configurar registros DNS en tu dominio.

**Orden recomendado:** completa toda esta guía con Development, verifica que un cliente
heredado ve sus eventos, y **solo entonces** pasa a producción y repite los pasos 3 y 4
con los valores nuevos. Arrancar directo en producción significa depurar DNS y JWT a la
vez, y no vas a saber cuál de los dos falla.

## 2. Crear la plantilla JWT llamada `convex`

Esto es **obligatorio** y es el error más común de esta integración.

1. En Clerk: **Configure → JWT Templates → New template**.
2. Elige el preset **Convex**. Ya trae el claim `aud: "convex"` que Convex exige.
3. El nombre de la plantilla tiene que ser exactamente **`convex`** (en minúsculas).
   El frontend la pide por ese nombre en `app-data.js` (`CLERK_JWT_TEMPLATE`).
4. Guarda y copia el valor de **Issuer**. Se ve así:
   `https://algo-algo-00.clerk.accounts.dev`

## 3. Pegar la llave pública en el frontend

En [app-config.js](app-config.js), rellena:

```js
clerkPublishableKey: 'pk_test_...',   // Clerk → API Keys → Publishable key
```

Es pública a propósito: viaja al navegador y no es un secreto. La URL del
Frontend API se deduce sola de esa llave, así que no hay que tocar nada más.

## 4. Configurar Convex

En el dashboard de Convex, **Settings → Environment Variables**:

| Acción | Variable | Valor |
|---|---|---|
| ➕ Añadir | `CLERK_JWT_ISSUER_DOMAIN` | el **Issuer** del paso 2 |
| ➕ Añadir | `CLERK_SECRET_KEY` | la **Secret key** (`sk_test_...`) de Clerk → API Keys |
| ➖ Borrar | `WIX_APP_SECRET` | ya no se usa |
| ➖ Borrar | `ALLOW_UNSIGNED_JWT` | ya no se usa |

`CLERK_SECRET_KEY` la usa **solo** el servidor, para preguntarle a Clerk qué cuentas
sociales tiene el usuario que acaba de entrar. Sin ella la app funciona, pero el
enlace automático de los clientes heredados de Google no puede operar y tendrías que
mapear todos a mano por correo. Nunca la pongas en `app-config.js`: ese archivo viaja
al navegador.

## 5. Desplegar el backend

```cmd
cd C:\dev\event-os
npm install
set "CONVEX_DEPLOY_KEY=dev:descriptive-ibis-559|<tu-llave>"
npx convex dev --once
```

Verifica en **Functions** que aparecen `auth:ensureIdentity`, `auth:me` y las de
`admin:` (estas últimas son internas y no salen en la lista pública).

## 6. Inventariar a tus clientes actuales

> **La mayoría se enlaza sola.** En la versión de Wix los usuarios entraban con
> Google, así que su `wixUserId` **es** su identificador de cuenta de Google (los
> valores de 21 dígitos). Cuando esa misma persona entre con Google en Clerk, el
> servidor lo reconoce solo y le devuelve sus proyectos: no hay que mapear nada.
>
> El identificador se lee desde la **API de Clerk en el servidor**, nunca desde el
> navegador — si viniera del cliente, cualquiera podría reclamar el espacio de otro
> escribiendo su ID. Y un tenant solo se puede reclamar una vez.
>
> Los pasos que siguen son para los tenants que **no** son IDs de Google (los que
> tienen formato UUID, de una versión más antigua).

En el dashboard de Convex, pestaña **Functions → Run function**, ejecuta:

```
admin:inventory
```

Te devuelve, por cada tenant: cuántos proyectos tiene, la fecha del último cambio,
los nombres de los eventos y los nombres de cliente. Con eso identificas de quién
es cada uno.

## 7. Registrar los enlaces

Por cada cliente, ejecuta:

```
admin:linkLegacyEmail
{ "email": "fulano@sucorreo.com", "tenantId": "<el wixUserId del inventario>", "note": "Fulano - bodas" }
```

La función **falla a propósito** si el `tenantId` no existe, para que un dedazo no
deje a un cliente sin sus datos.

Cuando esa persona se registre en Clerk **con ese mismo correo**, el enlace se hace
solo en su primer acceso y ve todos sus eventos de siempre.

> Si un cliente se registra con otro correo, no pasa nada grave: entra a una cuenta
> vacía. Lo arreglas añadiendo el mapeo correcto y, si ya se enlazó mal, con
> `admin:relink { subject, tenantId }`.

## 8. Desplegar el frontend

```cmd
git add -A
git commit -m "feat: migracion de Wix a Clerk"
git push
```

Vercel despliega solo. `vercel.json` ya deja `index.html` sin caché y los `.js`
cacheados para siempre (llevan `?v=` en la URL).

## 9. Verificar

1. Abre la app: debe salir la pantalla de acceso de Clerk, no la de carga.
2. Entra con una cuenta de prueba → debe crear un espacio vacío.
3. Ejecuta `admin:listLinks` y comprueba que aparece en `linked` con `linkedFrom: "new"`.
4. Entra con el correo de un cliente enlazado → deben aparecer sus eventos, y
   `listLinks` lo muestra con `linkedFrom: "legacy"`.
5. En la consola del navegador no debe haber errores rojos.

---

## Si algo falla

| Síntoma | Causa casi segura |
|---|---|
| "Falta configurar Clerk" en la pantalla de acceso | `clerkPublishableKey` vacío en `app-config.js` |
| Entra a Clerk pero luego "No pudimos verificar tu cuenta" | La plantilla JWT no se llama `convex`, o `CLERK_JWT_ISSUER_DOMAIN` no coincide con el Issuer |
| `Unauthorized: no valid session` en la consola | Convex está rechazando el token: revisa `applicationID: "convex"` en `convex/auth.config.ts` frente al claim `aud` de la plantilla |
| El cliente entra pero no ve sus eventos | No hay mapeo para su correo, o se registró con otro. `admin:listLinks` lo aclara |
| Sigo viendo la versión vieja | Caché: `Ctrl+Shift+R`. Los scripts deben cargar con `?v=20260820-2` |
| Funcionaba y de pronto nadie entra | ¿Pasaste a producción? El `pk_live_` y el Issuer nuevo hay que actualizarlos **los dos** (paso 1) |
| Los usuarios de prueba no aparecen en producción | Son padrones separados: el instance de Development tiene sus propios usuarios y no se migran |

## Limpieza pendiente (cuando todo esté verificado)

- La tabla `sessions` y el cron `cleanup expired sessions` quedaron deprecados. El
  cron la vacía sola en 24 h; después se pueden borrar de `schema.ts`, `crons.ts` y
  `auth.ts`.
- El campo de partición se sigue llamando `wixUserId` en las 4 tablas de datos. Es
  solo un nombre: hoy significa "tenant". Renombrarlo exigiría reescribir todos los
  documentos, y no vale la pena el riesgo.
