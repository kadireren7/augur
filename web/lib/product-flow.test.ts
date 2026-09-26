import { describe, expect, it } from "vitest";

import { buildChronicle } from "@/lib/chronicle";
import { AugurStore, StoreError } from "@/lib/store";

const now = new Date("2026-09-27T12:00:00.000Z");
const sessionId = "flow-session-123";

describe("local product flows", () => {
  it("shows a claimable Chamber result without a fabricated transaction hash", () => {
    const store = new AugurStore(now);
    const market = store.getChamber("pablo").activeMarket!;
    store.approve(market.id, sessionId, 25);
    store.predict(market.id, sessionId, "HOLD", 25, now);
    store.advanceFixture("pablo", new Date(now.getTime() + 1_000));
    expect(store.getMarket(market.id).positions[sessionId].claimable).toBe(25);
    const claim = store.claim(market.id, sessionId);
    expect(claim.transactionHash).toBeUndefined();
  });

  it("keeps chat and reactions separate from Omen and market state", () => {
    const store = new AugurStore(now);
    const before = structuredClone(store.getChamber("pablo"));
    store.social.postMessage({ chamberId: before.id, sessionId, displayName: "Guest", text: "BUY?" }, 1);
    store.social.addReaction({ chamberId: before.id, sessionId, reaction: "SELL" }, 2);
    const after = store.getChamber("pablo");
    expect(after.latestOmen).toEqual(before.latestOmen);
    expect(after.activeMarket).toEqual(before.activeMarket);
  });

  it("replays the declared battle into Chronicle", () => {
    const chronicle = buildChronicle(new AugurStore(now));
    expect(chronicle.battles[0]).toMatchObject({
      state: "RESOLVED",
      result: "CREATURE_A",
      priceSourceId: "fixture:mon-001",
      onchainCommitment: "LOCAL_ONLY",
    });
    expect(chronicle.standings.find((row) => row.creature.name === "Pablo")?.battleWins).toBe(1);
  });

  it("rejects invalid or late market input instead of fabricating an outcome", () => {
    const store = new AugurStore(now);
    const market = store.getChamber("pablo").activeMarket!;
    store.approve(market.id, sessionId, 10);
    expect(() =>
      store.predict(market.id, sessionId, "BUY", 10, new Date(market.locksAt)),
    ).toThrow(StoreError);
    expect(store.getChamber("pablo").latestOmen.sequence).toBe(3);
    expect(market.state).toBe("OPEN");
  });
});
