import { buildChronicle } from "@/lib/chronicle";
import { getStore } from "@/lib/store";
import type {
  BattleResult, BattleView, ChamberStatus, ChamberView, ChronicleView, Creature,
  MarketState, MarketView, OmenValue, SourceMode,
} from "@/lib/types";

export interface AugurDataSource {
  readonly mode: "LOCAL" | "ENVIO";
  listChambers(): Promise<ChamberView[]>;
  getChamber(slug: string): Promise<ChamberView | null>;
  getChronicle(): Promise<ChronicleView>;
}

export class LocalDataSource implements AugurDataSource {
  readonly mode = "LOCAL" as const;
  async listChambers() { return getStore().listChambers(); }
  async getChamber(slug: string) {
    try { return getStore().getChamber(slug); } catch { return null; }
  }
  async getChronicle() { return buildChronicle(getStore()); }
}

interface IndexedCreature {
  id: string; species: number; metadataHash: string; omenBuy: string; omenHold: string;
  omenSell: string; battleWins: string; battleLosses: string; battleTies: string;
  virtualPnl: string;
}
interface IndexedChamber {
  id: string; creatureId: string; rulesetHash: string; owner?: string; sourceMode?: number;
  status: number; latestSequence: string; omenCount: string; volume: string;
}
interface IndexedOmen {
  chamberId: string; creatureId: string; sequence: string; omenType: number;
  behaviorType: number; observedAt: string; provenanceHash: string;
}
interface IndexedMarket {
  id: string; chamberId: string; state: number; opensAt: string; locksAt: string;
  resolutionDeadline: string; minOmenSequence: string; winningOutcome?: number;
  resolvingSequence?: string; cancellationReason?: string; volume: string;
}
interface IndexedPrediction { marketId: string; outcome: number; amount: string; }
interface IndexedBattle {
  id: string; creatureA: string; creatureB: string; chamberA: string; chamberB: string;
  asset: string; startsAt: string; endsAt: string; startingNotional: string;
  scoringConfigHash: string; state: number; result?: number; pnlA?: string; pnlB?: string;
  priceSeriesHash?: string; cancellationReason?: string;
}
interface IndexedSnapshot {
  Creature: IndexedCreature[]; Chamber: IndexedChamber[]; Omen: IndexedOmen[];
  Market: IndexedMarket[]; Prediction: IndexedPrediction[]; Battle: IndexedBattle[];
}

const omenValues: OmenValue[] = ["SELL", "HOLD", "BUY"];
const roomStatuses: ChamberStatus[] = ["DRAFT", "DRAFT", "ACTIVE", "PAUSED", "CLOSED"];
const marketStates: MarketState[] = ["OPEN", "OPEN", "LOCKED", "RESOLVED", "CANCELLED"];
const secondsToIso = (seconds: string) => new Date(Number(seconds) * 1_000).toISOString();
const numeric = (value: string | undefined) => Number(value ?? "0");
const slugFor = (id: string) => `indexed-${id.replace(/^0x/, "").slice(0, 16).toLowerCase()}`;

export class EnvioDataSource implements AugurDataSource {
  readonly mode = "ENVIO" as const;

  constructor(private readonly endpoint: string) {
    if (
      !endpoint.startsWith("https://")
      && !endpoint.startsWith("http://localhost:")
      && !endpoint.startsWith("http://127.0.0.1:")
    ) {
      throw new Error("ENVIO_GRAPHQL_URL must use HTTPS or localhost HTTP");
    }
  }

  async listChambers() { return this.chambers(await this.snapshot()); }
  async getChamber(slug: string) {
    return (await this.listChambers()).find((chamber) => chamber.slug === slug) ?? null;
  }

  async getChronicle(): Promise<ChronicleView> {
    const snapshot = await this.snapshot();
    const creatures = new Map(snapshot.Creature.map((value) => [value.id, this.creature(value)]));
    const battles = snapshot.Battle.map((battle): BattleView => ({
      id: battle.id,
      creatureA: creatures.get(battle.creatureA) ?? this.unknownCreature(battle.creatureA),
      creatureB: creatures.get(battle.creatureB) ?? this.unknownCreature(battle.creatureB),
      chamberA: battle.chamberA,
      chamberB: battle.chamberB,
      asset: battle.asset,
      startsAt: secondsToIso(battle.startsAt),
      endsAt: secondsToIso(battle.endsAt),
      startingNotionalMicros: numeric(battle.startingNotional),
      scoringConfigHash: battle.scoringConfigHash,
      priceSourceId: "committed onchain",
      priceSeriesHash: battle.priceSeriesHash ?? "unavailable",
      state: (["CREATED", "CREATED", "ACTIVE", "ENDED", "RESOLVED", "CANCELLED"] as const)[battle.state] ?? "CANCELLED",
      pnlAMicros: battle.pnlA === undefined ? undefined : numeric(battle.pnlA),
      pnlBMicros: battle.pnlB === undefined ? undefined : numeric(battle.pnlB),
      result: battle.result === undefined ? undefined : (["CREATURE_A", "CREATURE_B", "TIE"] as BattleResult[])[battle.result],
      cancellationReason: battle.cancellationReason,
      onchainCommitment: "ONCHAIN",
    }));
    const chambers = this.chambers(snapshot);
    const standings = snapshot.Creature.map((value) => ({
      creature: creatures.get(value.id)!,
      battleWins: numeric(value.battleWins), battleLosses: numeric(value.battleLosses),
      battleTies: numeric(value.battleTies), virtualPnlMicros: numeric(value.virtualPnl),
      omenCounts: { BUY: numeric(value.omenBuy), HOLD: numeric(value.omenHold), SELL: numeric(value.omenSell) },
      totalBacked: snapshot.Chamber.filter((room) => room.creatureId === value.id)
        .reduce((sum, room) => sum + BigInt(room.volume), 0n).toString(),
    })).sort((left, right) => right.battleWins - left.battleWins || right.virtualPnlMicros - left.virtualPnlMicros);
    return {
      standings,
      battles,
      recentMarkets: chambers.flatMap((chamber) => chamber.marketHistory).slice(0, 20),
      mostActiveChamber: [...snapshot.Chamber].sort((a, b) => numeric(b.omenCount) - numeric(a.omenCount))[0]?.id ?? null,
      mostBackedCreature: [...standings].sort((a, b) => {
        const left = BigInt(a.totalBacked), right = BigInt(b.totalBacked);
        return left === right ? 0 : left > right ? -1 : 1;
      })[0]?.creature.name ?? null,
      disclaimer: "Indexed creature performance is virtual PnL from declared scoring commitments, not financial advice or predictive accuracy.",
    };
  }

  private chambers(snapshot: IndexedSnapshot): ChamberView[] {
    const creatures = new Map(snapshot.Creature.map((value) => [value.id, this.creature(value)]));
    return snapshot.Chamber.map((room) => {
      const creature = creatures.get(room.creatureId) ?? this.unknownCreature(room.creatureId);
      const omens = snapshot.Omen.filter((omen) => omen.chamberId === room.id)
        .sort((a, b) => numeric(b.sequence) - numeric(a.sequence))
        .map((omen) => ({
          value: omenValues[omen.omenType] ?? "HOLD",
          sequence: numeric(omen.sequence),
          observedAt: secondsToIso(omen.observedAt),
          behaviorType: `INDEXED_${omen.behaviorType}`,
          provenanceHash: omen.provenanceHash,
        }));
      const markets = snapshot.Market.filter((market) => market.chamberId === room.id)
        .sort((a, b) => numeric(b.id) - numeric(a.id))
        .map((market) => this.market(market, snapshot.Prediction));
      const activeMarket = markets.find((market) => market.state === "OPEN" || market.state === "LOCKED") ?? null;
      const indexedMode = room.sourceMode ?? 0;
      return {
        id: room.id,
        slug: slugFor(room.id),
        creature,
        status: roomStatuses[room.status] ?? "PAUSED",
        asset: "Configured onchain",
        sourceMode: (["FIXTURE", "REPLAY", "LIVE"] as SourceMode[])[indexedMode] ?? "REPLAY",
        sourceLabel: indexedMode === 2
          ? "Indexed live-adapter configuration; source liveness is not attested"
          : "Indexed Chamber configuration; media remains offchain",
        ownerId: room.owner ?? "unavailable",
        rulesetTemplate: "ZONE_STANDARD",
        rulesetHash: room.rulesetHash,
        latestOmen: omens[0] ?? null,
        activeMarket,
        observation: null,
        behavior: null,
        proof: null,
        omenHistory: omens,
        marketHistory: markets.filter((market) => market !== activeMarket),
        fixtureFrame: { x: 0.5, y: 0.5, label: "Offchain media unavailable" },
      };
    });
  }

  private market(value: IndexedMarket, predictions: IndexedPrediction[]): MarketView {
    const totals = { BUY: 0n, HOLD: 0n, SELL: 0n };
    for (const prediction of predictions.filter((entry) => entry.marketId === value.id)) {
      const outcome = omenValues[prediction.outcome];
      if (outcome) totals[outcome] += BigInt(prediction.amount);
    }
    return {
      id: numeric(value.id), chamberId: value.chamberId,
      state: marketStates[value.state] ?? "CANCELLED",
      opensAt: secondsToIso(value.opensAt), locksAt: secondsToIso(value.locksAt),
      resolutionDeadline: secondsToIso(value.resolutionDeadline),
      minOmenSequence: numeric(value.minOmenSequence),
      resolvingSequence: value.resolvingSequence === undefined ? undefined : numeric(value.resolvingSequence),
      winningOutcome: value.winningOutcome === undefined ? undefined : omenValues[value.winningOutcome],
      pools: { BUY: totals.BUY.toString(), HOLD: totals.HOLD.toString(), SELL: totals.SELL.toString() },
      totalPool: value.volume, positions: {},
      cancellationReason: value.cancellationReason, mode: "CONTRACT",
    };
  }

  private creature(value: IndexedCreature): Creature {
    const species = (["Hamster", "Fish", "Turtle"] as const)[value.species] ?? "Hamster";
    return {
      id: value.id,
      name: `${species} ${value.id.replace(/^0x/, "").slice(0, 6)}`,
      species,
      description: `Metadata commitment ${value.metadataHash}`,
    };
  }

  private unknownCreature(id: string): Creature {
    return {
      id, name: `Creature ${id.replace(/^0x/, "").slice(0, 6)}`, species: "Hamster",
      description: "Indexed metadata unavailable",
    };
  }

  private snapshot(): Promise<IndexedSnapshot> {
    return this.query<IndexedSnapshot>(`query AugurSnapshot {
      Creature { id species metadataHash omenBuy omenHold omenSell battleWins battleLosses battleTies virtualPnl }
      Chamber { id creatureId rulesetHash owner sourceMode status latestSequence omenCount volume }
      Omen(order_by: { blockNumber: desc }) { chamberId creatureId sequence omenType behaviorType observedAt provenanceHash }
      Market(order_by: { id: desc }) { id chamberId state opensAt locksAt resolutionDeadline minOmenSequence winningOutcome resolvingSequence cancellationReason volume }
      Prediction { marketId outcome amount }
      Battle(order_by: { startsAt: desc }) { id creatureA creatureB chamberA chamberB asset startsAt endsAt startingNotional scoringConfigHash state result pnlA pnlB priceSeriesHash cancellationReason }
    }`);
  }

  private async query<T>(query: string): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }), cache: "no-store", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Envio request failed with status ${response.status}`);
    const body = await response.json() as { data?: T; errors?: Array<{ message: string }> };
    if (body.errors?.length || !body.data) {
      throw new Error("Envio query failed; local fixtures were not substituted");
    }
    return body.data;
  }
}

export function getDataSource(): AugurDataSource {
  const endpoint = process.env.ENVIO_GRAPHQL_URL;
  return endpoint ? new EnvioDataSource(endpoint) : new LocalDataSource();
}
