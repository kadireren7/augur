"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { MediaStage } from "@/components/media-stage";
import { Reveal, ScrollStage } from "@/components/motion-system";
import { PayoutGuide } from "@/components/payout-guide";
import { creatureMedia } from "@/lib/media";
import { formatAugd } from "@/lib/token-amount";
import type { ChamberView, Species } from "@/lib/types";

export function Discovery({
  chambers,
  dataMode,
}: {
  chambers: ChamberView[];
  dataMode: "LOCAL" | "ENVIO";
}) {
  const [category, setCategory] = useState<Species | "All">("All");
  const featured =
    chambers.find((chamber) => chamber.creature.species === "Hamster") ??
    chambers[0];
  const featuredMedia = creatureMedia[featured?.creature.species ?? "Hamster"];
  return (
    <div className="discovery">
      <section className="broadcast-hero">
        <ScrollStage>
          <MediaStage
            source={featuredMedia.media}
            name={featured?.creature.name ?? "Hamster replay"}
            compact
            ambient
          />
        </ScrollStage>
        <div className="hero-vignette" />
        <Reveal className="hero-editorial">
          <p className="eyebrow">Augur / Creature prediction exchange</p>
          <h1>
            Watch instinct.
            <br />
            <em>Take a position.</em>
          </h1>
          <p>
            Creature behavior becomes an Omen.
            <br />
            The next signal settles the market.
          </p>
          <div className="hero-actions">
            <Link
              className="button"
              href={featured ? `/chambers/${featured.slug}` : "/replays/pablo"}
            >
              Watch the Chamber ↗
            </Link>
            <Link className="text-link" href="#discover">
              Explore creatures ↓
            </Link>
          </div>
        </Reveal>
        <div className="broadcast-caption">
          <span>
            <i className="signal-light" /> MONAD TESTNET ·{" "}
            {dataMode === "ENVIO" ? "INDEXED CONTRACT DATA" : "LOCAL DEMO DATA"}
          </span>
          <span>Illustrative replay · not Omen evidence</span>
        </div>
      </section>
      <div className="page-shell">
        <Reveal className="featured-strip">
          <div>
            <p className="eyebrow">
              Featured / {featured?.creature.species ?? "Hamster"}
            </p>
            <h2>{featured?.creature.name ?? "Recorded observation"}</h2>
          </div>
          <div>
            <span>Latest Omen</span>
            <strong
              className={`omen ${featured?.latestOmen?.value.toLowerCase() ?? ""}`}
            >
              {featured?.latestOmen?.value ?? "Awaiting"}
            </strong>
          </div>
          <div>
            <span>Market</span>
            <strong>
              {(featured?.activeMarket ?? featured?.marketHistory[0])?.state ??
                "None"}
            </strong>
          </div>
          <div>
            <span>Pool</span>
            <strong>
              {formatAugd(
                (featured?.activeMarket ?? featured?.marketHistory[0])
                  ?.totalPool ?? 0,
              )}{" "}
              AUGD
            </strong>
          </div>
          <Link
            href={featured ? `/chambers/${featured.slug}` : "/replays/pablo"}
          >
            Open view ↗
          </Link>
        </Reveal>
        <section id="discover" className="discovery-section">
          <Reveal className="section-heading">
            <div>
              <p className="eyebrow">
                Different creatures. Observable signals.
              </p>
              <h2>Choose your Chamber.</h2>
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
                  {value}
                </button>
              ))}
            </div>
          </Reveal>
          <div className="creature-grid">
            {(Object.keys(creatureMedia) as Species[])
              .filter((species) => category === "All" || species === category)
              .map((species, index) => {
                const entry = creatureMedia[species];
                const real = chambers.find(
                  (chamber) => chamber.creature.species === species,
                );
                const liveContract = dataMode === "ENVIO" && !!real;
                return (
                  <motion.article
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.08 }}
                    className={`creature-discovery ${entry.accent}`}
                    key={species}
                  >
                    <Link
                      href={
                        real
                          ? `/chambers/${real.slug}`
                          : `/replays/${entry.slug}`
                      }
                      className="creature-image-link"
                    >
                      <MediaStage
                        source={entry.media}
                        name={entry.name}
                        compact
                      />
                      <span className="discovery-mode">
                        {liveContract
                          ? "LIVE CONTRACT · TESTNET"
                          : "REPLAY / LOCAL DEMO"}
                      </span>
                    </Link>
                    <div className="creature-info">
                      <p className="eyebrow">
                        {species} / {entry.behavior}
                      </p>
                      <h3>{real?.creature.name ?? entry.name}</h3>
                      <p>
                        {liveContract
                          ? "Real indexed Omen and market. Video is illustrative replay."
                          : "Recorded footage and deterministic rule templates. No onchain market."}
                      </p>
                      <Link
                        className="card-link"
                        href={
                          real
                            ? `/chambers/${real.slug}`
                            : `/replays/${entry.slug}`
                        }
                      >
                        {liveContract
                          ? "Enter contract Chamber"
                          : "Watch replay"}{" "}
                        <span>↗</span>
                      </Link>
                    </div>
                  </motion.article>
                );
              })}
          </div>
        </section>
        <section className="story-section">
          <div className="sticky-story">
            <p className="eyebrow">Behavior, not belief.</p>
            <h2>
              The creature moves.
              <br />
              The rules decide.
              <br />
              <em>The chain remembers.</em>
            </h2>
            <p>
              Augur does not ask a model to invent a prediction. Versioned rules
              turn observable behavior into BUY, HOLD, or SELL.
            </p>
            <Link
              className="text-link"
              href={
                featured ? `/chambers/${featured.slug}/proof` : "/chronicle"
              }
            >
              Follow the provenance ↗
            </Link>
          </div>
          <div className="story-steps">
            <Reveal>
              <span className="story-symbol">◉</span>
              <h3>Observe</h3>
              <p>
                A declared source supplies observations. Replays, browser
                cameras, and live streams retain their own trust labels.
              </p>
            </Reveal>
            <Reveal>
              <span className="story-symbol">↝</span>
              <h3>Interpret</h3>
              <p>
                Behavior and Omen rules bind the signal to a provenance
                commitment. CRE validates publication requests in the verified
                simulation path.
              </p>
            </Reveal>
            <Reveal>
              <span className="story-symbol">↗</span>
              <h3>Settle</h3>
              <p>
                Authorized publication resolves the eligible market on Monad.
                Envio carries the contract event into this interface.
              </p>
            </Reveal>
          </div>
        </section>
        <Reveal>
          <PayoutGuide expanded />
        </Reveal>
        <section className="closing-grid">
          <Reveal>
            <Link href="/battles">
              <p className="eyebrow">Creature arena / declared replays</p>
              <h2>
                Two instincts.
                <br />
                One price path.
              </h2>
              <p>
                Compare deterministic virtual performance. No animal trades or
                holds funds.
              </p>
              <span>View Battles ↗</span>
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <Link href="/chronicle">
              <p className="eyebrow">The ledger</p>
              <h2>
                Signals pass.
                <br />
                Records remain.
              </h2>
              <p>
                Explore indexed Omen counts, market outcomes, and backed stakes.
              </p>
              <span>Open Chronicle ↗</span>
            </Link>
          </Reveal>
        </section>
        <Reveal className="integration-strip">
          <div>
            Monad<small>Testnet settlement</small>
          </div>
          <div>
            Envio<small>Real event indexing</small>
          </div>
          <div>
            Alchemy<small>Server RPC</small>
          </div>
          <div>
            Privy<small>Wallet signing</small>
          </div>
          <div>
            Chainlink CRE<small>Authenticated simulation</small>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
