import { describe, expect, it } from "vitest";

import { buildChronicle } from "@/lib/chronicle";
import { AugurStore } from "@/lib/store";

describe("AugurStore chamber lifecycle", () => {
  it("runs predict, fixture Omen, resolution, and local claim", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const store = new AugurStore(now);
    const market = store.getChamber("pablo").activeMarket!;
    store.approve(market.id, "session-12345", 100);
    store.predict(market.id, "session-12345", "HOLD", 100, now);
    const chamber = store.advanceFixture("pablo", new Date(now.getTime() + 1_000));
    expect(chamber.latestOmen!.value).toBe("HOLD");
    expect(chamber.marketHistory[0].state).toBe("RESOLVED");
    const feedback = store.claim(market.id, "session-12345");
    expect(feedback.phase).toBe("CONFIRMED");
    expect(feedback.transactionHash).toBeUndefined();
  });

  it("cancels and enables refunds when the winning side is empty", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const store = new AugurStore(now);
    const market = store.getChamber("pablo").activeMarket!;
    store.approve(market.id, "session-12345", 50);
    store.predict(market.id, "session-12345", "BUY", 50, now);
    store.advanceFixture("pablo", new Date(now.getTime() + 1_000));
    expect(market.state).toBe("CANCELLED");
    expect(store.refund(market.id, "session-12345").phase).toBe("CONFIRMED");
  });

  it("builds reproducible Chronicle standings from local records", () => {
    const chronicle = buildChronicle(new AugurStore(new Date("2026-09-27T12:00:00.000Z")));
    expect(chronicle.standings[0].creature.name).toBe("Pablo");
    expect(chronicle.standings[0].battleWins).toBe(1);
    expect(chronicle.battles[0].priceSourceId).toBe("fixture:mon-001");
  });
});
