import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

// ─── Runtime validation for project data ──────────────────────────────────────

const MAX_PROJECT_BYTES = 950_000; // ~950 KB
const MAX_NESTING_DEPTH = 12;
const MAX_STRING_LENGTH = 500_000; // 500 KB per string field

function validateProjectData(data: unknown): void {
  const json = JSON.stringify(data);
  if (json.length > MAX_PROJECT_BYTES) {
    throw new Error("Project data too large. Please remove some content and try again.");
  }
  checkDepthAndStrings(data, 0);
  // Strip HTML from user-facing string fields to prevent stored XSS
  if (data && typeof data === "object") {
    sanitizeStrings(data as Record<string, unknown>);
  }
}

/**
 * Limpia HTML peligroso de TODOS los strings alcanzables desde el blob del proyecto.
 *
 * Defensa en profundidad: el frontend escapa con esc() al renderizar, pero esto cubre
 * los sitios que se olviden.  Respecto a la version anterior arregla dos huecos:
 *  - los strings sueltos dentro de arrays no se saneaban (solo los objetos);
 *  - los handlers on* SIN comillas pasaban intactos (`<img src=x onerror=alert(1)>`).
 */
const SCRIPT_RE = /<script[\s>][\s\S]*?<\/script>/gi;
const IFRAME_RE = /<iframe[\s>][\s\S]*?<\/iframe>/gi;
const ON_ATTR_QUOTED_RE = /\son\w+\s*=\s*(["'])[\s\S]*?\1/gi;
const ON_ATTR_BARE_RE = /\son\w+\s*=\s*[^\s"'>]+/gi;
const JS_URL_RE = /(href|src|xlink:href)\s*=\s*(["']?)\s*javascript:/gi;

function sanitizeString(val: string): string {
  // Las data: URLs (imagenes base64) se dejan intactas: los regex nunca aciertan ahi
  // y recorrer cientos de KB por cada guardado es caro.
  if (val.length > 256 && val.startsWith("data:")) return val;
  return val
    .replace(SCRIPT_RE, "")
    .replace(IFRAME_RE, "")
    .replace(ON_ATTR_QUOTED_RE, "")
    .replace(ON_ATTR_BARE_RE, "")
    .replace(JS_URL_RE, "$1=$2");
}

function sanitizeStrings(node: unknown): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const item = node[i];
      if (typeof item === "string") node[i] = sanitizeString(item);
      else if (item && typeof item === "object") sanitizeStrings(item);
    }
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string") obj[key] = sanitizeString(val);
      else if (val && typeof val === "object") sanitizeStrings(val);
    }
  }
}

function checkDepthAndStrings(val: unknown, depth: number): void {
  if (depth > MAX_NESTING_DEPTH) {
    throw new Error("Project data is too deeply nested (max " + MAX_NESTING_DEPTH + " levels).");
  }
  if (typeof val === "string") {
    if (val.length > MAX_STRING_LENGTH) {
      throw new Error("A text field in the project exceeds the maximum allowed length.");
    }
    return;
  }
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      checkDepthAndStrings(val[i], depth + 1);
    }
    return;
  }
  if (val && typeof val === "object") {
    const keys = Object.keys(val as Record<string, unknown>);
    for (let i = 0; i < keys.length; i++) {
      checkDepthAndStrings((val as Record<string, unknown>)[keys[i]], depth + 1);
    }
  }
}

// Auth wrapper helpers — reduce boilerplate across handlers
// `wixUserId` en estas firmas es el TENANT del usuario que llama.  El nombre es
// historico (ver convex/auth.ts); ya no tiene nada que ver con Wix.
// La identidad llega en la cabecera Authorization, no como argumento: por eso ya
// no hay `sessionToken` en los args.
function authedQuery<Args extends Record<string, any>, Returns>(config: {
  args: Args;
  returns: any;
  handler: (ctx: any, wixUserId: string, args: any) => Promise<Returns>;
}) {
  return query({
    args: { ...config.args },
    returns: config.returns,
    handler: async (ctx: any, args: any) => {
      const wixUserId = await requireAuth(ctx);
      return config.handler(ctx, wixUserId, args);
    },
  });
}

function authedMutation<Args extends Record<string, any>, Returns>(config: {
  args: Args;
  returns: any;
  handler: (ctx: any, wixUserId: string, args: any) => Promise<Returns>;
}) {
  return mutation({
    args: { ...config.args },
    returns: config.returns,
    handler: async (ctx: any, args: any) => {
      const wixUserId = await requireAuth(ctx);
      return config.handler(ctx, wixUserId, args);
    },
  });
}

export const getProjectsByWixUserId = authedQuery({
  args: {},
  returns: v.array(
    v.object({
      projectId: v.string(),
      data: v.any(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, wixUserId) => {
    const docs = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q: any) => q.eq("wixUserId", wixUserId))
      .collect();

    return docs.map((doc: any) => ({
      projectId: doc.projectId,
      data: doc.data,
      updatedAt: doc.updatedAt,
    }));
  },
});

// Paginated project listing — returns up to `limit` projects, ordered by updatedAt desc.
// Pass `cursor` from a previous response to get the next page. Returns isDone when no more.
export const getProjectsPaginated = authedQuery({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    projects: v.array(
      v.object({
        projectId: v.string(),
        data: v.any(),
        updatedAt: v.number(),
      }),
    ),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, wixUserId, args) => {
    const pageSize = Math.min(args.limit || 25, 100);
    const result = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_updated", (q: any) => q.eq("wixUserId", wixUserId))
      .order("desc")
      .paginate({ numItems: pageSize, cursor: args.cursor || null });

    return {
      projects: result.page.map((doc: any) => ({
        projectId: doc.projectId,
        data: doc.data,
        updatedAt: doc.updatedAt,
      })),
      cursor: result.continueCursor ?? null,
      isDone: result.isDone,
    };
  },
});

export const upsertProject = authedMutation({
  args: {
    project: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, wixUserId, args) => {
    const projectId = String(args.project && args.project.id ? args.project.id : "");
    if (!projectId) {
      throw new Error("Project is missing an id");
    }

    validateProjectData(args.project);

    const now = Date.now();
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_project", (q: any) =>
        q.eq("wixUserId", wixUserId).eq("projectId", projectId),
      )
      .unique();

    if (existing) {
      // Optimistic locking: if client sends _expectedVersion in the data blob, reject on mismatch
      const expectedVersion = args.project?._expectedVersion;
      if (expectedVersion != null && expectedVersion !== existing.updatedAt) {
        throw new Error("__conflict__");
      }
      await ctx.db.patch(existing._id, {
        data: args.project,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("projects", {
        wixUserId,
        projectId,
        data: args.project,
        updatedAt: now,
      });
    }

    return null;
  },
});

// Recorre un blob de proyecto y junta todos los ids de Convex Storage a los que
// apunta (imagenes de moodboard, recibos de pago, planos).  Generico a proposito:
// cualquier campo con uno de estos nombres queda cubierto sin tocar esta funcion.
const STORAGE_ID_KEYS = new Set(["storageId", "receiptStorageId", "_storageId"]);
const MAX_FILES_PER_DELETE = 500;

export function collectStorageIds(node: unknown, out: Set<string>, depth = 0): void {
  if (depth > 20 || out.size >= 5000) return;
  if (Array.isArray(node)) {
    for (const item of node) collectStorageIds(item, out, depth + 1);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string" && STORAGE_ID_KEYS.has(key) && val) out.add(val);
      else if (val && typeof val === "object") collectStorageIds(val, out, depth + 1);
    }
  }
}

/**
 * Borra archivos + su registro de ownership.  Tolerante a ids ya inexistentes.
 *
 * `allowUnowned` solo se activa desde deleteProject, donde los ids salieron del
 * propio documento del usuario y por tanto son demostrablemente suyos aunque sean
 * legacy (subidos antes de que existiera file_ownership).  Desde una llamada
 * publica NUNCA se permite: seria un IDOR para borrar archivos ajenos por id.
 */
async function deleteStorageIds(
  ctx: any,
  wixUserId: string,
  ids: Set<string>,
  allowUnowned = false,
): Promise<number> {
  let deleted = 0;
  for (const id of ids) {
    const ownership = await ctx.db
      .query("file_ownership")
      .withIndex("by_storage_id", (q: any) => q.eq("storageId", id))
      .unique();
    if (ownership) {
      if (ownership.wixUserId !== wixUserId) continue;
    } else if (!allowUnowned) {
      continue;
    }
    try {
      await ctx.storage.delete(id as any);
      deleted++;
    } catch (e) {
      // El archivo ya no existe: no es motivo para abortar el borrado del proyecto.
    }
    if (ownership) await ctx.db.delete(ownership._id);
  }
  return deleted;
}

export const deleteProject = authedMutation({
  args: {
    projectId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, wixUserId, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_project", (q: any) =>
        q.eq("wixUserId", wixUserId).eq("projectId", args.projectId),
      )
      .unique();

    // El documento companion DEBE morir con el proyecto.  Si sobrevive y el usuario
    // vuelve a crear un proyecto con el mismo id, _mergeProjectExtras le inyectaria
    // los invitados y planos del proyecto borrado.
    const extras = await ctx.db
      .query("project_extras")
      .withIndex("by_wix_user_project", (q: any) =>
        q.eq("wixUserId", wixUserId).eq("projectId", args.projectId),
      )
      .unique();

    // Archivos referenciados por el proyecto: sin esto quedan huerfanos para siempre.
    const ids = new Set<string>();
    if (existing) collectStorageIds(existing.data, ids);
    if (extras) {
      collectStorageIds(extras.guests, ids);
      collectStorageIds(extras.vendors, ids);
      collectStorageIds(extras.moodboard, ids);
      collectStorageIds(extras.layouts, ids);
      collectStorageIds(extras.savedLayouts, ids);
      collectStorageIds(extras.layoutItems, ids);
      collectStorageIds(extras.eventLayouts, ids);
    }
    if (ids.size) await deleteStorageIds(ctx, wixUserId, ids, true);

    if (extras) await ctx.db.delete(extras._id);
    if (existing) await ctx.db.delete(existing._id);

    return null;
  },
});

// Borra un conjunto explicito de archivos que el cliente acaba de quitar del
// proyecto (por ejemplo, al eliminar una carpeta completa de moodboard).
export const deleteFilesForProject = authedMutation({
  args: {
    storageIds: v.array(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, wixUserId, args) => {
    const ids = new Set<string>(args.storageIds.filter(Boolean).slice(0, MAX_FILES_PER_DELETE));
    if (!ids.size) return 0;
    return await deleteStorageIds(ctx, wixUserId, ids);
  },
});

export const getChangedProjectIds = authedQuery({
  args: {
    since: v.number(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, wixUserId, args) => {
    const docs = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_updated", (q: any) =>
        q.eq("wixUserId", wixUserId).gt("updatedAt", args.since),
      )
      .collect();

    return docs.map((doc: any) => doc.projectId);
  },
});

export const getProjectMetaByWixUserId = authedQuery({
  args: {},
  returns: v.array(
    v.object({
      projectId: v.string(),
      data: v.any(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, wixUserId) => {
    const docs = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q: any) => q.eq("wixUserId", wixUserId))
      .collect();

    return docs.map((doc: any) => {
      const d: any = doc.data || {};
      return {
        projectId: doc.projectId,
        data: {
          id: doc.projectId,
          name: d.name || "",
          clientName: d.clientName || "",
          date: d.date || "",
          location: d.location || "",
          type: d.type || "",
          status: d.status || "",
          budget: d.budget || 0,
          description: d.description || "",
          tasks: d.tasks || [],
          share: d.share || null,
          _seeded: d._seeded || false,
          _metaOnly: true,
        },
        updatedAt: doc.updatedAt,
      };
    });
  },
});

export const getProjectById = authedQuery({
  args: {
    projectId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      projectId: v.string(),
      data: v.any(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, wixUserId, args) => {
    const doc = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_project", (q: any) =>
        q.eq("wixUserId", wixUserId).eq("projectId", args.projectId),
      )
      .unique();

    if (!doc) return null;
    return {
      projectId: doc.projectId,
      data: doc.data,
      updatedAt: doc.updatedAt,
    };
  },
});

// ─── Project extras (companion documents for large projects) ─────────────────

export const getProjectExtras = authedQuery({
  args: {
    projectId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      guests: v.any(),
      layoutItems: v.any(),
      savedLayouts: v.any(),
      layouts: v.optional(v.any()),
      vendors: v.optional(v.any()),
      moodboard: v.optional(v.any()),
      eventLayouts: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, wixUserId, args) => {
    const doc = await ctx.db
      .query("project_extras")
      .withIndex("by_wix_user_project", (q: any) =>
        q.eq("wixUserId", wixUserId).eq("projectId", args.projectId),
      )
      .unique();
    if (!doc) return null;
    // vendors/moodboard/eventLayouts are split into extras for large projects (see
    // app-data.js upsertProject) — they MUST be returned here or they are lost on reload.
    return {
      guests: doc.guests,
      layoutItems: doc.layoutItems,
      savedLayouts: doc.savedLayouts,
      layouts: doc.layouts ?? undefined,
      vendors: doc.vendors ?? undefined,
      moodboard: doc.moodboard ?? undefined,
      eventLayouts: doc.eventLayouts ?? undefined,
    };
  },
});

export const upsertProjectExtras = authedMutation({
  args: {
    projectId: v.string(),
    extras: v.object({
      guests: v.any(),
      layoutItems: v.any(),
      savedLayouts: v.any(),
      layouts: v.optional(v.any()),
      vendors: v.optional(v.any()),
      moodboard: v.optional(v.any()),
      eventLayouts: v.optional(v.any()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, wixUserId, args) => {
    validateProjectData(args.extras);

    const existing = await ctx.db
      .query("project_extras")
      .withIndex("by_wix_user_project", (q: any) =>
        q.eq("wixUserId", wixUserId).eq("projectId", args.projectId),
      )
      .unique();
    const now = Date.now();
    const patch: Record<string, unknown> = {
      guests: args.extras.guests,
      layoutItems: args.extras.layoutItems,
      savedLayouts: args.extras.savedLayouts,
      updatedAt: now,
    };
    if (args.extras.layouts !== undefined) {
      patch.layouts = args.extras.layouts;
    }
    if (args.extras.vendors !== undefined) {
      patch.vendors = args.extras.vendors;
    }
    if (args.extras.moodboard !== undefined) {
      patch.moodboard = args.extras.moodboard;
    }
    if (args.extras.eventLayouts !== undefined) {
      patch.eventLayouts = args.extras.eventLayouts;
    }
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("project_extras", {
        projectId: args.projectId,
        wixUserId,
        ...patch,
      } as any);
    }
    return null;
  },
});

