import { createHash } from "node:crypto";

import type {
  BattleView,
  ChamberView,
  Creature,
  MarketView,
  OmenValue,
  ProofView,
} from "@/lib/types";

function hash(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

const creatures: Record<string, Creature> = {
  pablo: {
    id: "hamster-pablo",
    name: "Pablo",
    species: "Hamster",
    description: "Controlled zone and motion fixture; no claim of financial understanding.",
  },
  bubbles: {
    id: "fish-bubbles",
    name: "Bubbles",
    species: "Fish",
    description: "Controlled tank-region fixture with boundary crossings.",
  },
  turbo: {
    id: "turtle-turbo",
    name: "Turbo",
    species: "Turtle",
    description: "Controlled slow-threshold fixture with dwell behavior.",
  },
};

function proof(
  slug: string,
  creature: Creature,
  omen: OmenValue,
  sequence: number,
  observedAt: Date,
): ProofView {
  const chamberId = `chamber-${slug}`;
  const segmentId = `fixture-${slug}-${sequence}`;
  const rulesetHash = hash(`augur-${creature.species.toLowerCase()}-rules-1.0.0`);
  const manifestHash = hash(`${segmentId}:${omen}:${sequence}:${rulesetHash}`);
  return {
    schemaVersion: "1.0.0",
    creatureId: creature.id,
    chamberId,
    sourceSegmentId: segmentId,
    sourceHash: hash(`source:${segmentId}`),
    captureStart: new Date(observedAt.getTime() - 1_000).toISOString(),
    captureEnd: observedAt.toISOString(),
    detectionHash: hash(`detections:${segmentId}`),
    behaviorType: "ZONE_ENTRY",
    behaviorParameters: { zone: omen === "BUY" ? "RIGHT" : omen === "SELL" ? "LEFT" : "CENTER" },
    behaviorConfidence: 0.96,
    behaviorRulesetVersion: "1.0.0",
    behaviorRulesetHash: rulesetHash,
    omenValue: omen,
    omenSequence: sequence,
    omenRulesetVersion: "1.0.0",
    omenRulesetHash: rulesetHash,
    manifestHash,
    integrityVerified: true,
    sourceTrust: "OPERATOR_PROVIDED_FIXTURE",
    publicationState: "LOCAL_ONLY",
  };
}

function emptyMarket(id: number, chamberId: string, minSequence: number, now: Date): MarketView {
  return {
    id,
    chamberId,
    state: "OPEN",
    opensAt: now.toISOString(),
    locksAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    resolutionDeadline: new Date(now.getTime() + 10 * 60_000).toISOString(),
    minOmenSequence: minSequence,
    pools: { BUY: 0, HOLD: 0, SELL: 0 },
    totalPool: 0,
    positions: {},
    mode: "LOCAL_DEMO",
  };
}

export function createSeed(now = new Date()): {
  chambers: ChamberView[];
  battles: BattleView[];
  nextFixtureOmen: Record<string, OmenValue>;
} {
  const configurations = [
    { slug: "pablo", omen: "BUY" as const, sequence: 3, zone: "RIGHT" as const, x: 0.84 },
    { slug: "bubbles", omen: "SELL" as const, sequence: 3, zone: "LEFT" as const, x: 0.2 },
    { slug: "turbo", omen: "BUY" as const, sequence: 2, zone: "RIGHT" as const, x: 0.75 },
  ];
  const chambers = configurations.map((configuration, index): ChamberView => {
    const creature = creatures[configuration.slug];
    const observedAt = new Date(now.getTime() - (index + 1) * 15_000);
    const currentProof = proof(
      configuration.slug,
      creature,
      configuration.omen,
      configuration.sequence,
      observedAt,
    );
    const currentOmen = {
      value: configuration.omen,
      sequence: configuration.sequence,
      observedAt: observedAt.toISOString(),
      behaviorType: "ZONE_ENTRY",
      provenanceHash: currentProof.manifestHash,
    };
    return {
      id: `chamber-${configuration.slug}`,
      slug: configuration.slug,
      creature,
      status: "ACTIVE",
      asset: "MON / USD (fixture)",
      sourceMode: "FIXTURE",
      sourceLabel: "Deterministic centroid fixture — not live video",
      ownerId: "augur-operator",
      rulesetTemplate: "ZONE_STANDARD",
      rulesetHash: currentProof.omenRulesetHash,
      latestOmen: currentOmen,
      activeMarket: emptyMarket(index + 1, `chamber-${configuration.slug}`, configuration.sequence + 1, now),
      observation: {
        zone: configuration.zone,
        direction: "RIGHT",
        confidence: 0.96,
        dwellMs: 500,
        observedAt: observedAt.toISOString(),
      },
      behavior: {
        type: "ZONE_ENTRY",
        parameters: { zone: configuration.zone },
        confidence: 0.96,
        rulesetVersion: "1.0.0",
      },
      proof: currentProof,
      omenHistory: [currentOmen],
      marketHistory: [],
      fixtureFrame: { x: configuration.x, y: 0.5, label: `${configuration.zone} zone` },
    };
  });

  const battleStart = new Date(now.getTime() - 20 * 60_000);
  const battleEnd = new Date(now.getTime() - 15 * 60_000);
  const battle: BattleView = {
    id: "battle-pablo-bubbles-001",
    creatureA: creatures.pablo,
    creatureB: creatures.bubbles,
    chamberA: "chamber-pablo",
    chamberB: "chamber-bubbles",
    asset: "MON",
    startsAt: battleStart.toISOString(),
    endsAt: battleEnd.toISOString(),
    startingNotionalMicros: 1_000_000,
    scoringConfigHash: hash("MON:equal-notional:battle-scoring-1.0.0"),
    priceSourceId: "fixture:mon-001",
    priceSeriesHash: hash("1000000,1100000,1000000,1200000"),
    state: "RESOLVED",
    pnlAMicros: 209_090,
    pnlBMicros: -209_090,
    result: "CREATURE_A",
    onchainCommitment: "LOCAL_ONLY",
  };

  return {
    chambers,
    battles: [battle],
    nextFixtureOmen: {
      "chamber-pablo": "HOLD",
      "chamber-bubbles": "BUY",
      "chamber-turbo": "SELL",
    },
  };
}

export function createProofForAdvance(
  chamber: ChamberView,
  omen: OmenValue,
  sequence: number,
  observedAt: Date,
): ProofView {
  return proof(chamber.slug, chamber.creature, omen, sequence, observedAt);
}
