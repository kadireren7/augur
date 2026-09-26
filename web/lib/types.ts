export type Species = "Hamster" | "Fish" | "Turtle";
export type OmenValue = "BUY" | "HOLD" | "SELL";
export type SourceMode = "FIXTURE" | "REPLAY" | "LIVE";
export type ChamberStatus = "ACTIVE" | "PAUSED" | "CLOSED";
export type MarketState = "OPEN" | "LOCKED" | "RESOLVED" | "CANCELLED";
export type TransactionPhase = "IDLE" | "PENDING" | "CONFIRMED" | "FAILED" | "REJECTED";

export interface Creature {
  id: string;
  name: string;
  species: Species;
  description: string;
}

export interface ObservationView {
  zone: "LEFT" | "CENTER" | "RIGHT";
  direction: "LEFT" | "RIGHT" | "STATIONARY";
  confidence: number;
  dwellMs: number;
  observedAt: string;
}

export interface BehaviorView {
  type: string;
  parameters: Record<string, string | number>;
  confidence: number;
  rulesetVersion: string;
}

export interface OmenView {
  value: OmenValue;
  sequence: number;
  observedAt: string;
  behaviorType: string;
  provenanceHash: string;
}

export interface ProofView {
  schemaVersion: string;
  creatureId: string;
  chamberId: string;
  sourceSegmentId: string;
  sourceHash: string;
  captureStart: string;
  captureEnd: string;
  detectionHash: string;
  behaviorType: string;
  behaviorParameters: Record<string, string | number>;
  behaviorConfidence: number;
  behaviorRulesetVersion: string;
  behaviorRulesetHash: string;
  omenValue: OmenValue;
  omenSequence: number;
  omenRulesetVersion: string;
  omenRulesetHash: string;
  manifestHash: string;
  integrityVerified: boolean;
  sourceTrust: "OPERATOR_PROVIDED_FIXTURE" | "OPERATOR_PROVIDED_REPLAY" | "UNATTESTED_LIVE";
  publicationState: "LOCAL_ONLY" | "PENDING" | "ONCHAIN" | "FAILED";
  chainId?: number;
  transactionHash?: `0x${string}`;
  eventIndex?: number;
}

export interface PoolTotals {
  BUY: number;
  HOLD: number;
  SELL: number;
}

export interface UserMarketPosition {
  BUY: number;
  HOLD: number;
  SELL: number;
  approved: number;
  claimed: boolean;
  refunded: boolean;
  claimable: number;
  refundable: number;
}

export interface MarketView {
  id: number;
  chamberId: string;
  state: MarketState;
  opensAt: string;
  locksAt: string;
  resolutionDeadline: string;
  minOmenSequence: number;
  resolvingSequence?: number;
  winningOutcome?: OmenValue;
  pools: PoolTotals;
  totalPool: number;
  positions: Record<string, UserMarketPosition>;
  cancellationReason?: string;
  mode: "LOCAL_DEMO" | "CONTRACT";
}

export interface ChamberSummary {
  id: string;
  slug: string;
  creature: Creature;
  status: ChamberStatus;
  asset: string;
  sourceMode: SourceMode;
  sourceLabel: string;
  latestOmen: OmenView;
  activeMarket: MarketView | null;
}

export interface ChamberView extends ChamberSummary {
  observation: ObservationView;
  behavior: BehaviorView;
  proof: ProofView;
  omenHistory: OmenView[];
  marketHistory: MarketView[];
  fixtureFrame: { x: number; y: number; label: string };
}

export interface ChatMessage {
  id: string;
  chamberId: string;
  sessionId: string;
  displayName: string;
  text: string;
  createdAt: string;
  moderated: boolean;
}

export type ReactionValue = OmenValue | "HYPE" | "RIP";

export interface ReactionPulse {
  chamberId: string;
  counts: Record<ReactionValue, number>;
  percentages: PoolTotals;
  totalDirectional: number;
}

export type BattleState = "CREATED" | "ACTIVE" | "ENDED" | "RESOLVED" | "CANCELLED";
export type BattleResult = "CREATURE_A" | "CREATURE_B" | "TIE";

export interface BattleView {
  id: string;
  creatureA: Creature;
  creatureB: Creature;
  chamberA: string;
  chamberB: string;
  asset: string;
  startsAt: string;
  endsAt: string;
  startingNotionalMicros: number;
  scoringConfigHash: string;
  priceSourceId: string;
  priceSeriesHash: string;
  state: BattleState;
  pnlAMicros?: number;
  pnlBMicros?: number;
  result?: BattleResult;
  cancellationReason?: string;
  onchainCommitment: "LOCAL_ONLY" | "ONCHAIN";
}

export interface CreatureStanding {
  creature: Creature;
  battleWins: number;
  battleLosses: number;
  battleTies: number;
  virtualPnlMicros: number;
  omenCounts: PoolTotals;
  totalBacked: number;
}

export interface ChronicleView {
  standings: CreatureStanding[];
  battles: BattleView[];
  recentMarkets: MarketView[];
  mostActiveChamber: string | null;
  mostBackedCreature: string | null;
  disclaimer: string;
}

export interface TransactionFeedback {
  phase: TransactionPhase;
  message: string;
  transactionHash?: `0x${string}`;
  mode: "LOCAL_DEMO" | "CONTRACT";
}
