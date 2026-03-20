import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    wixUserId: v.string(),
    projectId: v.string(),
    data: v.any(),
    updatedAt: v.number(),
    shareToken: v.string(),
    shareEnabled: v.boolean(),
  })
    .index("by_wix_user", ["wixUserId"])
    .index("by_wix_user_project", ["wixUserId", "projectId"])
    .index("by_share_token", ["shareToken"]),
});
