import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const generateUploadUrl = mutation({
  args: { sessionToken: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.sessionToken);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage"), sessionToken: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);
    // Verify ownership — if record exists, enforce it; if no record (legacy), allow access
    const ownership = await ctx.db
      .query("file_ownership")
      .withIndex("by_storage_id", (q: any) => q.eq("storageId", args.storageId as string))
      .unique();
    if (ownership && ownership.wixUserId !== wixUserId) {
      throw new Error("Forbidden: file not owned by user");
    }
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const getFileUrls = query({
  args: { storageIds: v.array(v.id("_storage")), sessionToken: v.string() },
  returns: v.array(v.union(v.string(), v.null())),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);
    return await Promise.all(
      args.storageIds.map(async (id) => {
        const ownership = await ctx.db
          .query("file_ownership")
          .withIndex("by_storage_id", (q: any) => q.eq("storageId", id as string))
          .unique();
        if (ownership && ownership.wixUserId !== wixUserId) return null;
        return ctx.storage.getUrl(id);
      }),
    );
  },
});

export const deleteFile = mutation({
  args: { storageId: v.id("_storage"), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);
    // Verify ownership before deletion
    const ownership = await ctx.db
      .query("file_ownership")
      .withIndex("by_storage_id", (q: any) => q.eq("storageId", args.storageId as string))
      .unique();
    if (ownership && ownership.wixUserId !== wixUserId) {
      throw new Error("Forbidden: file not owned by user");
    }
    await ctx.storage.delete(args.storageId);
    // Clean up ownership record
    if (ownership) await ctx.db.delete(ownership._id);
    return null;
  },
});

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
  args: { storageId: v.id("_storage"), sessionToken: v.string() },
  returns: v.object({ valid: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);
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
