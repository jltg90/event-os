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
function authedQuery<Args extends Record<string, any>, Returns>(config: {
  args: Args;
  returns: any;
  handler: (ctx: any, wixUserId: string, args: any) => Promise<Returns>;
}) {
  return query({
    args: { sessionToken: v.string(), ...config.args },
    returns: config.returns,
    handler: async (ctx: any, args: any) => {
      const wixUserId = await requireAuth(ctx, args.sessionToken);
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
    args: { sessionToken: v.string(), ...config.args },
    returns: config.returns,
    handler: async (ctx: any, args: any) => {
      const wixUserId = await requireAuth(ctx, args.sessionToken);
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

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
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
    return {
      guests: doc.guests,
      layoutItems: doc.layoutItems,
      savedLayouts: doc.savedLayouts,
      layouts: doc.layouts ?? undefined,
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

