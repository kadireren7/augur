import { describe, it, expect } from "vitest";
import { estimatePayout } from "./payout-estimate";
import type { MarketView } from "./types";
describe("resulting pari-mutuel pool", () => {
  const market = {
    totalPool: "10000000000000000000",
    pools: {
      BUY: "5000000000000000000",
      HOLD: "2000000000000000000",
      SELL: "3000000000000000000",
    },
  } as MarketView;
  it("includes the additional stake in both pools, not the old 2x ratio", () => {
    expect(estimatePayout(market, "BUY", 1)).toEqual({
      payout: 1833333333333333333n,
      shareBasisPoints: 1666n,
    });
  });
  it("rejects invalid input and refunds economics are not simulated as winnings", () => {
    expect(estimatePayout(market, "BUY", 0)).toBeNull();
    expect(estimatePayout(market, "BUY", 1.2)).toBeNull();
  });
});
