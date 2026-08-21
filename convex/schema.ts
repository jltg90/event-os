import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    wixUserId: v.string(),
    projectId: v.string(),
    data: v.any(),
    updatedAt: v.number(),
    // ⚠️ FUNCION DE COMPARTIR NO IMPLEMENTADA.
    // Estos dos campos y el indice by_share_token quedaron de un diseno que nunca
    // se termino: no existe ninguna funcion que lea por shareToken, ni UI que los
    // escriba (window._shareMode se lee pero nunca se asigna).  Se conservan porque
    // quitar campos opcionales del esquema rompe la lectura de documentos que ya los
    // tengan.  Al implementar el compartir publico, la query correspondiente NO debe
    // usar requireAuth (es acceso anonimo por token) y debe devolver solo campos
    // seguros — nunca el blob completo del proyecto.
    shareToken: v.optional(v.string()),
    shareEnabled: v.optional(v.boolean()),
  })
    .index("by_wix_user", ["wixUserId"])
    .index("by_wix_user_project", ["wixUserId", "projectId"])
    .index("by_wix_user_updated", ["wixUserId", "updatedAt"])
    .index("by_share_token", ["shareToken"]),

  // ⚠️ DEPRECADA (migracion a Clerk, 2026-08-20).
  // Ya no se escribe: las sesiones las gestiona Clerk.  Se conserva la definicion
  // porque todavia puede haber filas; el cron `cleanup expired sessions` la vacia
  // sola en 24 h y despues se puede borrar tabla + cron en un deploy posterior.
  sessions: defineTable({
    sessionToken: v.string(),
    wixUserId: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["sessionToken"])
    .index("by_user", ["wixUserId"]),

  // ─── Identidad ──────────────────────────────────────────────────────────────
  //
  // `tenantId` es la llave de particion de TODOS los datos (el campo que en las
  // demas tablas se sigue llamando `wixUserId` por razones historicas).
  //
  // Para un usuario nuevo, tenantId === subject de Clerk y NO hace falta fila aqui.
  // Esta tabla existe solo para los clientes heredados de Wix: enlaza su cuenta de
  // Clerk con el wixUserId bajo el que ya viven sus proyectos, sin tener que
  // reescribir un solo documento.
  identities: defineTable({
    subject: v.string(),          // id de usuario de Clerk (user_2ab...)
    tenantId: v.string(),         // valor historico de wixUserId
    email: v.optional(v.string()),
    linkedAt: v.number(),
    linkedFrom: v.optional(v.string()),  // "legacy" | "new"
  })
    .index("by_subject", ["subject"])
    .index("by_tenant", ["tenantId"]),

  // Mapeos pendientes cargados por el dueno ANTES de que el cliente se registre.
  // En su primer login se busca por email, se crea la fila de `identities` y esta
  // se marca como consumida.
  legacy_links: defineTable({
    email: v.string(),            // siempre en minusculas
    tenantId: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    claimedAt: v.optional(v.number()),
    claimedBy: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_tenant", ["tenantId"]),

  // Tracks which user uploaded each file — used for ownership checks on access/deletion.
  file_ownership: defineTable({
    storageId: v.string(),
    wixUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_storage_id", ["storageId"])
    .index("by_user", ["wixUserId"]),

  // Companion documents for projects whose main record would exceed Convex's 1 MB limit.
  // Stores large arrays (guests, layoutItems, savedLayouts, layouts) separately.
  // Created automatically when upsertProject detects the document exceeds 700 KB.
  project_extras: defineTable({
    projectId: v.string(),
    wixUserId: v.string(),
    guests: v.any(),
    layoutItems: v.any(),
    savedLayouts: v.any(),
    layouts: v.optional(v.any()),
    vendors: v.optional(v.any()),
    moodboard: v.optional(v.any()),
    eventLayouts: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_wix_user_project", ["wixUserId", "projectId"]),
});
