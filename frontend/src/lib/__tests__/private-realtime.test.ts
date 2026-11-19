import { expect, it } from "vitest";
import { assertRealtimeDisabled } from "../../../convex/privateAccess";

it("does not expose legacy realtime even when called directly", () => {
  expect(() => assertRealtimeDisabled()).toThrow("Legacy realtime is disabled");
});
