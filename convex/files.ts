import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";
import { collectStorageIds } from "./projects";

/**
 * Devuelve el registro de propiedad de un archivo, o null si no existe.
 *
 * IMPORTANTE: la version anterior interpretaba "sin registro" como "permitido"
 * (los archivos legacy no tenian fila en file_ownership).  Eso permitia a
 * cualquier usuario autenticado LEER y sobre todo BORRAR archivos ajenos.
 * Ahora la ausencia de registro deniega, y los archivos legacy se reclaman con
 * `claimOwnership`, que verifica contra los proyectos del propio usuario.
 */
async function findOwnership(ctx: any, storageId: string) {
  return await ctx.db
    .query("file_ownership")
    .withIndex("by_storage_id", (q: any) => q.eq("storageId", storageId))
    .unique();
}

async function isOwner(ctx: any, wixUserId: string, storageId: string): Promise<boolean> {
  const ownership = await findOwnership(ctx, storageId);
  return !!ownership && ownership.wixUserId === wixUserId;
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx);
    // null en vez de throw: la UI degrada mostrando un hueco, no una pantalla rota.
    if (!(await isOwner(ctx, wixUserId, args.storageId as string))) return null;
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const getFileUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.array(v.union(v.string(), v.null())),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx);
    return await Promise.all(
      args.storageIds.map(async (id) => {
        if (!(await isOwner(ctx, wixUserId, id as string))) return null;
        return ctx.storage.getUrl(id);
      }),
    );
  },
});

export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx);
    const ownership = await findOwnership(ctx, args.storageId as string);
    if (!ownership || ownership.wixUserId !== wixUserId) {
      throw new Error("Forbidden: file not owned by user");
    }
    try {
      await ctx.storage.delete(args.storageId);
    } catch (e) {
      // Ya no existe: seguimos para limpiar el registro huerfano.
    }
    await ctx.db.delete(ownership._id);
    return null;
  },
});

/**
 * Descarta una subida recien hecha que nunca llego a validarse.
 *
 * Solo borra archivos SIN dueno y creados hace menos de 10 minutos: asi limpia los
 * huerfanos reales sin abrir la puerta a borrar archivos legacy ajenos por id.
 */
const DISCARD_WINDOW_MS = 10 * 60 * 1000;

export const discardUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const ownership = await findOwnership(ctx, args.storageId as string);
    if (ownership) return false;
    const meta: any = await ctx.storage.getMetadata(args.storageId);
    if (!meta) return false;
    if (Date.now() - meta._creationTime > DISCARD_WINDOW_MS) return false;
    try {
      await ctx.storage.delete(args.storageId);
    } catch (e) {
      return false;
    }
    return true;
  },
});

const MAX_CLAIM_IDS = 500;
const MAX_DOCS_SCANNED = 60;

/**
 * Reclama la propiedad de archivos subidos antes de que existiera `file_ownership`.
 *
 * Solo concede la propiedad de un id si ese id aparece realmente dentro de los
 * documentos del propio usuario (projects / project_extras).  Asi el endurecimiento
 * del control de acceso no rompe las imagenes antiguas, y nadie puede apropiarse
 * de un archivo ajeno adivinando su id.
 */
export const claimOwnership = mutation({
  args: { storageIds: v.array(v.string()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx);
    const wanted = args.storageIds.filter(Boolean).slice(0, MAX_CLAIM_IDS);
    if (!wanted.length) return 0;

    // Solo hace falta mirar los ids que aun no tienen dueno.
    const unowned: string[] = [];
    for (const id of wanted) {
      const ownership = await findOwnership(ctx, id);
      if (!ownership) unowned.push(id);
    }
    if (!unowned.length) return 0;

    const referenced = new Set<string>();
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q: any) => q.eq("wixUserId", wixUserId))
      .take(MAX_DOCS_SCANNED);
    for (const doc of projects) collectStorageIds(doc.data, referenced);

    const extras = await ctx.db
      .query("project_extras")
      .withIndex("by_wix_user_project", (q: any) => q.eq("wixUserId", wixUserId))
      .take(MAX_DOCS_SCANNED);
    for (const doc of extras) {
      collectStorageIds(doc.guests, referenced);
      collectStorageIds(doc.vendors, referenced);
      collectStorageIds(doc.moodboard, referenced);
      collectStorageIds(doc.layouts, referenced);
      collectStorageIds(doc.savedLayouts, referenced);
      collectStorageIds(doc.layoutItems, referenced);
      collectStorageIds(doc.eventLayouts, referenced);
    }

    let claimed = 0;
    const now = Date.now();
    for (const id of unowned) {
      if (!referenced.has(id)) continue;
      await ctx.db.insert("file_ownership", { storageId: id, wixUserId, createdAt: now });
      claimed++;
    }
    return claimed;
  },
});

// image/svg+xml se mantiene a proposito: es un formato legitimo para planos.
// Es seguro porque la app SOLO lo renderiza dentro de <img>, donde el navegador
// deshabilita scripts.  Si algun dia se embebe con <object>/<iframe>/inline,
// hay que quitarlo de esta lista o sanear el SVG antes de servirlo.
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const validateUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.object({ valid: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx);
    const meta = await ctx.storage.getMetadata(args.storageId);
    if (!meta) {
      return { valid: false, reason: "File not found" };
    }
    if (meta.size > MAX_FILE_BYTES) {
      await ctx.storage.delete(args.storageId);
      return { valid: false, reason: "File too large (max 10 MB)" };
    }
    const mime = (meta.contentType || "").toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mime)) {
      await ctx.storage.delete(args.storageId);
      return { valid: false, reason: "File type not allowed: " + mime };
    }
    // Record file ownership for access control
    await ctx.db.insert("file_ownership", {
      storageId: args.storageId as string,
      wixUserId,
      createdAt: Date.now(),
    });
    return { valid: true };
  },
});
