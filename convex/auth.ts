import { action, mutation, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * ─── Identidad (Clerk) ────────────────────────────────────────────────────────
 *
 * Antes: la pagina padre de Wix mandaba un JWT por postMessage, este archivo
 * verificaba la firma HMAC contra WIX_APP_SECRET y emitia un `sessionToken`
 * propio que viajaba como argumento en cada llamada.
 *
 * Ahora: el cliente manda el JWT de Clerk en la cabecera `Authorization: Bearer`.
 * Convex verifica la firma contra `auth.config.ts` y nos entrega la identidad ya
 * validada.  Ni emitimos ni almacenamos sesiones — eso es trabajo de Clerk.
 *
 * ─── El concepto de "tenant" ──────────────────────────────────────────────────
 *
 * Todas las tablas de datos particionan por un campo llamado `wixUserId`.  Ese
 * nombre es historico: hoy significa "id del inquilino" y nada mas.
 *
 *   - Usuario nuevo        → tenantId = subject de Clerk. Sin fila en `identities`.
 *   - Cliente heredado     → tenantId = su wixUserId de siempre, resuelto por la
 *                            fila de `identities` que se crea en su primer login.
 *
 * Asi ningun documento existente se reescribe y la migracion es reversible:
 * basta borrar o corregir una fila de `identities`.
 */

export type Identity = {
  subject: string;
  email?: string;
  name?: string;
};

/** Lee la identidad verificada por Convex, o lanza. */
async function requireIdentity(ctx: any): Promise<Identity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: no valid session. Sign in again.");
  }
  return {
    subject: identity.subject,
    email: (identity.email || identity.emailAddress || undefined) as string | undefined,
    name: (identity.name || identity.givenName || undefined) as string | undefined,
  };
}

/**
 * Resuelve el tenantId del usuario que llama.
 *
 * Solo lee: se puede usar desde queries.  El enlace de los clientes heredados lo
 * crea `ensureIdentity` (mutation) al arrancar la app, antes de cualquier query.
 */
export async function requireAuth(ctx: { db: any; auth: any }): Promise<string> {
  const identity = await requireIdentity(ctx);
  const link = await ctx.db
    .query("identities")
    .withIndex("by_subject", (q: any) => q.eq("subject", identity.subject))
    .unique();
  return link ? link.tenantId : identity.subject;
}

/**
 * Punto de entrada de la app: se llama una vez tras iniciar sesion.
 *
 * 1. Si ya existe el enlace, lo devuelve.
 * 2. Si no, busca en `legacy_links` por email — es el caso de un cliente que
 *    venia de Wix y acaba de registrarse en Clerk — y crea el enlace.
 * 3. Si no hay nada, es un usuario nuevo: tenantId = su propio subject.
 *
 * Devuelve el perfil que la interfaz necesita para pintar la cabecera.
 */
export const ensureIdentity = mutation({
  args: {},
  returns: v.object({
    tenantId: v.string(),
    subject: v.string(),
    email: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
    linkedLegacy: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const email = (identity.email || "").trim().toLowerCase();

    const existing = await ctx.db
      .query("identities")
      .withIndex("by_subject", (q: any) => q.eq("subject", identity.subject))
      .unique();

    if (existing) {
      // Mantener el email al dia por si lo cambio en Clerk.
      if (email && existing.email !== email) {
        await ctx.db.patch(existing._id, { email });
      }
      return {
        tenantId: existing.tenantId,
        subject: identity.subject,
        email: identity.email ?? null,
        name: identity.name ?? null,
        linkedLegacy: existing.linkedFrom === "legacy",
      };
    }

    let tenantId = identity.subject;
    let linkedFrom = "new";

    if (email) {
      const pending = await ctx.db
        .query("legacy_links")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();
      // Un mapeo solo se puede reclamar una vez.
      if (pending && !pending.claimedAt) {
        tenantId = pending.tenantId;
        linkedFrom = "legacy";
        await ctx.db.patch(pending._id, {
          claimedAt: Date.now(),
          claimedBy: identity.subject,
        });
      }
    }

    await ctx.db.insert("identities", {
      subject: identity.subject,
      tenantId,
      email: email || undefined,
      linkedAt: Date.now(),
      linkedFrom,
    });

    return {
      tenantId,
      subject: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
      linkedLegacy: linkedFrom === "legacy",
    };
  },
});

// ─── Enlace automático por cuenta de Google ──────────────────────────────────
//
// Los tenants heredados de Wix son, en su mayoría, IDs de cuenta de Google (el
// login de la página anterior era "entrar con Google").  Si la misma persona entra
// ahora con Google en Clerk, podemos reconocerla por ese mismo identificador y
// devolverle sus datos SIN que nadie tenga que mapear correos a mano.
//
// El identificador NO puede venir del navegador — eso permitiría a cualquiera
// reclamar el espacio de otro escribiendo su ID.  Se obtiene llamando a la API de
// Clerk desde el servidor, usando el `subject` ya verificado del JWT.

export const getLinkBySubject = internalQuery({
  args: { subject: v.string() },
  returns: v.union(v.null(), v.object({ tenantId: v.string(), linkedFrom: v.union(v.string(), v.null()) })),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("identities")
      .withIndex("by_subject", (q: any) => q.eq("subject", args.subject))
      .unique();
    return link ? { tenantId: link.tenantId, linkedFrom: link.linkedFrom ?? null } : null;
  },
});

/**
 * Crea el enlace de una cuenta nueva, eligiendo tenant en este orden:
 *   1. Un `candidateId` (ID de proveedor social) que ya sea dueño de proyectos.
 *   2. Un mapeo manual por email en `legacy_links`.
 *   3. Su propio subject de Clerk (usuario nuevo).
 *
 * Un tenant solo se puede reclamar UNA vez: si ya tiene fila en `identities`, se
 * ignora.  Así dos personas no pueden acabar compartiendo los mismos datos.
 */
export const createLinkVerified = internalMutation({
  args: {
    subject: v.string(),
    email: v.optional(v.string()),
    candidateIds: v.array(v.string()),
  },
  returns: v.object({ tenantId: v.string(), linkedFrom: v.string() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("identities")
      .withIndex("by_subject", (q: any) => q.eq("subject", args.subject))
      .unique();
    if (existing) {
      return { tenantId: existing.tenantId, linkedFrom: existing.linkedFrom ?? "new" };
    }

    const email = (args.email || "").trim().toLowerCase();
    let tenantId = args.subject;
    let linkedFrom = "new";

    // 1. ¿Alguno de sus IDs sociales es dueño de proyectos y está libre?
    for (const candidate of args.candidateIds) {
      if (!candidate || candidate === args.subject) continue;
      const owned = await ctx.db
        .query("projects")
        .withIndex("by_wix_user", (q: any) => q.eq("wixUserId", candidate))
        .first();
      if (!owned) continue;
      const taken = await ctx.db
        .query("identities")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", candidate))
        .first();
      if (taken) continue;   // ya lo reclamó otra cuenta
      tenantId = candidate;
      linkedFrom = "google";
      break;
    }

    // 2. Mapeo manual por email (para tenants que no son IDs de Google).
    if (linkedFrom === "new" && email) {
      const pending = await ctx.db
        .query("legacy_links")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();
      if (pending && !pending.claimedAt) {
        tenantId = pending.tenantId;
        linkedFrom = "legacy";
        await ctx.db.patch(pending._id, { claimedAt: Date.now(), claimedBy: args.subject });
      }
    }

    await ctx.db.insert("identities", {
      subject: args.subject,
      tenantId,
      email: email || undefined,
      linkedAt: Date.now(),
      linkedFrom,
    });
    return { tenantId, linkedFrom };
  },
});

/**
 * Punto de entrada de la app.  Sustituye a `ensureIdentity` cuando hay
 * CLERK_SECRET_KEY configurada, porque puede consultar las cuentas sociales.
 */
export const bootstrapIdentity = action({
  args: {},
  returns: v.object({
    tenantId: v.string(),
    subject: v.string(),
    email: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
    linkedLegacy: v.boolean(),
  }),
  handler: async (ctx): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized: no valid session. Sign in again.");
    const subject = identity.subject;
    const email = ((identity.email as string) || "").trim().toLowerCase();
    const name = (identity.name as string) || null;

    const existing = await ctx.runQuery(internal.auth.getLinkBySubject, { subject });
    if (existing) {
      return {
        tenantId: existing.tenantId,
        subject,
        email: (identity.email as string) ?? null,
        name,
        linkedLegacy: existing.linkedFrom === "legacy" || existing.linkedFrom === "google",
      };
    }

    // IDs de las cuentas sociales conectadas, obtenidos del servidor de Clerk.
    const candidateIds: string[] = [];
    const secret = process.env.CLERK_SECRET_KEY;
    if (secret) {
      try {
        const res = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(subject), {
          headers: { Authorization: "Bearer " + secret },
        });
        if (res.ok) {
          const user: any = await res.json();
          for (const acc of user.external_accounts || []) {
            const pid = acc.provider_user_id || acc.providerUserId;
            if (pid) candidateIds.push(String(pid));
          }
        } else {
          console.warn("EventOS auth: Clerk API respondió " + res.status + " al leer cuentas externas");
        }
      } catch (e) {
        console.warn("EventOS auth: no se pudieron leer las cuentas externas de Clerk", e);
      }
    } else {
      console.warn(
        "EventOS auth: CLERK_SECRET_KEY no está configurada — el enlace automático " +
          "de los clientes heredados de Google no puede funcionar.",
      );
    }

    const created = await ctx.runMutation(internal.auth.createLinkVerified, {
      subject,
      email: email || undefined,
      candidateIds,
    });

    return {
      tenantId: created.tenantId,
      subject,
      email: (identity.email as string) ?? null,
      name,
      linkedLegacy: created.linkedFrom === "legacy" || created.linkedFrom === "google",
    };
  },
});

/** Perfil del usuario actual, sin efectos secundarios. */
export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      tenantId: v.string(),
      subject: v.string(),
      email: v.union(v.string(), v.null()),
      name: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const tenantId = await requireAuth(ctx);
    return {
      tenantId,
      subject: identity.subject,
      email: (identity.email as string) ?? null,
      name: (identity.name as string) ?? null,
    };
  },
});

// ─── Limpieza de la tabla `sessions` deprecada ───────────────────────────────
// Se conserva mientras queden filas del esquema anterior.  El cron la vacia sola;
// cuando `sessions` este a cero se pueden borrar tabla, cron y esta funcion.

export const cleanupExpiredSessions = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();
    await Promise.all(expired.map((s) => ctx.db.delete(s._id)));
    return null;
  },
});
