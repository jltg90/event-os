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
    await requireAuth(ctx, args.sessionToken);
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const getFileUrls = query({
  args: { storageIds: v.array(v.id("_storage")), sessionToken: v.string() },
  returns: v.array(v.union(v.string(), v.null())),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.sessionToken);
    return await Promise.all(
      args.storageIds.map((id) => ctx.storage.getUrl(id)),
    );
  },
});

export const deleteFile = mutation({
  args: { storageId: v.id("_storage"), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.sessionToken);
    await ctx.storage.delete(args.storageId);
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
    await requireAuth(ctx, args.sessionToken);
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
    return { valid: true };
  },
});
