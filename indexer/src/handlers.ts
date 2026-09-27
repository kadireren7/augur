import { indexer } from "envio";

const eventId = (event: { chainId: number; block: { number: number }; logIndex: number }) =>
  `${event.chainId}-${event.block.number}-${event.logIndex}`;

indexer.onEvent(
  { contract: "CreatureRegistry", event: "CreatureRegistered" },
  async ({ event, context }) => {
    context.Creature.set({
      id: event.params.creatureId,
      species: Number(event.params.species),
      metadataHash: event.params.metadataHash,
      owner: event.params.owner,
      operator: event.params.operator,
      active: true,
      registeredAt: BigInt(event.block.timestamp),
      omenBuy: 0n,
      omenHold: 0n,
      omenSell: 0n,
      battleWins: 0n,
      battleLosses: 0n,
      battleTies: 0n,
      virtualPnl: 0n,
    });
  },
);

indexer.onEvent(
  { contract: "CreatureRegistry", event: "CreatureStatusChanged" },
  async ({ event, context }) => {
    const creature = await context.Creature.get(event.params.creatureId);
    if (creature) context.Creature.set({ ...creature, active: event.params.active });
  },
);

indexer.onEvent(
  { contract: "RoomRegistry", event: "ChamberRegistered" },
  async ({ event, context }) => {
    context.Chamber.set({
      id: event.params.chamberId,
      creatureId: event.params.creatureId,
      configHash: event.params.configHash,
      rulesetHash: event.params.rulesetHash,
      publisher: event.params.publisher,
      owner: undefined,
      sourceMode: undefined,
      status: 1,
      latestSequence: 0n,
      omenCount: 0n,
      volume: 0n,
    });
  },
);

indexer.onEvent(
  { contract: "RoomRegistry", event: "PermissionlessChamberRegistered" },
  async ({ event, context }) => {
    const chamber = await context.Chamber.get(event.params.chamberId);
    if (chamber) {
      context.Chamber.set({
        ...chamber,
        owner: event.params.owner,
        sourceMode: Number(event.params.sourceMode),
        rulesetHash: event.params.rulesetHash,
      });
    }
  },
);

indexer.onEvent(
  { contract: "RoomRegistry", event: "ChamberOwnershipSet" },
  async ({ event, context }) => {
    const chamber = await context.Chamber.get(event.params.chamberId);
    if (chamber) context.Chamber.set({ ...chamber, owner: event.params.owner });
  },
);

indexer.onEvent(
  { contract: "RoomRegistry", event: "ChamberStatusChanged" },
  async ({ event, context }) => {
    const chamber = await context.Chamber.get(event.params.chamberId);
    if (chamber) context.Chamber.set({ ...chamber, status: Number(event.params.newStatus) });
  },
);

indexer.onEvent(
  { contract: "RoomRegistry", event: "ChamberConfigurationChanged" },
  async ({ event, context }) => {
    const chamber = await context.Chamber.get(event.params.chamberId);
    if (chamber) {
      context.Chamber.set({
        ...chamber,
        configHash: event.params.configHash,
        rulesetHash: event.params.rulesetHash,
        publisher: event.params.publisher,
      });
    }
  },
);

indexer.onEvent(
  { contract: "OmenPublisher", event: "OmenPublished" },
  async ({ event, context }) => {
    const sequence = BigInt(event.params.sequence);
    context.Omen.set({
      id: `${event.params.chamberId}-${sequence}`,
      chamberId: event.params.chamberId,
      creatureId: event.params.creatureId,
      sequence,
      omenType: Number(event.params.omenType),
      behaviorType: Number(event.params.behaviorType),
      observedAt: BigInt(event.params.observedAt),
      rulesetHash: event.params.rulesetHash,
      provenanceHash: event.params.provenanceHash,
      publisher: event.params.publisher,
      blockNumber: BigInt(event.block.number),
    });
    const chamber = await context.Chamber.get(event.params.chamberId);
    if (chamber) {
      context.Chamber.set({
        ...chamber,
        latestSequence: sequence,
        omenCount: chamber.omenCount + 1n,
      });
    }
    const creature = await context.Creature.get(event.params.creatureId);
    if (creature) {
      const omenType = Number(event.params.omenType);
      context.Creature.set({
        ...creature,
        omenBuy: creature.omenBuy + (omenType === 2 ? 1n : 0n),
        omenHold: creature.omenHold + (omenType === 1 ? 1n : 0n),
        omenSell: creature.omenSell + (omenType === 0 ? 1n : 0n),
      });
    }
  },
);

indexer.onEvent(
  { contract: "NextOmenMarket", event: "MarketOpened" },
  async ({ event, context }) => {
    context.Market.set({
      id: event.params.marketId.toString(),
      chamberId: event.params.chamberId,
      marketType: Number(event.params.marketType),
      state: 1,
      opensAt: BigInt(event.params.opensAt),
      locksAt: BigInt(event.params.locksAt),
      resolutionDeadline: BigInt(event.params.resolutionDeadline),
      minOmenSequence: BigInt(event.params.minOmenSequence),
      maxOmenSequence: BigInt(event.params.maxOmenSequence),
      winningOutcome: undefined,
      resolvingSequence: undefined,
      provenanceHash: undefined,
      cancellationReason: undefined,
      volume: 0n,
    });
  },
);

indexer.onEvent(
  { contract: "NextOmenMarket", event: "PredictionPlaced" },
  async ({ event, context }) => {
    const marketId = event.params.marketId.toString();
    context.Prediction.set({
      id: eventId(event),
      marketId,
      participant: event.params.participant,
      outcome: Number(event.params.outcome),
      amount: event.params.amount,
      blockNumber: BigInt(event.block.number),
    });
    const market = await context.Market.get(marketId);
    if (market) {
      context.Market.set({ ...market, volume: market.volume + event.params.amount });
      const chamber = await context.Chamber.get(market.chamberId);
      if (chamber) {
        context.Chamber.set({ ...chamber, volume: chamber.volume + event.params.amount });
      }
    }
  },
);

indexer.onEvent(
  { contract: "NextOmenMarket", event: "MarketLocked" },
  async ({ event, context }) => {
    const market = await context.Market.get(event.params.marketId.toString());
    if (market) context.Market.set({ ...market, state: 2 });
  },
);

indexer.onEvent(
  { contract: "NextOmenMarket", event: "MarketResolved" },
  async ({ event, context }) => {
    const market = await context.Market.get(event.params.marketId.toString());
    if (market) {
      context.Market.set({
        ...market,
        state: 3,
        winningOutcome: Number(event.params.outcome),
        resolvingSequence: BigInt(event.params.omenSequence),
        provenanceHash: event.params.provenanceHash,
      });
    }
  },
);

indexer.onEvent(
  { contract: "NextOmenMarket", event: "MarketCancelled" },
  async ({ event, context }) => {
    const market = await context.Market.get(event.params.marketId.toString());
    if (market) {
      context.Market.set({ ...market, state: 4, cancellationReason: event.params.reasonCode });
    }
  },
);

for (const [eventName, kind] of [["Claimed", "CLAIM"], ["Refunded", "REFUND"]] as const) {
  indexer.onEvent(
    { contract: "NextOmenMarket", event: eventName },
    async ({ event, context }) => {
      context.UserMarketAction.set({
        id: eventId(event),
        marketId: event.params.marketId.toString(),
        participant: event.params.participant,
        kind,
        amount: event.params.amount,
        blockNumber: BigInt(event.block.number),
      });
    },
  );
}

indexer.onEvent(
  { contract: "BattleCoordinator", event: "BattleOpened" },
  async ({ event, context }) => {
    context.Battle.set({
      id: event.params.battleId,
      creatureA: event.params.creatureA,
      creatureB: event.params.creatureB,
      chamberA: event.params.chamberA,
      chamberB: event.params.chamberB,
      asset: event.params.asset,
      startsAt: BigInt(event.params.startsAt),
      endsAt: BigInt(event.params.endsAt),
      startingNotional: event.params.startingNotional,
      scoringConfigHash: event.params.scoringConfigHash,
      state: 1,
      result: undefined,
      pnlA: undefined,
      pnlB: undefined,
      priceSeriesHash: undefined,
      resolutionHash: undefined,
      cancellationReason: undefined,
    });
  },
);

for (const [eventName, state] of [["BattleActivated", 2], ["BattleEnded", 3]] as const) {
  indexer.onEvent(
    { contract: "BattleCoordinator", event: eventName },
    async ({ event, context }) => {
      const battle = await context.Battle.get(event.params.battleId);
      if (battle) context.Battle.set({ ...battle, state });
    },
  );
}

indexer.onEvent(
  { contract: "BattleCoordinator", event: "BattleResolved" },
  async ({ event, context }) => {
    const battle = await context.Battle.get(event.params.battleId);
    if (battle) {
      context.Battle.set({
        ...battle,
        state: 4,
        result: Number(event.params.result),
        pnlA: event.params.pnlA,
        pnlB: event.params.pnlB,
        priceSeriesHash: event.params.priceSeriesHash,
        resolutionHash: event.params.resolutionHash,
      });
      const [creatureA, creatureB] = await Promise.all([
        context.Creature.get(battle.creatureA),
        context.Creature.get(battle.creatureB),
      ]);
      const result = Number(event.params.result);
      if (creatureA) {
        context.Creature.set({
          ...creatureA,
          battleWins: creatureA.battleWins + (result === 0 ? 1n : 0n),
          battleLosses: creatureA.battleLosses + (result === 1 ? 1n : 0n),
          battleTies: creatureA.battleTies + (result === 2 ? 1n : 0n),
          virtualPnl: creatureA.virtualPnl + event.params.pnlA,
        });
      }
      if (creatureB) {
        context.Creature.set({
          ...creatureB,
          battleWins: creatureB.battleWins + (result === 1 ? 1n : 0n),
          battleLosses: creatureB.battleLosses + (result === 0 ? 1n : 0n),
          battleTies: creatureB.battleTies + (result === 2 ? 1n : 0n),
          virtualPnl: creatureB.virtualPnl + event.params.pnlB,
        });
      }
    }
  },
);

indexer.onEvent(
  { contract: "BattleCoordinator", event: "BattleCancelled" },
  async ({ event, context }) => {
    const battle = await context.Battle.get(event.params.battleId);
    if (battle) {
      context.Battle.set({ ...battle, state: 5, cancellationReason: event.params.reason });
    }
  },
);
