# EventOS — Claude Context

## Project Overview

EventOS is a multi-feature event planning SaaS for event professionals. Users create and manage events with budget tracking, vendor management, task timelines, guest lists, floor plan design, moodboards, and PDF exports. Authentication is provided by Wix; data is stored in Convex Cloud.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES2015+), no framework |
| Hosting | Vercel (sitio estático — ver `vercel.json`) |
| Styling | Single `styles.css` with CSS custom properties |
| Backend | Convex (serverless DB + functions), TypeScript |
| Auth | **Clerk** (`@clerk/clerk-js` por CDN) — ver [MIGRACION-CLERK.md](MIGRACION-CLERK.md) |
| AI proxy | Cloudflare Worker (`app-config.js`) |
| 3D viewer | Three.js r128 |
| Excel export | xlsx 0.18.5 |

## Key Directories & Files

```
/
├── index.html                    Single HTML shell; all "pages" are rendered into it
├── app-config.js                 Convex URL + AI proxy URL (window.EVENTOS_CONFIG)
├── app-data.js                   Thin client wrapping Convex HTTP API
├── core.js                       App bootstrap, auth, global state (DB.cur, LANG, CURRENCY)
├── events.js                     Event CRUD and multi-step creation wizard
├── layout.js                     Floor plan editor (canvas + Three.js 3D view)
├── library.js                    Reusable vendor/task library across projects
├── budget-timeline-guests.js     Budget, timeline, and guest-list modules
├── misc.js                       Shared UI utilities: modals, moodboard, PDF export
├── analytics.js                  Cross-project analytics dashboard
├── lang.js                       i18n (EN/ES), CURRENCY, date helpers, settings, backup
├── chair-images.js               ~630 KB de PNGs base64; NO se carga en el bundle
│                                 principal, se pide con ensureChairImages() (index.html)
├── styles.css                    All CSS; variables at :root
├── vercel.json                   Cabeceras de caché y seguridad del hosting
├── MIGRACION-CLERK.md            Configuración de Clerk: llaves, plantilla JWT, enlace de clientes
└── convex/
    ├── schema.ts                 projects, project_extras, file_ownership, identities,
    │                             legacy_links (+ sessions, deprecada)
    ├── auth.config.ts            Proveedor de identidad (Clerk) que Convex acepta
    ├── auth.ts                   requireAuth (helper), ensureIdentity, me
    ├── admin.ts                  Migración: inventory, linkLegacyEmail, listLinks, relink (internas)
    ├── files.ts                  Convex Storage: upload, URLs, borrado, claimOwnership
    ├── crons.ts                  Limpieza diaria de la tabla `sessions` deprecada
    └── projects.ts               CRUD de proyectos + project_extras + borrado de archivos
```

> `chair-images.js` es un archivo nuevo y **debe subirse al desplegar**. Si falta, la
> app no se rompe: simplemente no se ven las miniaturas de sillas.

## Build & Dev Commands

```bash
# Start Convex local dev server (watches convex/ and regenerates _generated/)
npm run convex:dev      # alias for: npx convex dev

# Deploy backend to Convex Cloud
npm run convex:deploy   # alias for: npx convex deploy
```

The frontend requires **no build step** — files are served statically. Convex auto-generates `convex/_generated/` from los archivos de `convex/`; never edit those files manually.

No hay tests ni typecheck local (`node_modules` no está instalado). El chequeo mínimo
antes de desplegar es:

```bash
for f in *.js; do node --check "$f" || echo "FALLO $f"; done
for f in convex/*.ts; do node --experimental-strip-types --check "$f" || echo "FALLO $f"; done
```

`npx convex deploy` hace el typecheck real de TypeScript.

## Database

`projects` guarda un blob JSON denormalizado (`data: v.any()`) con el evento completo.

Cuando un proyecto supera ~700 KB, `app-data.js` mueve los arrays grandes (guests,
layoutItems, savedLayouts, layouts, vendors, moodboard, eventLayouts) a un documento
companion en **`project_extras`** y marca el principal con `_hasExtras: true`.
Consecuencias que hay que respetar siempre:

- Un proyecto con `_hasExtras` y sin `_extrasLoaded` tiene esos arrays **vacíos** en
  memoria. Nunca lo guardes ni lo exportes en ese estado: `_mergeProjectExtras()`
  primero. Las vistas agregadas usan `_ensureAllProjectsComplete()` (core.js).
- `deleteProject` borra el proyecto, su fila de `project_extras` **y** los archivos
  de Convex Storage a los que apuntaban. No dejes ninguno de los tres atrás.

`file_ownership` es la tabla de control de acceso a archivos: sin fila, el archivo
**no** es accesible. Los archivos antiguos se regularizan con `files:claimOwnership`,
que verifica que el id aparezca en los propios documentos del usuario.

See [convex/schema.ts](convex/schema.ts) for indexes.

## Global State Conventions

- `DB.cur` — **tenantId** del usuario actual, lo devuelve `auth:ensureIdentity` en
  `initApp()`. Para un cliente heredado de Wix es su viejo `wixUserId`; para uno
  nuevo, su id de Clerk. Es la llave de todo el almacenamiento local y remoto.
- `USER_PROFILE` — `{ tenantId, subject, email, name, linkedLegacy }`. Sustituye al
  antiguo `WIX_USER`. Los datos de presentación (nombre, avatar) salen de
  `window.Clerk.user`.
- `LANG` — active locale string (`'en'` / `'es'`)
- `CURRENCY` — moneda activa. Es **por proyecto** (`p.currency`), con un default por
  usuario en settings (`DEFAULT_CURRENCY`). La aplica `applyProjectCurrency()` al
  abrir/cerrar un proyecto. Formatea SIEMPRE con `fmtMoney()` o `formatCost()`:
  nunca escribas `'$'` a mano.
- `window.EVENTOS_DATA` — Convex API façade (defined in `app-data.js`)
- `window.EVENTOS_CONFIG` — URLs de despliegue + `allowedOrigins` (`app-config.js`)
- Per-user preferences are persisted to `localStorage` keyed by user ID

### Reglas que se rompen con facilidad

- **Fechas**: las fechas de evento y de tarea son cadenas civiles `YYYY-MM-DD`.
  `new Date('2026-07-01')` es medianoche **UTC** y en México cae el 30 de junio.
  Usa siempre `parseLocalDate()`, `startOfLocalDay()`, `toLocalYMD()` o
  `isTaskOverdue()` (todas en `lang.js`). Nunca `new Date(fecha)` ni
  `.toISOString().slice(0,10)` sobre una fecha civil.
- **HTML**: todo valor que venga del usuario pasa por `esc()` — también dentro de
  atributos (`value="${esc(x)}"`) y en `<option>`. El saneador del backend
  (`convex/projects.ts`) es defensa en profundidad, no un sustituto.
- **Bloqueo optimista**: `_expectedVersion` solo se borra cuando el usuario decide
  explícitamente sobrescribir (modal de conflicto). Borrarlo para "reintentar"
  desactiva la detección de conflictos y pisa el trabajo de otro dispositivo.
- **Diálogos**: nunca `alert()` / `confirm()` / `prompt()`. La app vive en un iframe
  de Wix, donde pueden no mostrarse. Usa `toast()` y `openConfirmModal()`.
- **Idioma**: nada de texto en un solo idioma en la UI. Usa `t('clave')` (y añade la
  clave a los DOS bloques de `TRANSLATIONS`) o `LANG==='es'?'…':'…'`.
- **Identidad**: `wixUserId` en el backend significa **tenant**, no "usuario de Wix".
  Nunca lo derives del cliente: siempre sale de `requireAuth(ctx)`, que lo resuelve
  desde el JWT verificado. Añadir una función nueva a Convex significa envolverla en
  `authedQuery`/`authedMutation`, nunca leer un id que venga en los argumentos.

## Deployment & Data Safety Rules

- **Cache-busting**: When deploying, bump the `?v=` query string on all `<script>`/`<link>` tags in `index.html` AND update `buildVersion` in `app-config.js`. This forces browsers to fetch fresh files. `chair-images.js` se versiona solo: usa `buildVersion` desde `ensureChairImages()`.
- **Backend backward compatibility**: Never add required fields to Convex mutations that the current frontend doesn't send. New fields must be optional with sensible defaults. Never rename or remove an existing Convex function — add a new one and deprecate the old.
- **Deploy order**: Deploy backend first (must be backward-compatible), then frontend with cache-busting bump.
- **Variables de entorno de Convex**: `CLERK_JWT_ISSUER_DOMAIN` es obligatoria. Sin ella, `auth.config.ts` no valida ningún token y nadie puede entrar.
- **Data versioning**: Projects carry a `_dataVersion` field (stamped by `prepareProjectForSave` in `app-data.js`). When changing the project data shape, increment `CURRENT_DATA_VERSION` and add migration logic in `core.js` (see `migrateBase64Images` for the pattern).

## Additional Documentation

Check these files when working on the relevant areas:

| Topic | File |
|-------|------|
| Architecture & design patterns | [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) |

## Protocolo de tracking (plataforma Cuadra)

> Agregado el 2026-08-04, cuando la fuente de verdad del avance pasó de
> `status.json` a la plataforma.

- ⚠️ La fuente de verdad del avance es la **plataforma Cuadra** (tabla
  `proyectos` en Convex), NO `status.json`. Este repo conserva su
  `status.json` como espejo legible en git — actualízalo igual — pero el dato
  que cuenta es el que reportas.
- Al cerrar cada sesión: actualiza `status.json` y luego corre
  `node scripts/actualizar-estado.mjs`. Si falla por falta de `CUADRA_URL` /
  `CUADRA_TOKEN`, avísale al dueño: sin ese reporte el dashboard central queda
  desactualizado.
- Estados válidos para módulos: `pendiente`, `en_progreso`, `completado`,
  `no_aplica`.
- Estados válidos para `estado_general`: `propuesta`, `en_desarrollo`,
  `en_revision`, `entregado`, `mantenimiento`, `pausado`.
- Mantén el JSON válido siempre.
