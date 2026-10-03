import type { ChronicleView, CreatureStanding, OmenValue, PoolTotals } from "@/lib/types";
import type { AugurStore } from "@/lib/store";

const emptyCounts = (): PoolTotals => ({ BUY: 0, HOLD: 0, SELL: 0 });

export function buildChronicle(store: AugurStore): ChronicleView {
  const chambers = store.listChambers();
  const battles = [...store.battles.values()];
  const standings = new Map<string, CreatureStanding & { totalBacked: number }>();
  for (const chamber of chambers) {
    const omenCounts = emptyCounts();
    for (const omen of chamber.omenHistory) omenCounts[omen.value] += 1;
    const totalBacked = [chamber.activeMarket, ...chamber.marketHistory]
      .filter((market) => market !== null)
      .reduce((total, market) => total + market.totalPool, 0);
    standings.set(chamber.creature.id, {
      creature: chamber.creature,
      battleWins: 0,
      battleLosses: 0,
      battleTies: 0,
      virtualPnlMicros: 0,
      omenCounts,
      totalBacked,
    });
  }
  for (const battle of battles) {
    if (battle.state !== "RESOLVED" || battle.result === undefined) continue;
    const sideA = standings.get(battle.creatureA.id);
    const sideB = standings.get(battle.creatureB.id);
    if (!sideA || !sideB) continue;
    sideA.virtualPnlMicros += battle.pnlAMicros ?? 0;
    sideB.virtualPnlMicros += battle.pnlBMicros ?? 0;
    if (battle.result === "TIE") {
      sideA.battleTies += 1;
      sideB.battleTies += 1;
    } else if (battle.result === "CREATURE_A") {
      sideA.battleWins += 1;
      sideB.battleLosses += 1;
    } else {
      sideB.battleWins += 1;
      sideA.battleLosses += 1;
    }
  }
  const sorted = [...standings.values()].sort(
    (left, right) => right.battleWins - left.battleWins || right.virtualPnlMicros - left.virtualPnlMicros,
  );
  const mostActive = [...chambers].sort(
    (left, right) => right.omenHistory.length - left.omenHistory.length,
  )[0];
  const mostBacked = [...sorted].sort((left, right) => right.totalBacked - left.totalBacked)[0];
  return {
    standings: sorted,
    battles,
    recentMarkets: chambers.flatMap((chamber) => chamber.marketHistory).slice(0, 20),
    mostActiveChamber: mostActive?.creature.name ?? null,
    mostBackedCreature: mostBacked && mostBacked.totalBacked > 0 ? mostBacked.creature.name : null,
    disclaimer:
      "Creature performance is deterministic virtual PnL from declared replay data, not financial advice or evidence of predictive ability.",
  };
}

export function countOmens(values: OmenValue[]): PoolTotals {
  const counts = emptyCounts();
  for (const value of values) counts[value] += 1;
  return counts;
}
