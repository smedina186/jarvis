import { ConvexError } from "convex/values";

// No public reads, subscriptions or writes until owner-scoped JWT auth is implemented.
// An environment toggle alone must never reopen these legacy functions.
export function assertRealtimeDisabled(): void {
  throw new ConvexError("Legacy realtime is disabled in private JARVIS");
}
