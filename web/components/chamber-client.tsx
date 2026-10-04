"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MarketPanel } from "@/components/market-panel";
import { ProofPanel } from "@/components/proof-panel";
import { OmenCommitment } from "@/components/omen-commitment";
import { SocialPanel } from "@/components/social-panel";
import { ChamberFavorite } from "@/components/chamber-favorite";
import { MediaStage } from "@/components/media-stage";
import { StateReveal } from "@/components/motion-system";
import { creatureMedia, creaturePlayback, type MediaSource } from "@/lib/media";
import { creatureIdentity } from "@/lib/creature-identity";
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
  const [indexedError, setIndexedError] = useState("");
  const [viewingMedia, setViewingMedia] = useState(
    media ?? creatureMedia[initial.creature.species].media,
  );
  const [mediaError, setMediaError] = useState("");
  useEffect(() => {
    let disposed = false;
    void fetch(`/api/chambers/${initial.slug}/media`, {
      signal: AbortSignal.timeout(6000),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const body = await r.json();
        if (!disposed && body.media) setViewingMedia(body.media);
      })
      .catch(() => {
        if (!disposed)
          setMediaError(
            "Viewing configuration unavailable; reference footage remains separate from indexed data.",
          );
      });
    return () => {
      disposed = true;
    };
  }, [initial.slug]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/chambers/${chamber.slug}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error();
      setChamber((await response.json()).chamber);
      setIndexedError("");
    } catch {
      setIndexedError(
        "Market update unavailable. Showing the last indexed record.",
      );
    }
  }, [chamber.slug]);
  useEffect(() => {
    if (dataMode !== "ENVIO") return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [dataMode, refresh]);
  const market = chamber.activeMarket ?? chamber.marketHistory[0] ?? null;
  const identity = creatureIdentity[chamber.creature.species];
  const name = dataMode === "ENVIO" ? identity.name : chamber.creature.name;
  const behavior = behaviorLabel(
    chamber.behavior?.type ?? chamber.latestOmen?.behaviorType,
  );
  return (
    <div
      className={`page-shell chamber-shell ${creatureMedia[chamber.creature.species].accent}`}
    >
      <section className="page-heading chamber-heading">
        <div>
          <p className="eyebrow">{identity.label}</p>
          <h1>{name}</h1>
        </div>
        <div className="chamber-heading-links">
          <span className="mode-badge">
            {dataMode === "ENVIO" ? "INDEXED · TESTNET" : "SIMULATION"}
          </span>
          <Link href={`/chambers/${chamber.slug}/proof`}>Proof ↗</Link>
          <ChamberFavorite chamberId={chamber.id}/>
        </div>
      </section>
      {indexedError && (
        <p className="error" role="alert">
          {indexedError}
        </p>
      )}
      <div className="chamber-layout">
        <div className="main-column">
          <MediaStage
            source={creaturePlayback(chamber.creature.species, viewingMedia)}
            name={name}
            omen={chamber.latestOmen}
            behavior={behavior}
          />
          {mediaError && (
            <p className="notice" role="status">
              {mediaError}
            </p>
          )}
          <div className="feed-signal">
            <span>
              Published behavior<strong>{behavior}</strong>
            </span>
            <span>
              Latest Omen
              <StateReveal
                identity={chamber.latestOmen?.sequence ?? "awaiting"}
              >
                <strong className={chamber.latestOmen?.value.toLowerCase()}>
                  {chamber.latestOmen?.value ?? "Awaiting"}
                </strong>
              </StateReveal>
            </span>
            <span>
              Sequence
              <strong>
                {chamber.latestOmen ? `#${chamber.latestOmen.sequence}` : "—"}
              </strong>
            </span>
          </div>
        </div>
        <aside className="market-rail">
          <MarketPanel market={market} onChanged={refresh} />
        </aside>
      </div>
      <div className="chamber-below">
        <section className="panel">
          <div className="panel-heading">
            <h2>Omen activity</h2>
            <Link href="/chronicle">Chronicle →</Link>
          </div>
          {chamber.omenHistory.length ? (
            chamber.omenHistory.map((omen) => (
              <StateReveal identity={omen.sequence} key={omen.sequence}>
                <div className="history-row">
                  <strong className={omen.value.toLowerCase()}>
                    {omen.value}
                  </strong>
                  <span>#{omen.sequence}</span>
                  <time>
                    {new Date(omen.observedAt).toLocaleString("en-GB", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>
              </StateReveal>
            ))
          ) : (
            <p className="empty">No published Omens.</p>
          )}
          <details className="technical-details">
            <summary>Rules and publication details</summary>
            <p>{identity.rules}</p>
            <p>
              Data source: {dataMode}. Source evidence and full offchain
              manifests may be unavailable; a commitment alone is not source
              attestation.
            </p>
            {chamber.proof ? (
              <ProofPanel proof={chamber.proof} />
            ) : (
              <OmenCommitment chamber={chamber} />
            )}
          </details>
          <details className="technical-details">
            <summary>Previous markets</summary>
            {chamber.marketHistory.map((previous) => (
              <p className="history-row" key={previous.id}>
                <strong>Market #{previous.id}</strong>
                <span>
                  {previous.state} {previous.winningOutcome ?? ""}
                </span>
              </p>
            ))}
          </details>
        </section>
        <SocialPanel chamberId={chamber.id} />
      </div>
    </div>
  );
}
