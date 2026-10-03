import { createProofForAdvance, createSeed } from "@/lib/seed";
import { SocialStore } from "@/lib/social";
import { prepareChamber } from "@/lib/chamber-creation";
import { getPersistence } from "@/lib/database";
import type { ApplicationPersistence } from "@/lib/persistence";
import type {
  BattleView,
  LocalChamberView as ChamberView,
  LocalMarketView as MarketView,
  OmenValue,
  TransactionFeedback,
  UserMarketPosition,
  ChamberCreationInput,
  ShowcaseEvent,
  ShowcaseState,
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
  readonly social: SocialStore;
  private readonly nextFixtureOmen: Record<string, OmenValue>;
  private nextMarketId: number;
  private readonly showcaseRounds: Record<string, number> = {};
  private readonly showcaseEvents: ShowcaseEvent[] = [];
  private showcaseOperationsAttempted = 0;
  private showcaseOperationsSucceeded = 0;
  private showcaseErrors = 0;

  constructor(now = new Date(), private readonly persistence?: ApplicationPersistence) {
    const seed = createSeed(now);
    for (const chamber of seed.chambers) this.chambers.set(chamber.slug, chamber);
    for (const chamber of persistence?.loadChambers() ?? []) this.chambers.set(chamber.slug, chamber);
    for (const battle of seed.battles) this.battles.set(battle.id, battle);
    this.nextFixtureOmen = seed.nextFixtureOmen;
    this.nextMarketId = Math.max(
      0,
      ...this.listChambers().flatMap((chamber) => [
        chamber.activeMarket?.id ?? 0,
        ...chamber.marketHistory.map((market) => market.id),
      ]),
    ) + 1;
    this.social = new SocialStore(persistence);
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

  createChamber(input: ChamberCreationInput): ChamberView {
    const prepared = prepareChamber(input);
    if ([...this.chambers.values()].some((chamber) => chamber.id === prepared.chamberId)) {
      throw new StoreError("DUPLICATE_CHAMBER", "This Chamber configuration already exists");
    }
    const sourceMode = prepared.value.sourceMode === "FIXTURE_REPLAY"
      ? "REPLAY"
      : prepared.value.sourceMode === "UPLOADED_CLIP"
        ? "REPLAY"
        : "LIVE";
    const chamber: ChamberView = {
      id: prepared.chamberId,
      slug: prepared.slug,
      creature: {
        id: prepared.creatureId,
        name: prepared.value.name,
        species: prepared.value.species,
        description: prepared.value.description || "User-created Chamber",
      },
      status: "DRAFT",
      asset: prepared.value.asset,
      sourceMode,
      sourceLabel: sourceMode === "LIVE"
        ? "Live adapter configured but not connected"
        : "Controlled source registered; no Omen published yet",
      ownerId: prepared.value.ownerId,
      rulesetTemplate: prepared.value.rulesetTemplate,
      rulesetHash: prepared.rulesetHash,
      latestOmen: null,
      activeMarket: null,
      observation: null,
      behavior: null,
      proof: null,
      omenHistory: [],
      marketHistory: [],
      fixtureFrame: { x: 0.5, y: 0.5, label: "No observation" },
    };
    this.chambers.set(chamber.slug, chamber);
    this.persistence?.saveChamber(chamber);
    return chamber;
  }

  setChamberStatus(slug: string, actor: string, status: "ACTIVE" | "PAUSED" | "CLOSED") {
    const chamber = this.getChamber(slug);
    if (actor !== chamber.ownerId) throw new StoreError("UNAUTHORIZED", "Only the Chamber owner can change status");
    const valid =
      (chamber.status === "DRAFT" && status === "ACTIVE")
      || (chamber.status === "ACTIVE" && (status === "PAUSED" || status === "CLOSED"))
      || (chamber.status === "PAUSED" && (status === "ACTIVE" || status === "CLOSED"));
    if (!valid) throw new StoreError("INVALID_STATE", "Invalid Chamber lifecycle transition");
    chamber.status = status;
    this.persistence?.saveChamber(chamber);
    return chamber;
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
    if (!value || !chamber.latestOmen) {
      throw new StoreError("INVALID_STATE", "Fixture Chamber has no configured Omen sequence");
    }
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
      parameters: { zone: chamber.observation!.zone },
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
    this.persistence?.saveChamber(chamber);
    return chamber;
  }

  openNextMarket(slug: string, now = new Date(), durationMs = 10_000): MarketView {
    if (!Number.isInteger(durationMs) || durationMs < 5_000 || durationMs > 60_000) {
      throw new StoreError("INVALID_INPUT", "Round duration must be between 5 and 60 seconds");
    }
    const chamber = this.getChamber(slug);
    if (chamber.status !== "ACTIVE" || !chamber.latestOmen) {
      throw new StoreError("INVALID_STATE", "Chamber is not ready for a market");
    }
    if (chamber.activeMarket) throw new StoreError("INVALID_STATE", "Chamber already has an active market");
    const market: MarketView = {
      id: this.nextMarketId++,
      chamberId: chamber.id,
      state: "OPEN",
      opensAt: now.toISOString(),
      locksAt: new Date(now.getTime() + durationMs).toISOString(),
      resolutionDeadline: new Date(now.getTime() + durationMs * 2).toISOString(),
      minOmenSequence: chamber.latestOmen.sequence + 1,
      pools: { BUY: 0, HOLD: 0, SELL: 0 },
      totalPool: 0,
      positions: {},
      mode: "LOCAL_DEMO",
    };
    chamber.activeMarket = market;
    return market;
  }

  runShowcaseCycle(
    slugs: string[] = ["pablo", "bubbles"],
    durationMs = 5_000,
    predictionsPerChamber = 9,
    now = new Date(),
  ): ShowcaseState {
    if (slugs.length < 2 || slugs.length > 10) {
      throw new StoreError("INVALID_INPUT", "Showcase requires two to ten Chambers");
    }
    if (!Number.isInteger(predictionsPerChamber) || predictionsPerChamber < 1 || predictionsPerChamber > 1_000) {
      throw new StoreError("INVALID_INPUT", "Prediction count must be between 1 and 1000");
    }
    for (const slug of slugs) {
      const started = performance.now();
      const chamber = this.getChamber(slug);
      const round = (this.showcaseRounds[chamber.id] ?? 0) + 1;
      this.showcaseRounds[chamber.id] = round;
      try {
        const market = chamber.activeMarket ?? this.openNextMarket(slug, now, durationMs);
        this.pushShowcase(chamber.id, round, "OPEN", `Market #${market.id} opened`, now);
        const winner = this.nextFixtureOmen[chamber.id];
        if (!winner) throw new StoreError("INVALID_STATE", "No deterministic fixture Omen configured");
        const outcomes: OmenValue[] = [winner, "BUY", "HOLD", "SELL"];
        for (let index = 0; index < predictionsPerChamber; index += 1) {
          this.showcaseOperationsAttempted += 1;
          const session = `showcase-${chamber.id}-${round}-${index}`;
          this.approve(market.id, session, 1);
          this.predict(market.id, session, outcomes[index % outcomes.length], 1, now);
          this.showcaseOperationsSucceeded += 1;
        }
        this.pushShowcase(chamber.id, round, "PREDICTIONS", `${predictionsPerChamber} local predictions accepted`, now);
        this.pushShowcase(chamber.id, round, "LOCK", `Market #${market.id} locked`, now);
        const resolved = this.advanceFixture(slug, new Date(now.getTime() + 1_000));
        this.pushShowcase(chamber.id, round, "OMEN", `Omen #${resolved.latestOmen!.sequence} ${resolved.latestOmen!.value}`, now);
        this.pushShowcase(chamber.id, round, "RESOLVE", `Market #${market.id} ${market.state}`, now, performance.now() - started);
        const next = this.openNextMarket(slug, new Date(now.getTime() + 2_000), durationMs);
        this.pushShowcase(chamber.id, round, "NEXT_ROUND", `Market #${next.id} ready`, now);
      } catch (error) {
        this.showcaseErrors += 1;
        this.pushShowcase(chamber.id, round, "RESOLVE", error instanceof Error ? error.message : "Cycle failed", now, performance.now() - started);
      }
    }
    return this.showcaseState(durationMs, slugs);
  }

  showcaseState(durationMs = 5_000, slugs: string[] = ["pablo", "bubbles"]): ShowcaseState {
    return {
      mode: "LOCAL",
      running: false,
      durationMs,
      rounds: { ...this.showcaseRounds },
      operationsAttempted: this.showcaseOperationsAttempted,
      operationsSucceeded: this.showcaseOperationsSucceeded,
      errors: this.showcaseErrors,
      events: [...this.showcaseEvents],
      chambers: slugs.map((slug) => this.getChamber(slug)),
    };
  }

  private pushShowcase(
    chamberId: string,
    round: number,
    phase: ShowcaseEvent["phase"],
    detail: string,
    occurredAt: Date,
    localDurationMs?: number,
  ) {
    this.showcaseEvents.unshift({
      id: `${chamberId}-${round}-${phase}-${this.showcaseEvents.length}`,
      chamberId,
      round,
      phase,
      occurredAt: occurredAt.toISOString(),
      detail,
      ...(localDurationMs === undefined ? {} : { localDurationMs: Math.round(localDurationMs * 100) / 100 }),
    });
    this.showcaseEvents.splice(100);
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
  // The showcase is explicitly process-local on serverless hosts, never protocol truth.
  globalThis.__augurStore ??= new AugurStore(new Date(), process.env.VERCEL === "1" ? undefined : getPersistence());
  return globalThis.__augurStore;
}
