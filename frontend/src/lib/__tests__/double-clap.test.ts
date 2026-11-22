import { expect, it } from "vitest";
import { DoubleClap } from "../double-clap";
function clap(detector: DoubleClap, at: number) {
  detector.feed(0.12, 0.8, at);
  return detector.feed(0.005, 0.02, at + 40);
}
it("requires two separated short transients and applies a refractory period", () => {
  const d = new DoubleClap();
  expect(clap(d, 1000)).toBe(false);
  expect(clap(d, 1400)).toBe(true);
  expect(clap(d, 1600)).toBe(false);
  expect(clap(d, 1900)).toBe(false);
});
it("rejects sustained noise, weak sounds, echoes and widely separated impulses", () => {
  const d = new DoubleClap();
  d.feed(0.12, 0.8, 1000); expect(d.feed(0.005, 0.02, 1400)).toBe(false);
  expect(d.feed(0.01, 0.02, 1600)).toBe(false);
  expect(clap(d, 2000)).toBe(false);
  expect(clap(d, 2070)).toBe(false);
  expect(clap(d, 4000)).toBe(false);
  expect(d.feed(Number.NaN, 1, 5000)).toBe(false);
});
