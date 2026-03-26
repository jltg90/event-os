# EventOS — Claude Context

## Project Overview

EventOS is a multi-feature event planning SaaS for event professionals. Users create and manage events with budget tracking, vendor management, task timelines, guest lists, floor plan design, moodboards, and PDF exports. Authentication is provided by Wix; data is stored in Convex Cloud.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES2015+), no framework |
| Styling | Single `styles.css` with CSS custom properties |
| Backend | Convex (serverless DB + functions), TypeScript |
| Auth | Wix user ID (passed from Wix embedding context) |
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
├── lang.js                       i18n (EN/ES) via window.TRANSLATIONS + t()
├── styles.css                    All CSS; variables at :root
└── convex/
    ├── schema.ts                 Database schema (single `projects` table)
    └── projects.ts               4 Convex functions: get, upsert, delete, getByToken
```

## Build & Dev Commands

```bash
# Start Convex local dev server (watches convex/ and regenerates _generated/)
npm run convex:dev      # alias for: npx convex dev

# Deploy backend to Convex Cloud
npm run convex:deploy   # alias for: npx convex deploy
```

The frontend requires **no build step** — files are served statically. Convex auto-generates `convex/_generated/` from `schema.ts` and `projects.ts`; never edit those files manually.

## Database

Single table `projects` with a denormalized JSON blob (`data: v.any()`). The entire event object (vendors, tasks, guests, layouts, moodboard) lives inside that blob. See [convex/schema.ts](convex/schema.ts) for indexes.

## Global State Conventions

- `DB.cur` — current Wix user ID (set in `core.js` after auth)
- `LANG` — active locale string (`'en'` / `'es'`)
- `CURRENCY` — active currency config object
- `window.EVENTOS_DATA` — Convex API façade (defined in `app-data.js`)
- `window.EVENTOS_CONFIG` — deployment URLs (defined in `app-config.js`)
- Per-user preferences are persisted to `localStorage` keyed by user ID

## Deployment & Data Safety Rules

- **Cache-busting**: When deploying, bump the `?v=` query string on all `<script>`/`<link>` tags in `index.html` AND update `buildVersion` in `app-config.js`. This forces browsers to fetch fresh files.
- **Backend backward compatibility**: Never add required fields to Convex mutations that the current frontend doesn't send. New fields must be optional with sensible defaults. Never rename or remove an existing Convex function — add a new one and deprecate the old.
- **Deploy order**: Deploy backend first (must be backward-compatible), then frontend with cache-busting bump.
- **Data versioning**: Projects carry a `_dataVersion` field (stamped by `prepareProjectForSave` in `app-data.js`). When changing the project data shape, increment `CURRENT_DATA_VERSION` and add migration logic in `core.js` (see `migrateBase64Images` for the pattern).

## Additional Documentation

Check these files when working on the relevant areas:

| Topic | File |
|-------|------|
| Architecture & design patterns | [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) |
