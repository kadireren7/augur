"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MarketPanel } from "@/components/market-panel";
import { ProofPanel } from "@/components/proof-panel";
import { OmenCommitment } from "@/components/omen-commitment";
import { SocialPanel } from "@/components/social-panel";
import { MediaStage } from "@/components/media-stage";
import { ViewingReveal, StateReveal } from "@/components/motion-system";
import { creatureMedia, type MediaSource } from "@/lib/media";
import { behaviorLabel } from "@/lib/behavior-label";
import type { ChamberView } from "@/lib/types";

export function ChamberClient({
  initial,
  dataMode,
  media,
}: {
  initial: ChamberView;
  dataMode: "LOCAL" | "ENVIO";
  media?: MediaSource;
}) {
  const [chamber, setChamber] = useState(initial);
  const [advanceError, setAdvanceError] = useState("");
  const [indexedError, setIndexedError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/chambers/${chamber.slug}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setChamber((await response.json()).chamber);
      setIndexedError("");
    } catch {
      setIndexedError(
        "Indexed update unavailable. Retaining the last successful indexed view; no fixture data substituted.",
      );
    }
  }, [chamber.slug]);
  useEffect(() => {
    if (dataMode !== "ENVIO") return;
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [dataMode, refresh]);

  async function advance() {
    setAdvanceError("");
    const response = await fetch(`/api/chambers/${chamber.slug}/advance`, {
      method: "POST",
    });
    const body = await response.json();
    if (!response.ok)
      return setAdvanceError(body.message ?? "Fixture advance failed");
    setChamber(body.chamber);
  }

  const displayMarket =
    chamber.activeMarket ?? chamber.marketHistory[0] ?? null;
  const fixtureMode =
    dataMode === "LOCAL" &&
    displayMarket?.mode !== "CONTRACT" &&
    chamber.sourceMode === "FIXTURE";
  const contractData =
    dataMode === "ENVIO" || displayMarket?.mode === "CONTRACT";
  const publishedBehavior = behaviorLabel(
    chamber.behavior?.type ?? chamber.latestOmen?.behaviorType,
  );
  return (
    <div
      className={`page-shell chamber-shell ${creatureMedia[chamber.creature.species].accent}`}
    >
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {chamber.creature.species} / Observation Chamber
          </p>
          <h1>{chamber.creature.name}</h1>
          <p>
            {dataMode === "ENVIO"
              ? "Onchain Omens and markets. Viewing source labeled separately."
              : chamber.creature.description}
          </p>
        </div>
        <div className="mode-stack">
          <span className="mode-badge">DATA: {dataMode}</span>
          <span className="mode-badge">
            {contractData ? "LIVE CONTRACT · TESTNET" : "LOCAL DEMO"}
          </span>
          <span className="status active">{chamber.status}</span>
        </div>
      </section>
      <div className="chamber-layout">
        {indexedError && (
          <p className="error" role="alert">
            {indexedError}
          </p>
        )}
        <div className="main-column">
          <ViewingReveal>
            <MediaStage
              source={media ?? creatureMedia[chamber.creature.species].media}
              name={chamber.creature.name}
              omen={dataMode === "ENVIO" ? chamber.latestOmen : null}
              behavior={
                dataMode === "ENVIO"
                  ? `Published behavior / ${publishedBehavior}`
                  : publishedBehavior
              }
            />
          </ViewingReveal>
          {fixtureMode ? (
            <section className="panel fixture-stage">
              <div className="panel-heading">
                <h2>Observation chamber</h2>
                <span className="mode-badge warning">
                  {chamber.sourceLabel}
                </span>
              </div>
              <div
                className="fixture-box"
                aria-label={
                  chamber.observation
                    ? `${chamber.creature.name} centroid in ${chamber.observation.zone} zone`
                    : `${chamber.creature.name} has no observation yet`
                }
              >
                <div className="zone-lines">
                  <span>SELL</span>
                  <span>HOLD</span>
                  <span>BUY</span>
                </div>
                <span className="stage-label">
                  CENTROID VISUALIZATION · DETERMINISTIC REPLAY
                </span>
                <span
                  className="creature-dot"
                  style={{
                    left: `${chamber.fixtureFrame.x * 100}%`,
                    top: `${chamber.fixtureFrame.y * 100}%`,
                  }}
                />
              </div>
              <button
                className="button secondary"
                disabled={!chamber.activeMarket}
                onClick={() => void advance()}
                type="button"
              >
                Advance deterministic fixture
              </button>
              {advanceError && <p className="error">{advanceError}</p>}
            </section>
          ) : null}
          <section className="signal-row">
            <article className="signal">
              <span>Source observation</span>
              <strong>{chamber.observation?.zone ?? "Unavailable"}</strong>
              <small>
                {chamber.observation
                  ? `${Math.round(chamber.observation.confidence * 100)}% confidence`
                  : "Full source evidence not available"}
              </small>
            </article>
            <article className="signal">
              <span>
                {dataMode === "ENVIO" ? "Published behavior" : "Behavior"}
              </span>
              <strong>{publishedBehavior}</strong>
              <small>
                {chamber.behavior
                  ? `rules ${chamber.behavior.rulesetVersion}`
                  : chamber.rulesetTemplate}
              </small>
            </article>
            <StateReveal identity={chamber.latestOmen?.sequence ?? "awaiting"}>
              <article
                aria-live="polite"
                className={`signal omen-card ${chamber.latestOmen?.value.toLowerCase() ?? ""}`}
              >
                <span>
                  {chamber.latestOmen
                    ? `Omen #${chamber.latestOmen.sequence}`
                    : "No Omen"}
                </span>
                <strong>{chamber.latestOmen?.value ?? "—"}</strong>
                <small>
                  {chamber.latestOmen
                    ? `${new Date(chamber.latestOmen.observedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`
                    : "Unpublished"}
                </small>
              </article>
            </StateReveal>
          </section>
          {chamber.proof ? (
            <ProofPanel proof={chamber.proof} />
          ) : (
            <OmenCommitment chamber={chamber} />
          )}
          {(chamber.proof || chamber.latestOmen) && (
            <p>
              <Link href={`/chambers/${chamber.slug}/proof`}>
                Open provenance record →
              </Link>
            </p>
          )}
        </div>
        <aside className="market-rail">
          <MarketPanel market={displayMarket} onChanged={refresh} />
          <SocialPanel chamberId={chamber.id} />
        </aside>
      </div>
      <section className="two-column">
        <div className="panel">
          <h2>Recent Omens</h2>
          {chamber.omenHistory.map((omen) => (
            <p className="history-row" key={omen.sequence}>
              <strong>
                #{omen.sequence} {omen.value}
              </strong>
              <time>
                {new Date(omen.observedAt).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
            </p>
          ))}
        </div>
        <div className="panel">
          <h2>Market history</h2>
          {chamber.marketHistory.length === 0 ? (
            <p className="empty">No completed markets.</p>
          ) : (
            chamber.marketHistory.map((market) => (
              <p className="history-row" key={market.id}>
                <strong>
                  Market #{market.id} · {market.state}
                </strong>
                <span>
                  {market.winningOutcome ?? market.cancellationReason}
                </span>
              </p>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
