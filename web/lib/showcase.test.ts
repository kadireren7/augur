import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-27T12:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

import { AugurStore } from "@/lib/store";

describe("Monad showcase local harness", () => {
  it("runs three repeated cycles across independent Chambers", () => {
    const store = new AugurStore(new Date("2026-09-27T12:00:00.000Z"));
    const pabloStart = store.getChamber("pablo").latestOmen!.sequence;
    const bubblesStart = store.getChamber("bubbles").latestOmen!.sequence;
    let state = store.showcaseState();
    for (let round = 0; round < 3; round += 1) {
      state = store.runShowcaseCycle(
        ["pablo", "bubbles"],
        5_000,
        9,
        new Date(`2026-09-27T12:00:0${round}.000Z`),
      );
    }
    expect(state.rounds["chamber-pablo"]).toBe(3);
    expect(state.rounds["chamber-bubbles"]).toBe(3);
    expect(store.getChamber("pablo").latestOmen!.sequence).toBe(pabloStart + 3);
    expect(store.getChamber("bubbles").latestOmen!.sequence).toBe(bubblesStart + 3);
    expect(state.operationsAttempted).toBe(54);
    expect(state.operationsSucceeded).toBe(54);
    expect(state.errors).toBe(0);
    const pabloMarketIds = new Set(store.getChamber("pablo").marketHistory.map((market) => market.id));
    const bubblesMarketIds = new Set(store.getChamber("bubbles").marketHistory.map((market) => market.id));
    expect([...pabloMarketIds].some((id) => bubblesMarketIds.has(id))).toBe(false);
  });

  it("executes a bounded local prediction stress cycle without TPS claims", () => {
    const store = new AugurStore(new Date("2026-09-27T12:00:00.000Z"));
    const state = store.runShowcaseCycle(["pablo", "bubbles"], 5_000, 100);
    expect(state.operationsAttempted).toBe(200);
    expect(state.operationsSucceeded).toBe(200);
    expect(state.errors).toBe(0);
    expect(state.mode).toBe("LOCAL");
  });
});
