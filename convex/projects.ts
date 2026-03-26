import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const getProjectsByWixUserId = query({
  args: {
    sessionToken: v.string(),
  },
  returns: v.array(
    v.object({
      projectId: v.string(),
      data: v.any(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);

    const docs = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q) => q.eq("wixUserId", wixUserId))
      .collect();

    return docs.map((doc) => ({
      projectId: doc.projectId,
      data: doc.data,
      updatedAt: doc.updatedAt,
    }));
  },
});

export const upsertProject = mutation({
  args: {
    sessionToken: v.string(),
    project: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);

    const projectId = String(args.project && args.project.id ? args.project.id : "");
    if (!projectId) {
      throw new Error("Project is missing an id");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_project", (q) =>
        q.eq("wixUserId", wixUserId).eq("projectId", projectId),
      )
      .unique();

    if (existing) {
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

export const deleteProject = mutation({
  args: {
    sessionToken: v.string(),
    projectId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_project", (q) =>
        q.eq("wixUserId", wixUserId).eq("projectId", args.projectId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

export const getChangedProjectIds = query({
  args: {
    sessionToken: v.string(),
    since: v.number(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);

    const docs = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_updated", (q) =>
        q.eq("wixUserId", wixUserId).gt("updatedAt", args.since),
      )
      .collect();

    return docs.map((doc) => doc.projectId);
  },
});

export const getProjectMetaByWixUserId = query({
  args: {
    sessionToken: v.string(),
  },
  returns: v.array(
    v.object({
      projectId: v.string(),
      data: v.any(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);

    const docs = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q) => q.eq("wixUserId", wixUserId))
      .collect();

    return docs.map((doc) => {
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

export const getProjectById = query({
  args: {
    sessionToken: v.string(),
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
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);

    const doc = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_project", (q) =>
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

export const getProjectExtras = query({
  args: {
    sessionToken: v.string(),
    projectId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      guests: v.any(),
      layoutItems: v.any(),
      savedLayouts: v.any(),
      layouts: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);
    const doc = await ctx.db
      .query("project_extras")
      .withIndex("by_wix_user_project", (q) =>
        q.eq("wixUserId", wixUserId).eq("projectId", args.projectId),
      )
      .unique();
    if (!doc) return null;
    return {
      guests: doc.guests,
      layoutItems: doc.layoutItems,
      savedLayouts: doc.savedLayouts,
      layouts: doc.layouts ?? undefined,
    };
  },
});

export const upsertProjectExtras = mutation({
  args: {
    sessionToken: v.string(),
    projectId: v.string(),
    extras: v.object({
      guests: v.any(),
      layoutItems: v.any(),
      savedLayouts: v.any(),
      layouts: v.optional(v.any()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);
    const existing = await ctx.db
      .query("project_extras")
      .withIndex("by_wix_user_project", (q) =>
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

