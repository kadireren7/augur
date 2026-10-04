import { z } from "zod";

export const practiceCreatures = ["pablo", "bubbles", "turbo"] as const;
export type PracticeCreature = typeof practiceCreatures[number];
export const practiceOutcomes = ["BUY", "HOLD", "SELL"] as const;
export type PracticeOutcome = typeof practiceOutcomes[number];
export const PRACTICE_STORAGE = "augur.practice.exchange.v1";
export const OPEN_MS = 22000;
export const LOCK_MS = 4000;
export const RESULT_MS = 10000;
const actorNames = ["Mira", "Atlas", "Finn", "Cedar", "Nova", "Sol"];
const names = { pablo: "Pablo", bubbles: "Bubbles", turbo: "Turbo" };
const amounts = z.number().int().min(0).max(10000000);
const choice = z.enum(practiceOutcomes);
const key = z.enum(practiceCreatures);
const position = z.object({ actor: z.string().max(30), outcome: choice, stake: amounts, at: z.number().optional() });
const sample = z.object({ BUY: amounts, HOLD: amounts, SELL: amounts, at: z.number().optional(), volume: amounts.optional() });
const roundSchema = z.object({
  creature: key, number: z.number().int().positive(), openedAt: z.number(), pulse: z.number().int(),
  phase: z.enum(["OPEN", "LOCKED", "RESOLVED"]), winner: choice.nullable(),
  positions: z.array(position).max(150), samples: z.array(sample).max(60),
});
const resultSchema = z.object({
  id: z.string(), creature: key, round: z.number().int(), winner: choice,
  stake: amounts, payout: amounts, claimed: z.boolean(), at: z.number(),
  total: amounts, winningPool: amounts,
});
const eventSchema = z.object({ id: z.string(), text: z.string().max(180), kind: z.enum(["stake", "result", "claim", "lock"]), at: z.number(), pnl: z.number().int().optional() });
const stateSchema = z.object({
  version: z.literal(1), balance: amounts,
  rounds: z.object({ pablo: roundSchema, bubbles: roundSchema, turbo: roundSchema }),
  results: z.array(resultSchema).max(1500), events: z.array(eventSchema).max(40),
});
export type PracticeState = z.infer<typeof stateSchema>;
export type PracticeRound = z.infer<typeof roundSchema>;
export function practicePools(round: PracticeRound) {
  const pools = { BUY: 0, HOLD: 0, SELL: 0 };
  for (const position of round.positions) pools[position.outcome] += position.stake;
  return pools;
}
export const poolTotal = (pools: ReturnType<typeof practicePools>) => pools.BUY + pools.HOLD + pools.SELL;
export function estimatedPracticePayout(round: PracticeRound, outcome: PracticeOutcome, stake: number) {
  const pools = practicePools(round);
  return stake > 0 && Number.isSafeInteger(stake)
    ? Math.floor((poolTotal(pools) + stake) * stake / (pools[outcome] + stake)) : 0;
}
function newRound(creature: PracticeCreature, number: number, now: number): PracticeRound {
  const index = practiceCreatures.indexOf(creature);
  const positions = actorNames.map((actor, actorIndex) => ({
    actor, outcome: practiceOutcomes[(actorIndex + number + index) % 3],
    stake: 8 + ((number * 7 + actorIndex * 11 + index * 5) % 30), at: now,
  }));
  const round: PracticeRound = { creature, number, openedAt: now, pulse: 0, phase: "OPEN", winner: null, positions, samples: [] };
  round.samples.push({ ...practicePools(round), at: now, volume: 0 });
  return round;
}
export function newPracticeState(now: number): PracticeState {
  return { version: 1, balance: 1000, rounds: {
    pablo: newRound("pablo", 1, now), bubbles: newRound("bubbles", 1, now), turbo: newRound("turbo", 1, now),
  }, results: [], events: [{ id: `start-${now}`, text: "Practice exchange opened. 1,000 demo credits available.", kind: "stake", at: now }] };
}
export function restorePracticeState(raw: string | null, now: number) {
  try {
    const parsed = stateSchema.parse(JSON.parse(raw ?? "null"));
    if (practiceCreatures.some((creature) => parsed.rounds[creature].creature !== creature)) return newPracticeState(now);
    return advancePractice(parsed, now);
  } catch { return newPracticeState(now); }
}
function event(state: PracticeState, entry: PracticeState["events"][number]) {
  state.events = [entry, ...state.events].slice(0, 40);
}
export function advancePractice(previous: PracticeState, now: number): PracticeState {
  const state = structuredClone(previous);
  for (const creature of practiceCreatures) {
    const round = state.rounds[creature];
    const elapsed = Math.max(0, now - round.openedAt);
    if (round.phase === "OPEN" && elapsed < OPEN_MS) {
      const pulse = Math.floor(elapsed / 2000);
      if (pulse > round.pulse) {
        round.pulse = pulse;
        const actor = actorNames[(pulse + round.number) % actorNames.length];
        const outcome = practiceOutcomes[(pulse + practiceCreatures.indexOf(creature)) % 3];
        const stake = 5 + ((pulse * 13 + round.number * 3) % 25);
        round.positions.push({ actor, outcome, stake, at: now });
        round.samples = [...round.samples, { ...practicePools(round), at: now, volume: stake }].slice(-60);
        event(state, { id: `${creature}-${round.number}-pulse-${pulse}`, text: `${actor} · ${names[creature]} · ${stake} credits on ${outcome}`, kind: "stake", at: now });
      }
    }
    if (round.phase === "OPEN" && elapsed >= OPEN_MS) {
      round.phase = "LOCKED";
      event(state, { id: `${creature}-${round.number}-lock`, text: `${names[creature]} · round ${round.number} locked`, kind: "lock", at: now });
    }
    if (round.phase === "LOCKED" && elapsed >= OPEN_MS + LOCK_MS) {
      round.phase = "RESOLVED";
      // Explicit fixture sequence: never claims to analyze the viewing footage.
      round.winner = practiceOutcomes[(round.number + practiceCreatures.indexOf(creature)) % 3];
      const pools = practicePools(round), total = poolTotal(pools), winningPool = pools[round.winner];
      const user = round.positions.filter((position) => position.actor === "You");
      const stake = user.reduce((sum, position) => sum + position.stake, 0);
      const winningStake = user.filter((position) => position.outcome === round.winner).reduce((sum, position) => sum + position.stake, 0);
      const payout = winningPool ? Math.floor(total * winningStake / winningPool) : stake;
      state.results = [{ id: `${creature}-${round.number}`, creature, round: round.number, winner: round.winner, stake, payout, claimed: stake === 0 || payout === 0, at: now, total, winningPool }, ...state.results].filter((entry, index) => index < 30 || !entry.claimed);
      for (const actor of [...actorNames, "You"]) {
        const own = round.positions.filter((position) => position.actor === actor);
        const backed = own.reduce((sum, position) => sum + position.stake, 0);
        if (!backed) continue;
        const winning = own.filter((position) => position.outcome === round.winner).reduce((sum, position) => sum + position.stake, 0);
        const returned = winningPool ? Math.floor(total * winning / winningPool) : backed;
        event(state, { id: `${creature}-${round.number}-${actor}-result`, text: `${actor} · ${names[creature]} · ${round.winner} resolved`, kind: "result", pnl: returned - backed, at: now });
      }
    }
    if (round.phase === "RESOLVED" && elapsed >= OPEN_MS + LOCK_MS + RESULT_MS) {
      state.rounds[creature] = newRound(creature, round.number + 1, now);
    }
  }
  return state;
}
export function placePracticePrediction(previous: PracticeState, creature: PracticeCreature, outcome: PracticeOutcome, stake: number, now: number) {
  const state = advancePractice(previous, now), round = state.rounds[creature];
  if (round.phase !== "OPEN") throw new Error("This round is locked. The next round opens shortly.");
  if (round.positions.length >= 100) throw new Error("This practice round is full. Join the next round.");
  if (!practiceOutcomes.includes(outcome)) throw new Error("Choose BUY, HOLD or SELL.");
  if (!Number.isSafeInteger(stake) || stake < 1 || stake > state.balance || stake > 1000) throw new Error("Enter 1–1,000 credits within your available balance.");
  state.balance -= stake;
  round.positions.push({ actor: "You", outcome, stake, at: now });
  round.samples = [...round.samples, { ...practicePools(round), at: now, volume: stake }].slice(-60);
  event(state, { id: `you-${creature}-${round.number}-${round.positions.length}`, text: `You · ${names[creature]} · ${stake} credits on ${outcome}`, kind: "stake", at: now });
  return state;
}
export function claimPracticeResult(previous: PracticeState, id: string, now: number) {
  const state = structuredClone(previous), result = state.results.find((entry) => entry.id === id);
  if (!result || result.claimed || result.payout <= 0) throw new Error("No unclaimed demo payout for this round.");
  state.balance += result.payout; result.claimed = true;
  event(state, { id: `claim-${id}`, text: `You claimed ${result.payout} credits · ${names[result.creature]}`, kind: "claim", pnl: result.payout - result.stake, at: now });
  return state;
}
