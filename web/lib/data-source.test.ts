import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvioDataSource } from "./data-source";
import { formatAugd } from "./token-amount";

afterEach(() => vi.unstubAllGlobals());

describe("indexed token precision and source integrity", () => {
  it("preserves exact integers, sums predictions and formats Chronicle backing", async () => {
    const chamberId = `0x${"1".repeat(64)}`;
    const creatureId = `0x${"2".repeat(64)}`;
    const amount = "10000000000000000001";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: {
      Creature: [{ id: creatureId, species: 0, metadataHash: `0x${"3".repeat(64)}`, omenBuy: "1", omenHold: "0", omenSell: "0", battleWins: "0", battleLosses: "0", battleTies: "0", virtualPnl: "0" }],
      Chamber: [{ id: chamberId, creatureId, rulesetHash: `0x${"4".repeat(64)}`, status: 2, latestSequence: "1", omenCount: "1", volume: amount }],
      Omen: [{ chamberId, creatureId, sequence: "1", omenType: 2, behaviorType: 1, observedAt: "1790954252", provenanceHash: `0x${"5".repeat(64)}` }],
      Market: [{ id: "1", chamberId, state: 3, opensAt: "1790954191", locksAt: "1790954221", resolutionDeadline: "1790954491", minOmenSequence: "1", winningOutcome: 2, volume: amount }],
      Prediction: [{ marketId: "1", outcome: 2, amount: "10000000000000000000" }, { marketId: "1", outcome: 2, amount: "1" }],
      Battle: [],
    } }))));
    const source = new EnvioDataSource("http://localhost:8080/v1/graphql");
    const [chamber] = await source.listChambers();
    expect(chamber.marketHistory[0].totalPool).toBe(amount);
    expect(chamber.marketHistory[0].pools.BUY).toBe(amount);
    expect(chamber.marketHistory[0].mode).toBe("CONTRACT");
    expect(chamber.proof).toBeNull();
    expect(chamber.latestOmen?.provenanceHash).toBe(`0x${"5".repeat(64)}`);
    expect(JSON.parse(JSON.stringify(chamber)).marketHistory[0].totalPool).toBe(amount);
    const chronicle = await source.getChronicle();
    expect(chronicle.standings[0].totalBacked).toBe(amount);
    expect(formatAugd(chronicle.standings[0].totalBacked)).toBe("10.000000000000000001");
  });
  it("fails explicitly when the configured indexer is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    await expect(new EnvioDataSource("http://localhost:8080/v1/graphql").listChambers()).rejects.toThrow("Envio request failed");
  });
});
