import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function getShareMeta(project: any) {
  const share = project && project.share ? project.share : null;
  return {
    shareToken: share && share.token ? String(share.token) : "",
    shareEnabled: !!(share && share.enabled && share.token),
  };
}

export const getProjectsByWixUserId = query({
  args: {
    wixUserId: v.string(),
  },
  returns: v.array(
    v.object({
      projectId: v.string(),
      data: v.any(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("projects")
      .withIndex("by_wix_user", (q) => q.eq("wixUserId", args.wixUserId))
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
    wixUserId: v.string(),
    project: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const projectId = String(args.project && args.project.id ? args.project.id : "");
    if (!projectId) {
      throw new Error("Project is missing an id");
    }

    const now = Date.now();
    const shareMeta = getShareMeta(args.project);
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_project", (q) =>
        q.eq("wixUserId", args.wixUserId).eq("projectId", projectId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.project,
        updatedAt: now,
        shareToken: shareMeta.shareToken,
        shareEnabled: shareMeta.shareEnabled,
      });
    } else {
      await ctx.db.insert("projects", {
        wixUserId: args.wixUserId,
        projectId,
        data: args.project,
        updatedAt: now,
        shareToken: shareMeta.shareToken,
        shareEnabled: shareMeta.shareEnabled,
      });
    }

    return null;
  },
});

export const deleteProject = mutation({
  args: {
    wixUserId: v.string(),
    projectId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_wix_user_project", (q) =>
        q.eq("wixUserId", args.wixUserId).eq("projectId", args.projectId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

export const getSharedProjectByToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      wixUserId: v.string(),
      project: v.any(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const doc = await ctx.db
      .query("projects")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .first();

    if (!doc || !doc.shareEnabled) return null;

    return {
      wixUserId: doc.wixUserId,
      project: doc.data,
    };
  },
});
