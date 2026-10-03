"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MediaStage } from "@/components/media-stage";
import { creatureMedia } from "@/lib/media";
import { creatureIdentity } from "@/lib/creature-identity";
import { formatAugd, poolPercentage } from "@/lib/token-amount";
import type { ChamberView, Species } from "@/lib/types";

export function Discovery({
  chambers: initialChambers,
  dataMode,
}: {
  chambers: ChamberView[];
  dataMode: "LOCAL" | "ENVIO";
}) {
  const [chambers, setChambers] = useState(initialChambers);
  const [updateError, setUpdateError] = useState(false);
  useEffect(() => {
    if (dataMode !== "ENVIO") return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void fetch("/api/chambers", {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          setChambers((await response.json()).chambers);
          setUpdateError(false);
        })
        .catch(() => setUpdateError(true));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [dataMode]);
  const [category, setCategory] = useState<Species | "All">("All");
  const featured =
    chambers.find((c) => c.creature.species === "Hamster") ?? chambers[0];
  const market = featured?.activeMarket ?? featured?.marketHistory[0];
  const settled = featured?.marketHistory.find(
    (round) => round.state === "RESOLVED",
  );
  const href = featured ? `/chambers/${featured.slug}` : "/replays/pablo";
  const recent = chambers
    .flatMap((c) =>
      c.omenHistory.map((o) => ({ ...o, name: c.creature.name, slug: c.slug })),
    )
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
    .slice(0, 6);
  return (
    <div className="discovery">
      <section className="exchange-hero">
        <MediaStage
          source={creatureMedia.Hamster.media}
          name="Pablo"
          compact
          ambient
        />
        <div className="hero-vignette" />
        <div className="exchange-hero-copy">
          <p className="eyebrow">Creature prediction exchange</p>
          <h1>
            The next move.
            <br />
            Your position.
          </h1>
          <p>Stake on the next BUY, HOLD or SELL Omen.</p>
          <Link className="button" href={href}>
            Enter Pablo’s Chamber ↗
          </Link>
        </div>
        <div className="hero-market">
          <div className="panel-heading">
            <h2>
              Pablo <small>Hamster</small>
            </h2>
            <span className="mode-badge">
              {dataMode === "ENVIO" ? "INDEXED · TESTNET" : "SIMULATION"}
            </span>
          </div>
          <div className="hero-market-summary">
            <span>
              Latest Omen
              <strong className="buy">
                {featured?.latestOmen?.value ?? "Awaiting"}
              </strong>
            </span>
            <span>
              Total pool
              <strong>{formatAugd(market?.totalPool ?? 0)} AUGD</strong>
            </span>
          </div>
          <div className="outcome-grid">
            {(["BUY", "HOLD", "SELL"] as const).map((outcome) => (
              <Link
                className={`outcome-button ${outcome.toLowerCase()}`}
                href={href}
                key={outcome}
              >
                <strong>{outcome}</strong>
                <span>{formatAugd(market?.pools[outcome] ?? 0)} AUGD</span>
                <small>
                  {market
                    ? poolPercentage(market.pools[outcome], market.totalPool)
                    : 0}
                  % of pool
                </small>
              </Link>
            ))}
          </div>
          <div className="hero-market-footer">
            <span>
              Market {market?.id ?? "—"} · {market?.state ?? "Unavailable"}
            </span>
            <Link href={href}>View market →</Link>
          </div>
        </div>
      </section>
      <div className="page-shell">
        {updateError && (
          <p className="notice">
            Updates unavailable. Showing the last indexed record.
          </p>
        )}
        <section id="discover" className="discovery-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Chambers</p>
              <h2>Choose your next signal.</h2>
            </div>
            <div
              className="category-tabs"
              role="group"
              aria-label="Creature categories"
            >
              {(["All", "Hamster", "Fish", "Turtle"] as const).map((value) => (
                <button
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                  key={value}
                >
                  {value === "Turtle" ? "Tortoise" : value}
                </button>
              ))}
            </div>
          </div>
          <div className="creature-grid">
            {(Object.keys(creatureMedia) as Species[])
              .filter((s) => category === "All" || s === category)
              .map((species) => {
                const entry = creatureMedia[species],
                  identity = creatureIdentity[species],
                  room = chambers.find((c) => c.creature.species === species);
                const indexed = dataMode === "ENVIO" && !!room;
                const target = room
                  ? `/chambers/${room.slug}`
                  : `/replays/${entry.slug}`;
                const current = room?.activeMarket ?? room?.marketHistory[0];
                return (
                  <motion.article
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.995 }}
                    className={`creature-discovery ${entry.accent}`}
                    key={species}
                  >
                    <Link href={target} className="creature-image-link">
                      <MediaStage
                        source={entry.media}
                        name={identity.name}
                        compact
                      />
                    </Link>
                    <div className="creature-info">
                      <div className="panel-heading">
                        <h3>{identity.name}</h3>
                        <span className="eyebrow">{identity.label}</span>
                      </div>
                      <p>{identity.behavior}</p>
                      {indexed ? (
                        <div className="card-market">
                          <span className="mode-badge">Indexed</span>
                          <span>
                            {room?.latestOmen?.value ?? "Awaiting"} ·{" "}
                            {current?.state ?? "No market"}
                          </span>
                          <strong>
                            {formatAugd(current?.totalPool ?? 0)} AUGD
                          </strong>
                        </div>
                      ) : (
                        <p className="muted">
                          Viewing room · funded market not registered
                        </p>
                      )}
                      <Link className="card-link" href={target}>
                        Open Chamber <span>↗</span>
                      </Link>
                    </div>
                  </motion.article>
                );
              })}
          </div>
        </section>
        <section className="exchange-recent">
          {settled && (
            <div className="settled-strip">
              <span>Last settled · Market #{settled.id}</span>
              <strong className={settled.winningOutcome?.toLowerCase()}>
                {settled.winningOutcome}
              </strong>
              <span>{formatAugd(settled.totalPool)} AUGD pool</span>
              <Link href="/chronicle">Settlement history →</Link>
            </div>
          )}
          <div className="section-heading">
            <h2>Recent Omens</h2>
            <Link href="/chronicle">Full history →</Link>
          </div>
          {recent.length ? (
            <div className="omen-ticker">
              {recent.map((o) => (
                <Link
                  href={`/chambers/${o.slug}`}
                  className="ticker-event"
                  key={`${o.slug}-${o.sequence}`}
                >
                  <span>{o.name}</span>
                  <strong className={o.value.toLowerCase()}>{o.value}</strong>
                  <span>#{o.sequence}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">No published Omens available.</p>
          )}
        </section>
        <section className="exchange-links">
          <Link href="/battles">
            <span>The Pit</span>
            <h2>Creature matchups →</h2>
            <p>Compare declared replay outcomes and virtual performance.</p>
          </Link>
          <Link href="/chronicle">
            <span>Chronicle</span>
            <h2>Follow the record →</h2>
            <p>Published Omens, market outcomes and backing history.</p>
          </Link>
        </section>
      </div>
    </div>
  );
}
