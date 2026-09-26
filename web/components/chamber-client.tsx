"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { MarketPanel } from "@/components/market-panel";
import { ProofPanel } from "@/components/proof-panel";
import { SocialPanel } from "@/components/social-panel";
import type { ChamberView } from "@/lib/types";

export function ChamberClient({ initial }: { initial: ChamberView }) {
  const [chamber, setChamber] = useState(initial);
  const [advanceError, setAdvanceError] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/chambers/${chamber.slug}`, { cache: "no-store" });
    if (response.ok) setChamber((await response.json()).chamber);
  }, [chamber.slug]);

  async function advance() {
    setAdvanceError("");
    const response = await fetch(`/api/chambers/${chamber.slug}/advance`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) return setAdvanceError(body.message ?? "Fixture advance failed");
    setChamber(body.chamber);
  }

  const displayMarket = chamber.activeMarket ?? chamber.marketHistory[0] ?? null;
  return (
    <div className="page-shell">
      <section className="page-heading">
        <div><p className="eyebrow">{chamber.creature.species} · {chamber.id}</p><h1>{chamber.creature.name}&apos;s Chamber</h1><p>{chamber.creature.description}</p></div>
        <div className="mode-stack"><span className="mode-badge warning">{chamber.sourceMode} · NOT LIVE</span><span className="status active">{chamber.status}</span></div>
      </section>
      <div className="chamber-layout">
        <div className="main-column">
          <section className="panel fixture-stage">
            <div className="panel-heading"><h2>Fixture media</h2><span>{chamber.sourceLabel}</span></div>
            <div className="fixture-box" aria-label={`${chamber.creature.name} centroid in ${chamber.observation.zone} zone`}>
              <div className="zone-lines"><span>SELL</span><span>HOLD</span><span>BUY</span></div>
              <span className="creature-dot" style={{ left: `${chamber.fixtureFrame.x * 100}%`, top: `${chamber.fixtureFrame.y * 100}%` }} />
            </div>
            <button className="button secondary" disabled={!chamber.activeMarket} onClick={() => void advance()} type="button">Advance deterministic fixture</button>
            {advanceError && <p className="error">{advanceError}</p>}
          </section>
          <section className="signal-row">
            <article className="signal"><span>Observation</span><strong>{chamber.observation.zone}</strong><small>{Math.round(chamber.observation.confidence * 100)}% confidence</small></article>
            <article className="signal"><span>Behavior</span><strong>{chamber.behavior.type}</strong><small>rules {chamber.behavior.rulesetVersion}</small></article>
            <article className={`signal omen-card ${chamber.latestOmen.value.toLowerCase()}`}><span>Omen #{chamber.latestOmen.sequence}</span><strong>{chamber.latestOmen.value}</strong><small>{new Date(chamber.latestOmen.observedAt).toLocaleString()}</small></article>
          </section>
          <MarketPanel market={displayMarket} onChanged={refresh} />
          <ProofPanel proof={chamber.proof} />
          <p><Link href={`/chambers/${chamber.slug}/proof`}>Open full provenance record →</Link></p>
        </div>
        <aside><SocialPanel chamberId={chamber.id} /></aside>
      </div>
      <section className="two-column">
        <div className="panel"><h2>Recent Omens</h2>{chamber.omenHistory.map((omen) => <p className="history-row" key={omen.sequence}><strong>#{omen.sequence} {omen.value}</strong><time>{new Date(omen.observedAt).toLocaleString()}</time></p>)}</div>
        <div className="panel"><h2>Market history</h2>{chamber.marketHistory.length === 0 ? <p className="empty">No completed markets.</p> : chamber.marketHistory.map((market) => <p className="history-row" key={market.id}><strong>Market #{market.id} · {market.state}</strong><span>{market.winningOutcome ?? market.cancellationReason}</span></p>)}</div>
      </section>
    </div>
  );
}
