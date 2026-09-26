import { createProofForAdvance, createSeed } from "@/lib/seed";
import { SocialStore } from "@/lib/social";
import type {
  BattleView,
  ChamberView,
  MarketView,
  OmenValue,
  TransactionFeedback,
  UserMarketPosition,
} from "@/lib/types";

const emptyPosition = (): UserMarketPosition => ({
  BUY: 0,
  HOLD: 0,
  SELL: 0,
  approved: 0,
  claimed: false,
  refunded: false,
  claimable: 0,
  refundable: 0,
});

export class AugurStore {
  readonly chambers = new Map<string, ChamberView>();
  readonly battles = new Map<string, BattleView>();
  readonly social = new SocialStore();
  private readonly nextFixtureOmen: Record<string, OmenValue>;

  constructor(now = new Date()) {
    const seed = createSeed(now);
    for (const chamber of seed.chambers) this.chambers.set(chamber.slug, chamber);
    for (const battle of seed.battles) this.battles.set(battle.id, battle);
    this.nextFixtureOmen = seed.nextFixtureOmen;
  }

  listChambers(): ChamberView[] {
    return [...this.chambers.values()];
  }

  getChamber(slug: string): ChamberView {
    const chamber = this.chambers.get(slug);
    if (!chamber) throw new StoreError("NOT_FOUND", "Chamber not found");
    return chamber;
  }

  getMarket(marketId: number): MarketView {
    const market = this.listChambers()
      .flatMap((chamber) => [chamber.activeMarket, ...chamber.marketHistory])
      .find((candidate) => candidate?.id === marketId);
    if (!market) throw new StoreError("NOT_FOUND", "Market not found");
    return market;
  }

  approve(marketId: number, sessionId: string, amount: number): TransactionFeedback {
    const market = this.getMarket(marketId);
    this.ensureOpen(market);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new StoreError("INVALID_INPUT", "Approval amount must be a positive integer");
    }
    const position = (market.positions[sessionId] ??= emptyPosition());
    position.approved += amount;
    return {
      phase: "CONFIRMED",
      message: `Approved ${amount} local demo tokens. No blockchain transaction was sent.`,
      mode: "LOCAL_DEMO",
    };
  }

  predict(
    marketId: number,
    sessionId: string,
    outcome: OmenValue,
    amount: number,
    now = new Date(),
  ): TransactionFeedback {
    const market = this.getMarket(marketId);
    this.ensureOpen(market, now);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new StoreError("INVALID_INPUT", "Prediction amount must be a positive integer");
    }
    const position = (market.positions[sessionId] ??= emptyPosition());
    if (position.approved < amount) {
      throw new StoreError("NOT_APPROVED", "Approve enough local demo tokens first");
    }
    position.approved -= amount;
    position[outcome] += amount;
    market.pools[outcome] += amount;
    market.totalPool += amount;
    return {
      phase: "CONFIRMED",
      message: `Prediction recorded in local demo mode. No blockchain transaction was sent.`,
      mode: "LOCAL_DEMO",
    };
  }

  advanceFixture(slug: string, now = new Date()): ChamberView {
    const chamber = this.getChamber(slug);
    if (chamber.sourceMode !== "FIXTURE") {
      throw new StoreError("INVALID_STATE", "Only fixture Chambers can be advanced locally");
    }
    const market = chamber.activeMarket;
    if (!market || market.state !== "OPEN") {
      throw new StoreError("INVALID_STATE", "No open local market to resolve");
    }
    market.state = "LOCKED";
    market.locksAt = now.toISOString();
    const value = this.nextFixtureOmen[chamber.id];
    const sequence = chamber.latestOmen.sequence + 1;
    const currentProof = createProofForAdvance(chamber, value, sequence, now);
    const omen = {
      value,
      sequence,
      observedAt: now.toISOString(),
      behaviorType: "ZONE_ENTRY",
      provenanceHash: currentProof.manifestHash,
    };
    chamber.latestOmen = omen;
    chamber.omenHistory.unshift(omen);
    chamber.proof = currentProof;
    chamber.observation = {
      zone: value === "BUY" ? "RIGHT" : value === "SELL" ? "LEFT" : "CENTER",
      direction: "STATIONARY",
      confidence: 0.96,
      dwellMs: 1_000,
      observedAt: now.toISOString(),
    };
    chamber.behavior = {
      type: "ZONE_ENTRY",
      parameters: { zone: chamber.observation.zone },
      confidence: 0.96,
      rulesetVersion: "1.0.0",
    };
    market.resolvingSequence = sequence;
    market.winningOutcome = value;
    const winningPool = market.pools[value];
    if (winningPool === 0) {
      market.state = "CANCELLED";
      market.cancellationReason = "NO_WINNERS";
      for (const position of Object.values(market.positions)) {
        position.refundable = position.BUY + position.HOLD + position.SELL;
      }
    } else {
      market.state = "RESOLVED";
      for (const position of Object.values(market.positions)) {
        position.claimable = Math.floor((position[value] * market.totalPool) / winningPool);
      }
    }
    chamber.marketHistory.unshift(market);
    chamber.activeMarket = null;
    return chamber;
  }

  claim(marketId: number, sessionId: string): TransactionFeedback {
    const market = this.getMarket(marketId);
    if (market.state !== "RESOLVED") throw new StoreError("INVALID_STATE", "Market is not resolved");
    const position = market.positions[sessionId];
    if (!position || position.claimable <= 0) throw new StoreError("NO_PAYOUT", "No winning position");
    if (position.claimed) throw new StoreError("ALREADY_CLAIMED", "Payout already claimed");
    position.claimed = true;
    return {
      phase: "CONFIRMED",
      message: `Claimed ${position.claimable} local demo tokens. No blockchain transaction was sent.`,
      mode: "LOCAL_DEMO",
    };
  }

  refund(marketId: number, sessionId: string): TransactionFeedback {
    const market = this.getMarket(marketId);
    if (market.state !== "CANCELLED") throw new StoreError("INVALID_STATE", "Market is not cancelled");
    const position = market.positions[sessionId];
    if (!position || position.refundable <= 0) throw new StoreError("NO_REFUND", "No refund available");
    if (position.refunded) throw new StoreError("ALREADY_REFUNDED", "Refund already claimed");
    position.refunded = true;
    return {
      phase: "CONFIRMED",
      message: `Refunded ${position.refundable} local demo tokens. No blockchain transaction was sent.`,
      mode: "LOCAL_DEMO",
    };
  }

  private ensureOpen(market: MarketView, now = new Date()): void {
    if (market.state !== "OPEN") throw new StoreError("INVALID_STATE", "Market is not open");
    if (now >= new Date(market.locksAt)) throw new StoreError("LOCKED", "Market lock time has passed");
  }
}

export class StoreError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

declare global {
  var __augurStore: AugurStore | undefined;
}

export function getStore(): AugurStore {
  globalThis.__augurStore ??= new AugurStore();
  return globalThis.__augurStore;
}
