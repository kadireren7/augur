"use client";

import { useCallback, useEffect, useState } from "react";

import { formatAugd } from "@/lib/token-amount";
import { CreatureArt } from "@/components/creature-art";
import type { ShowcaseState } from "@/lib/types";

export function ShowcaseClient({ initial }: { initial: ShowcaseState }) {
  const [showcase, setShowcase] = useState(initial);
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(5_000);
  const [error, setError] = useState("");

  const cycle = useCallback(async () => {
    setError("");
    const response = await fetch("/api/showcase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ durationMs: duration, predictionsPerChamber: 9 }),
    });
    const body = await response.json();
    if (!response.ok) {
      setRunning(false);
      setError(body.message ?? "Showcase cycle failed");
      return;
    }
    setShowcase(body.showcase);
  }, [duration]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void cycle(), duration);
    return () => window.clearInterval(timer);
  }, [cycle, duration, running]);

  return (
    <div className="page-shell">
      <section className="page-heading"><div><p className="eyebrow">Concurrent market replay</p><h1>Watch the rounds unfold.</h1><p>All activity and timings on this page are local unless the mode label explicitly says testnet.</p></div><span className="mode-badge warning">{showcase.mode} metrics</span></section>
      <section className="panel controls"><label className="field">Round duration<select onChange={(event) => setDuration(Number(event.target.value))} value={duration}><option value="5000">5 seconds</option><option value="10000">10 seconds</option><option value="15000">15 seconds</option></select></label><div className="button-row"><button className="button" onClick={() => void cycle()} type="button">Run one round</button><button className="button secondary" onClick={() => setRunning((value) => !value)} type="button">{running ? "Stop cycles" : "Start cycles"}</button></div></section>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="card-grid showcase-grid">{showcase.chambers.map((chamber) => <article className="card" key={chamber.id}><p className="eyebrow">Round {showcase.rounds[chamber.id] ?? 0} · {chamber.sourceMode}</p><div className="showcase-card-heading"><h2>{chamber.creature.name}</h2><CreatureArt species={chamber.creature.species} /></div><dl className="facts"><div><dt>Sequence</dt><dd>{chamber.latestOmen?.sequence ?? "—"}</dd></div><div><dt>Omen</dt><dd>{chamber.latestOmen?.value ?? "NONE"}</dd></div><div><dt>Observation</dt><dd>{chamber.observation?.zone ?? "NONE"}</dd></div><div><dt>Behavior</dt><dd>{chamber.behavior?.type ?? "NONE"}</dd></div><div><dt>Market</dt><dd>{chamber.activeMarket?.state ?? "NONE"}</dd></div><div><dt>Pool</dt><dd>{formatAugd(chamber.activeMarket?.totalPool ?? 0)} AUGD</dd></div></dl></article>)}</section>
      <section className="two-column"><article className="panel"><h2>Operation totals</h2><dl className="facts"><div><dt>Attempted</dt><dd>{showcase.operationsAttempted}</dd></div><div><dt>Succeeded</dt><dd>{showcase.operationsSucceeded}</dd></div><div><dt>Errors</dt><dd>{showcase.errors}</dd></div></dl><p className="notice">These are local application operations, not Monad TPS measurements.</p></article><article className="panel"><h2>Latest pools</h2>{showcase.chambers.map((chamber) => <p className="history-row" key={chamber.id}><strong>{chamber.creature.name}</strong><span>BUY {formatAugd(chamber.activeMarket?.pools.BUY ?? 0)} · HOLD {formatAugd(chamber.activeMarket?.pools.HOLD ?? 0)} · SELL {formatAugd(chamber.activeMarket?.pools.SELL ?? 0)}</span></p>)}</article></section>
      <section className="panel event-stream" aria-live="polite" aria-relevant="additions"><div className="panel-heading"><h2>Round event stream</h2><span className="mode-badge">{running ? "Cycles running" : "Cycles paused"}</span></div>{showcase.events.length === 0 ? <p className="empty">Run a round to populate the stream.</p> : showcase.events.map((event) => <p className="history-row" key={event.id}><strong>{event.chamberId} · round {event.round} · {event.phase}</strong><span>{event.detail}{event.localDurationMs === undefined ? "" : ` · ${event.localDurationMs} ms LOCAL`}</span></p>)}</section>
    </div>
  );
}
