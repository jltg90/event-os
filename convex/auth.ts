import { action, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// 24 hours in milliseconds
const SESSION_TTL = 24 * 60 * 60 * 1000;

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Read from the sessions table and return the verified wixUserId.
 * Call this at the top of every protected query/mutation handler.
 */
export async function requireAuth(
  ctx: { db: any },
  sessionToken: string,
): Promise<string> {
  if (!sessionToken) throw new Error("Unauthorized: missing session token");

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("sessionToken", sessionToken))
    .unique();

  if (!session) throw new Error("Unauthorized: invalid session");
  if (session.expiresAt < Date.now()) throw new Error("Unauthorized: session expired");

  return session.wixUserId;
}

// ─── Internal mutation: write session record ──────────────────────────────────

export const _createSessionRecord = internalMutation({
  args: {
    sessionToken: v.string(),
    wixUserId: v.string(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Keep the last 5 sessions per user (allows multi-device), prune the rest
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q: any) => q.eq("wixUserId", args.wixUserId))
      .collect();
    const sorted = existing.sort((a: any, b: any) => b.expiresAt - a.expiresAt);
    const toDelete = sorted.slice(4); // keep 4 + the new one = 5 total
    await Promise.all(toDelete.map((s: any) => ctx.db.delete(s._id)));

    await ctx.db.insert("sessions", {
      sessionToken: args.sessionToken,
      wixUserId: args.wixUserId,
      expiresAt: args.expiresAt,
    });

    return null;
  },
});

// ─── Revoke other sessions (keep only the caller's) ──────────────────────────

export const revokeOtherSessions = internalMutation({
  args: {
    wixUserId: v.string(),
    keepToken: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q: any) => q.eq("wixUserId", args.wixUserId))
      .collect();
    let revoked = 0;
    for (const s of sessions) {
      if (s.sessionToken !== args.keepToken) {
        await ctx.db.delete(s._id);
        revoked++;
      }
    }
    return revoked;
  },
});

// ─── Public mutation: close all other sessions for this user ─────────────────

export const closeOtherSessions = mutation({
  args: { sessionToken: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const wixUserId = await requireAuth(ctx, args.sessionToken);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q: any) => q.eq("wixUserId", wixUserId))
      .collect();
    let revoked = 0;
    for (const s of sessions) {
      if (s.sessionToken !== args.sessionToken) {
        await ctx.db.delete(s._id);
        revoked++;
      }
    }
    return revoked;
  },
});

// ─── Scheduled cleanup ────────────────────────────────────────────────────────

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

// ─── Wix token verification ───────────────────────────────────────────────────

/**
 * Decode the base64url-encoded payload of a JWT without verifying the signature.
 * Returns the parsed object or null on failure.
 */
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    // base64url → base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Verify the HMAC-SHA256 signature of a JWT using the Web Crypto API.
 * Returns true if signature is valid, false otherwise.
 */
async function verifyJwtHmac(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const encoder = new TextEncoder();
    const data = encoder.encode(parts[0] + "." + parts[1]);
    const sigBase64 = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const sig = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    return await crypto.subtle.verify("HMAC", key, sig, data);
  } catch {
    return false;
  }
}

// ─── Public action: exchange Wix token for session token ─────────────────────

export const createSession = action({
  args: {
    wixToken: v.string(),
    claimedUserId: v.string(),
  },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const { wixToken, claimedUserId } = args;
    const expiresAt = Date.now() + SESSION_TTL;

    const allowUnsigned = process.env.ALLOW_UNSIGNED_JWT === "true";

    // Dev bypass: "dev_user_local" is always allowed (named synthetic user for local dev).
    // Empty claimedUserId requires explicit ALLOW_UNSIGNED_JWT flag.
    if (claimedUserId === "dev_user_local") {
      const token = await _generateToken();
      await ctx.runMutation(internal.auth._createSessionRecord, {
        sessionToken: token,
        wixUserId: "dev_user_local",
        expiresAt,
      });
      return { token, expiresAt };
    }
    if (claimedUserId === "") {
      if (!allowUnsigned) {
        throw new Error("Unauthorized: dev bypass is disabled in production. Set ALLOW_UNSIGNED_JWT=true for development.");
      }
      const token = await _generateToken();
      await ctx.runMutation(internal.auth._createSessionRecord, {
        sessionToken: token,
        wixUserId: "dev_user_local",
        expiresAt,
      });
      return { token, expiresAt };
    }

    const appSecret = process.env.WIX_APP_SECRET;

    // Extract user ID from a Wix JWT payload, checking all known field names
    function extractWixUserId(payload: any): string {
      return payload.uid || payload.sub || payload.memberId || payload.contactId || "";
    }

    if (appSecret) {
      // Full HMAC-SHA256 verification
      const valid = await verifyJwtHmac(wixToken, appSecret);
      if (!valid) throw new Error("Unauthorized: invalid Wix token signature");

      const payload = decodeJwtPayload(wixToken);
      if (!payload) throw new Error("Unauthorized: malformed Wix token");

      const tokenUserId = extractWixUserId(payload);
      if (!tokenUserId || tokenUserId !== claimedUserId) {
        console.error("EventOS auth: userId mismatch — token fields:", JSON.stringify(Object.keys(payload)), "extracted:", tokenUserId, "claimed:", claimedUserId);
        throw new Error("Unauthorized: userId mismatch (token=" + tokenUserId + " claimed=" + claimedUserId + ")");
      }
    } else if (allowUnsigned) {
      // Development mode: no secret configured → decode payload only
      console.warn(
        "EventOS: WIX_APP_SECRET is not set. Wix token signature is NOT verified. " +
          "Set WIX_APP_SECRET in Convex environment variables for production.",
      );

      if (wixToken) {
        const payload = decodeJwtPayload(wixToken);
        if (payload) {
          const tokenUserId = extractWixUserId(payload);
          if (tokenUserId && tokenUserId !== claimedUserId) {
            console.error("EventOS auth (unsigned): userId mismatch — token fields:", JSON.stringify(Object.keys(payload)), "extracted:", tokenUserId, "claimed:", claimedUserId);
            throw new Error("Unauthorized: userId mismatch");
          }
        }
      }
    } else {
      throw new Error(
        "Unauthorized: WIX_APP_SECRET must be configured. " +
          "Set it in Convex environment variables, or set ALLOW_UNSIGNED_JWT=true for development.",
      );
    }

    const token = await _generateToken();
    await ctx.runMutation(internal.auth._createSessionRecord, {
      sessionToken: token,
      wixUserId: claimedUserId,
      expiresAt,
    });

    return { token, expiresAt };
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _generateToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
