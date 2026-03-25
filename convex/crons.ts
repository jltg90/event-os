import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Delete sessions whose expiresAt is in the past.
// Runs once a day at 03:00 UTC — low-traffic window.
crons.daily(
  "cleanup expired sessions",
  { hourUTC: 3, minuteUTC: 0 },
  internal.auth.cleanupExpiredSessions,
);

export default crons;
