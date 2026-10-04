import { poolTotal, type PracticeRound } from "@/lib/practice-exchange";

/** Recorded demo actions only. Legacy samples without timestamps are not invented. */
export function practiceChartData(round: PracticeRound) {
  const points = new Map<number, { time: number; BUY: number; HOLD: number; SELL: number; volume: number }>();
  for (const sample of round.samples) {
    if (sample.at === undefined) continue;
    const time = Math.floor(sample.at / 1000), total = poolTotal(sample);
    const previous = points.get(time);
    points.set(time, {
      time, BUY: total ? sample.BUY / total * 100 : 0,
      HOLD: total ? sample.HOLD / total * 100 : 0,
      SELL: total ? sample.SELL / total * 100 : 0,
      volume: (previous?.volume ?? 0) + (sample.volume ?? 0),
    });
  }
  const markers = round.positions.filter((position) => position.actor === "You" && position.at !== undefined)
    .map((position) => ({ time: Math.floor(position.at! / 1000), outcome: position.outcome, stake: position.stake }))
    .filter((position) => points.has(position.time));
  return { points: [...points.values()].sort((a, b) => a.time - b.time), markers };
}
