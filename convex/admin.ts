import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { collectStorageIds } from "./projects";

/**
 * Herramientas de migracion Wix → Clerk.
 *
 * Son `internal*` a proposito: NO son invocables desde el navegador ni desde la
 * HTTP API publica.  Se ejecutan desde el dashboard de Convex (pestana Functions,
 * "Run function") o con `npx convex run --no-push admin:<nombre>`.
 *
 * Flujo previsto:
 *   1. admin:inventory          → ver que tenants existen y de quien es cada uno
 *   2. admin:linkLegacyEmail    → registrar "este email hereda este tenant"
 *   3. el cliente se registra en Clerk con ese email → queda enlazado solo
 *   4. admin:listLinks          → verificar que todos reclamaron su cuenta
 */

const INTERNAL_IDS = ["__library__", "__lib_layout__"];

/**
 * Lista cada tenant con sus proyectos, para poder identificar de quien es cada uno.
 * Solo lectura.
 */
export const inventory = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      tenantId: v.string(),
      projectCount: v.number(),
      lastUpdated: v.number(),
      lastUpdatedISO: v.string(),
      eventNames: v.array(v.string()),
      clientNames: v.array(v.string()),
      linkedTo: v.union(v.string(), v.null()),
      pendingEmail: v.union(v.string(), v.null()),
      tipo: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const docs = await ctx.db.query("projects").collect();

    const byTenant = new Map<string, any>();
    for (const doc of docs) {
      const t = doc.wixUserId;
      if (!byTenant.has(t)) {
        byTenant.set(t, { projectCount: 0, lastUpdated: 0, eventNames: [], clientNames: [] });
      }
      const entry = byTenant.get(t);
      if (INTERNAL_IDS.includes(doc.projectId)) continue;   // no son eventos reales
      entry.projectCount++;
      if (doc.updatedAt > entry.lastUpdated) entry.lastUpdated = doc.updatedAt;
      const d: any = doc.data || {};
      if (d.name && entry.eventNames.length < 10) entry.eventNames.push(String(d.name));
      if (d.clientName && !entry.clientNames.includes(String(d.clientName)) && entry.clientNames.length < 10) {
        entry.clientNames.push(String(d.clientName));
      }
    }

    const identities = await ctx.db.query("identities").collect();
    const pending = await ctx.db.query("legacy_links").collect();

    const out = [];
    for (const [tenantId, e] of byTenant) {
      const link = identities.find((i: any) => i.tenantId === tenantId);
      const pend = pending.find((p: any) => p.tenantId === tenantId && !p.claimedAt);
      // Pista de a qué se enlazará solo: los IDs de 21 dígitos son cuentas de
      // Google (así entraban los usuarios en la versión de Wix) y se reconocen
      // automáticamente al iniciar sesión con Google en Clerk.
      var tipo = "desconocido";
      if (tenantId === "dev_user_local") tipo = "basura (puerta trasera vieja)";
      else if (/^\d{15,25}$/.test(tenantId)) tipo = "Google — se enlaza solo";
      else if (/^[0-9a-f-]{36}$/i.test(tenantId)) tipo = "UUID — requiere linkLegacyEmail";
      else if (tenantId.startsWith("user_")) tipo = "cuenta nueva de Clerk";

      out.push({
        tenantId,
        tipo,
        projectCount: e.projectCount,
        lastUpdated: e.lastUpdated,
        lastUpdatedISO: e.lastUpdated ? new Date(e.lastUpdated).toISOString() : "",
        eventNames: e.eventNames,
        clientNames: e.clientNames,
        linkedTo: link ? (link.email || link.subject) : null,
        pendingEmail: pend ? pend.email : null,
      });
    }
    out.sort((a, b) => b.projectCount - a.projectCount);
    return out;
  },
});

/**
 * Registra que la persona con ese email hereda ese tenant.
 * Cuando se registre en Clerk con ese email, `ensureIdentity` lo enlaza solo.
 */
export const linkLegacyEmail = internalMutation({
  args: {
    email: v.string(),
    tenantId: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Email invalido: " + args.email);

    const tenantExists = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q: any) => q.eq("wixUserId", args.tenantId))
      .first();
    if (!tenantExists) {
      throw new Error(
        "No existe ningun proyecto con tenantId=" + args.tenantId +
        ". Revisa admin:inventory — un tenant mal escrito dejaria al cliente sin sus datos.",
      );
    }

    const already = await ctx.db
      .query("legacy_links")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();
    if (already) {
      if (already.claimedAt) {
        return "Ese email YA reclamo el tenant " + already.tenantId + ". Usa admin:relink si hay que corregirlo.";
      }
      await ctx.db.patch(already._id, { tenantId: args.tenantId, note: args.note });
      return "Mapeo actualizado: " + email + " → " + args.tenantId;
    }

    await ctx.db.insert("legacy_links", {
      email,
      tenantId: args.tenantId,
      note: args.note,
      createdAt: Date.now(),
    });
    return "Mapeo creado: " + email + " → " + args.tenantId;
  },
});

/** Estado de todos los enlaces: quien ya reclamo su cuenta y quien no. */
export const listLinks = internalQuery({
  args: {},
  returns: v.object({
    linked: v.array(v.object({
      subject: v.string(),
      tenantId: v.string(),
      email: v.union(v.string(), v.null()),
      linkedFrom: v.union(v.string(), v.null()),
      linkedAtISO: v.string(),
    })),
    pending: v.array(v.object({
      email: v.string(),
      tenantId: v.string(),
      note: v.union(v.string(), v.null()),
      claimed: v.boolean(),
    })),
  }),
  handler: async (ctx) => {
    const identities = await ctx.db.query("identities").collect();
    const links = await ctx.db.query("legacy_links").collect();
    return {
      linked: identities.map((i: any) => ({
        subject: i.subject,
        tenantId: i.tenantId,
        email: i.email ?? null,
        linkedFrom: i.linkedFrom ?? null,
        linkedAtISO: new Date(i.linkedAt).toISOString(),
      })),
      pending: links.map((l: any) => ({
        email: l.email,
        tenantId: l.tenantId,
        note: l.note ?? null,
        claimed: !!l.claimedAt,
      })),
    };
  },
});

/**
 * Mueve TODOS los proyectos de un tenant a otro.
 *
 * Sirve para consolidar cuentas dispersas: si la misma persona acabó con varios
 * tenants (porque Wix cambió de esquema de IDs, o porque entró con distintas
 * cuentas de Google), esto los junta en uno solo.
 *
 * Qué mueve: los proyectos, su documento companion `project_extras`, y la
 * propiedad de los archivos a los que apuntan — sin esto último, las imágenes
 * dejarían de verse tras la fusión.
 *
 * Qué NO mueve: los pseudo-proyectos internos (`__library__`, `__lib_layout__`,
 * `__feedback__`) cuando el destino ya tiene el suyo, porque solo puede haber uno
 * por usuario y duplicarlos rompería las consultas. Se informan en el resultado
 * para que decidas a mano.
 */
export const mergeTenants = internalMutation({
  args: {
    fromTenantId: v.string(),
    toTenantId: v.string(),
    dryRun: v.optional(v.boolean()),
    // Si se indica, solo se mueven estos projectId.  Sirve para dejar atrás los
    // pseudo-proyectos internos (__feedback__, __lib_layout__) y las pruebas, que
    // si no aparecerían como eventos sueltos en la lista del usuario.
    onlyProjectIds: v.optional(v.array(v.string())),
  },
  returns: v.object({
    dryRun: v.boolean(),
    moved: v.array(v.string()),
    skipped: v.array(v.string()),
    extrasMoved: v.number(),
    filesReassigned: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.fromTenantId === args.toTenantId) {
      throw new Error("El origen y el destino son el mismo tenant.");
    }
    const dryRun = args.dryRun !== false;   // por defecto simula, hay que pedir dryRun:false

    const source = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q: any) => q.eq("wixUserId", args.fromTenantId))
      .collect();
    if (!source.length) throw new Error("El tenant origen no tiene proyectos: " + args.fromTenantId);

    const dest = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q: any) => q.eq("wixUserId", args.toTenantId))
      .collect();
    const destIds = new Set(dest.map((d: any) => d.projectId));

    const moved: string[] = [];
    const skipped: string[] = [];
    let extrasMoved = 0;
    let filesReassigned = 0;

    const only = args.onlyProjectIds && args.onlyProjectIds.length
      ? new Set(args.onlyProjectIds)
      : null;

    for (const doc of source) {
      if (only && !only.has(doc.projectId)) {
        skipped.push(doc.projectId + " (fuera de onlyProjectIds)");
        continue;
      }
      if (destIds.has(doc.projectId)) {
        skipped.push(doc.projectId + " (el destino ya tiene uno con ese id)");
        continue;
      }
      const d: any = doc.data || {};
      moved.push(doc.projectId + (d.name ? " — " + d.name : ""));
      if (dryRun) continue;

      await ctx.db.patch(doc._id, { wixUserId: args.toTenantId });

      const extras = await ctx.db
        .query("project_extras")
        .withIndex("by_wix_user_project", (q: any) =>
          q.eq("wixUserId", args.fromTenantId).eq("projectId", doc.projectId),
        )
        .unique();
      if (extras) {
        await ctx.db.patch(extras._id, { wixUserId: args.toTenantId });
        extrasMoved++;
      }

      // La propiedad de los archivos viaja con el proyecto.
      const ids = new Set<string>();
      collectStorageIds(doc.data, ids);
      if (extras) {
        collectStorageIds(extras.guests, ids);
        collectStorageIds(extras.vendors, ids);
        collectStorageIds(extras.moodboard, ids);
        collectStorageIds(extras.layouts, ids);
        collectStorageIds(extras.savedLayouts, ids);
        collectStorageIds(extras.layoutItems, ids);
        collectStorageIds(extras.eventLayouts, ids);
      }
      for (const sid of ids) {
        const own = await ctx.db
          .query("file_ownership")
          .withIndex("by_storage_id", (q: any) => q.eq("storageId", sid))
          .unique();
        if (own && own.wixUserId === args.fromTenantId) {
          await ctx.db.patch(own._id, { wixUserId: args.toTenantId });
          filesReassigned++;
        }
      }
    }

    return { dryRun, moved, skipped, extrasMoved, filesReassigned };
  },
});

/**
 * Corrige un enlace ya hecho: apunta la cuenta de Clerk a otro tenant.
 * Es la valvula de escape si alguien se enlazo al tenant equivocado.
 */
export const relink = internalMutation({
  args: { subject: v.string(), tenantId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("identities")
      .withIndex("by_subject", (q: any) => q.eq("subject", args.subject))
      .unique();
    if (!link) throw new Error("No hay identidad para el subject " + args.subject);
    const before = link.tenantId;
    await ctx.db.patch(link._id, { tenantId: args.tenantId, linkedFrom: "manual" });
    return "Reenlazado " + args.subject + ": " + before + " → " + args.tenantId;
  },
});
