import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    wixUserId: v.string(),
    projectId: v.string(),
    data: v.any(),
    updatedAt: v.number(),
    shareToken: v.optional(v.string()),
    shareEnabled: v.optional(v.boolean()),
  })
    .index("by_wix_user", ["wixUserId"])
    .index("by_wix_user_project", ["wixUserId", "projectId"])
    .index("by_wix_user_updated", ["wixUserId", "updatedAt"])
    .index("by_share_token", ["shareToken"]),

  sessions: defineTable({
    sessionToken: v.string(),
    wixUserId: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["sessionToken"])
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
    updatedAt: v.number(),
  })
    .index("by_wix_user_project", ["wixUserId", "projectId"]),
});
