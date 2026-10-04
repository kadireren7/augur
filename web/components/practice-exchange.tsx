"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { advancePractice, claimPracticeResult, estimatedPracticePayout, newPracticeState, OPEN_MS, LOCK_MS, placePracticePrediction, poolTotal, practiceCreatures, practiceOutcomes, practicePools, PRACTICE_STORAGE, restorePracticeState, type PracticeCreature, type PracticeOutcome } from "@/lib/practice-exchange";
import { PoolChart } from "@/components/pool-chart";

const identities = {
  pablo: { name: "Pablo", species: "Hamster", poster: "/media/hamster.jpg", color: "#f1aa8c" },
  bubbles: { name: "Bubbles", species: "Fish", poster: "/media/goldfish.jpg", color: "#84cde5" },
  turbo: { name: "Turbo", species: "Land tortoise", poster: "/media/land-tortoise.jpg", color: "#b2d9a0" },
};
const credits = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function PracticeExchange({ initialCreature = "pablo" }: { initialCreature?: PracticeCreature }) {
  const [state, setState] = useState(() => newPracticeState(0));
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState(0);
  const [creature, setCreature] = useState<PracticeCreature>(initialCreature);
  const [outcome, setOutcome] = useState<PracticeOutcome>("BUY");
  const [stake, setStake] = useState("25");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const now = Date.now();
      let raw: string | null = null;
      try { raw = localStorage.getItem(PRACTICE_STORAGE); } catch { setStorageUnavailable(true); }
      setState(restorePracticeState(raw, now)); setClock(now); setReady(true);
    });
    const timer = setInterval(() => {
      const now = Date.now(); setClock(now); setState((previous) => advancePractice(previous, now));
    }, 1000);
    return () => { cancelAnimationFrame(frame); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(PRACTICE_STORAGE, JSON.stringify(state)); } catch { queueMicrotask(() => setStorageUnavailable(true)); }
  }, [ready, state]);
  const round = state.rounds[creature], pools = practicePools(round), total = poolTotal(pools);
  const amount = Number(stake), estimated = estimatedPracticePayout(round, outcome, amount);
  const seconds = Math.max(0, Math.ceil((round.openedAt + OPEN_MS + (round.phase === "LOCKED" ? LOCK_MS : 0) - clock) / 1000));
  const positions = round.positions.filter((position) => position.actor === "You");
  const claims = state.results.filter((result) => !result.claimed && result.payout > 0);
  const net = state.results.filter((result) => result.stake > 0).reduce((sum, result) => sum + result.payout - result.stake, 0);
  return <section id="practice" className="practice-exchange" aria-label="Playable demo exchange">
    <div className="practice-live-ticker" aria-label="Simulated market activity"><strong><i/>Demo activity</strong><div>{state.events.slice(0, 4).map((entry) => <motion.span key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{entry.text}{entry.pnl !== undefined && <b className={entry.pnl >= 0 ? "buy" : "sell"}> {entry.pnl >= 0 ? "+" : ""}{credits(entry.pnl)}</b>}</motion.span>)}</div></div>
    <div className="practice-heading">
      <div><span className="practice-badge"><i/>DEMO EXCHANGE</span><h2>Watch. Take a position.</h2><p>Play with credits. Watch pools move. Claim when your Omen wins.</p></div>
      <div className="practice-wallet"><span>Your demo balance</span><motion.strong key={state.balance} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>{credits(state.balance)} <small>credits</small></motion.strong><span className={net >= 0 ? "buy" : "sell"}>Settled P&amp;L {net >= 0 ? "+" : ""}{credits(net)}</span></div>
    </div>
    <p className="practice-disclosure">Simulated rounds and players. Credits have no cash value. Replay footage does not generate these demo Omens. No wallet or onchain transaction is used.</p>
    {storageUnavailable && <p className="notice">Browser storage is unavailable. This practice session will not survive a refresh.</p>}
    <div className="practice-room-tabs" role="group" aria-label="Choose demo market">{practiceCreatures.map((id) => {
      const room = state.rounds[id], pool = poolTotal(practicePools(room));
      return <button key={id} aria-pressed={creature === id} type="button" onClick={() => { setCreature(id); setError(""); setFeedback(""); }}>
        <Image src={identities[id].poster} alt="" width={48} height={48}/><span><strong>{identities[id].name}</strong><small>{room.phase} · round {room.number}</small></span><b>{credits(pool)}<small>credits</small></b>
      </button>;
    })}</div>
    <div className="practice-layout">
      <div className="practice-market">
        <div className="practice-market-heading"><div><span>{identities[creature].species} · round {round.number}</span><h3>{identities[creature].name}’s next Omen</h3></div><div className={`practice-countdown ${seconds <= 5 && round.phase === "OPEN" ? "urgent" : ""}`}><span>{round.phase === "OPEN" ? "Locks in" : round.phase === "LOCKED" ? "Omen in" : "Resolved"}</span><strong>{round.phase === "RESOLVED" ? round.winner : `00:${String(seconds).padStart(2, "0")}`}</strong></div></div>
        <div className="practice-pool"><span>Total pool</span><motion.strong key={total} initial={{ opacity: 0.6, y: 3 }} animate={{ opacity: 1, y: 0 }}>{credits(total)} <small>credits</small></motion.strong><span>{round.positions.length} simulated positions</span></div>
        <PoolChart key={`${creature}-${round.number}`} round={round}/>
        <div className="practice-outcomes">{practiceOutcomes.map((choice) => <button type="button" key={choice} className={`${choice.toLowerCase()} ${outcome === choice ? "selected" : ""}`} aria-pressed={outcome === choice} onClick={() => setOutcome(choice)}>
          <span>{choice}</span><strong>{Math.round(pools[choice] / Math.max(1, total) * 100)}<small>%</small></strong><span>{credits(pools[choice])} credits</span><i style={{ width: `${pools[choice] / Math.max(1, total) * 100}%` }}/>
        </button>)}</div>
        <AnimatePresence mode="wait"><motion.div key={`${creature}-${round.number}-${round.phase}`} className={`practice-round-state ${round.phase.toLowerCase()}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {round.phase === "OPEN" ? "Pick the next Omen. Positions close before the reveal." : round.phase === "LOCKED" ? "Positions locked. The demo Omen is about to reveal." : <><strong>{round.winner}</strong> wins this round. The next market opens automatically.</>}
        </motion.div></AnimatePresence>
      </div>
      <aside className="practice-ticket">
        <div className="practice-ticket-heading"><h3>Your position</h3><span className={outcome.toLowerCase()}>{outcome}</span></div>
        <label htmlFor="practice-stake">Stake · demo credits</label>
        <div className="practice-stake-input"><input id="practice-stake" type="number" min="1" max="1000" step="1" value={stake} onChange={(event) => setStake(event.target.value)}/><span>credits</span></div>
        <div className="practice-quick-stakes">{[10, 25, 50, 100].map((value) => <button key={value} type="button" onClick={() => setStake(String(value))}>{value}</button>)}</div>
        <div className="practice-estimate"><span>If {outcome} wins</span><motion.strong key={`${outcome}-${estimated}`} initial={{ opacity: 0.5, y: 3 }} animate={{ opacity: 1, y: 0 }}>{credits(estimated)} <small>credits</small></motion.strong><span>Estimated return, including your stake. Changes as others join.</span></div>
        <button className="button practice-predict" type="button" disabled={!ready || round.phase !== "OPEN"} onClick={() => {
          try { const next = placePracticePrediction(state, creature, outcome, amount, Date.now()); setState(next); setError(""); setFeedback(`${amount} credits placed on ${outcome} for ${identities[creature].name}.`); }
          catch (error) { setError(error instanceof Error ? error.message : "Position unavailable."); setFeedback(""); }
        }}>{!ready ? "Opening practice…" : round.phase === "OPEN" ? `Predict ${outcome}` : round.phase === "LOCKED" ? "Round locked" : "Next round shortly"}</button>
        {error && <p className="error" role="alert">{error}</p>}
        {feedback && <motion.p className="practice-confirmation" role="status" initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>✓ {feedback}</motion.p>}
        <div className="practice-own-positions"><h4>This round</h4>{positions.length ? positions.map((position, index) => <div key={index}><span className={position.outcome.toLowerCase()}>{position.outcome}</span><strong>{credits(position.stake)} credits</strong></div>) : <p>No position yet. Choose an outcome to join.</p>}</div>
        {claims.map((result) => <div className="practice-claim" key={result.id}><span>{identities[result.creature].name} · round {result.round}</span><strong>{credits(result.payout)} credits available</strong><button className="button" type="button" onClick={() => {
          try { setState(claimPracticeResult(state, result.id, Date.now())); setFeedback("Demo payout claimed. Balance updated."); setError(""); }
          catch (error) { setError(error instanceof Error ? error.message : "Claim unavailable."); }
        }}>Claim demo payout</button></div>)}
        <details className="practice-payout-details"><summary>How this pool pays out</summary><p>Winning stakes share the entire pool pro-rata. Losing stakes fund that payout. No platform fee. If there are no winning stakes, participants are refunded. These are demo credits, not AUGD.</p></details>
      </aside>
    </div>
    <div className="practice-bottom">
      <section className="practice-activity"><div className="practice-subheading"><h3>Market activity</h3><span><i/>Simulated players</span></div><div className="practice-activity-rows">
        <AnimatePresence initial={false}>{state.events.slice(0, 12).map((entry) => <motion.div className={`practice-activity-row ${entry.kind}`} key={entry.id} layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <span className="practice-event-icon">{entry.kind === "result" ? "↗" : entry.kind === "claim" ? "✓" : entry.kind === "lock" ? "◷" : "+"}</span><span>{entry.text}</span>{entry.pnl !== undefined && <strong className={entry.pnl >= 0 ? "buy" : "sell"}>{entry.pnl >= 0 ? "+" : ""}{credits(entry.pnl)}</strong>}<time>{clock ? `${Math.max(0, Math.floor((clock - entry.at) / 1000))}s ago` : "Now"}</time>
        </motion.div>)}</AnimatePresence>
      </div></section>
      <section className="practice-history"><div className="practice-subheading"><h3>Your results</h3><button type="button" onClick={() => { setState(newPracticeState(Date.now())); setError(""); setFeedback("Practice balance reset to 1,000 credits."); }}>Reset practice</button></div>
        {state.results.filter((result) => result.stake > 0).length ? state.results.filter((result) => result.stake > 0).slice(0, 8).map((result) => <div className="practice-result-row" key={result.id}><div><strong>{identities[result.creature].name}</strong><span>Round {result.round} · {result.winner}</span></div><strong className={result.payout - result.stake >= 0 ? "buy" : "sell"}>{result.payout - result.stake >= 0 ? "+" : ""}{credits(result.payout - result.stake)}</strong><span>{result.claimed ? result.payout ? "Claimed" : "Settled" : "Claim available"}</span></div>) : <div className="practice-history-empty"><strong>Your first round starts here.</strong><p>Place a position above. Your return or loss appears here after the Omen reveal.</p></div>}
      </section>
    </div>
    <section className="practice-matchups"><div className="practice-subheading"><h3>Creature matchups</h3><span>Demo round comparison</span></div><div className="practice-versus-grid">{[["pablo", "bubbles"], ["bubbles", "turbo"], ["turbo", "pablo"]].map(([left, right]) => <article key={left}>
      {[left, right].map((id, index) => <div key={id}>{index === 1 && <b className="practice-vs">VS</b>}<Image src={identities[id as PracticeCreature].poster} alt="" width={66} height={66}/><strong>{identities[id as PracticeCreature].name}</strong><span>{credits(poolTotal(practicePools(state.rounds[id as PracticeCreature])))} credits in pool</span></div>)}
      <p>Follow their next Omen rounds above. No onchain battle is created.</p>
    </article>)}</div></section>
  </section>;
}
