"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MediaStage } from "@/components/media-stage";
import { PracticeExchange } from "@/components/practice-exchange";
import { creatureMedia, creaturePlayback } from "@/lib/media";
import { wallRooms } from "@/lib/creature-wall";
import { formatAugd } from "@/lib/token-amount";
import type { ChamberView } from "@/lib/types";

export function Discovery({ chambers: initialChambers, dataMode, initialUnavailable = false, initialLoading = false }: {
  chambers: ChamberView[];
  dataMode: "LOCAL" | "ENVIO";
  initialUnavailable?: boolean;
  initialLoading?: boolean;
}) {
  const [chambers, setChambers] = useState(initialChambers);
  const [updateError, setUpdateError] = useState(initialUnavailable);
  const [dataPending, setDataPending] = useState(initialLoading);
  const [selected, setSelected] = useState(0);
  const wall = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (dataMode !== "ENVIO" && !initialLoading) return;
    const refresh = () => {
      if (document.hidden) return;
      void fetch("/api/chambers", {
        signal: AbortSignal.timeout(5000), cache: "no-store",
      }).then(async (response) => {
        if (!response.ok) throw new Error();
        setChambers((await response.json()).chambers);
        setUpdateError(false);
        setDataPending(false);
      }).catch(() => { setUpdateError(true); setDataPending(false); });
    };
    if (initialLoading) refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [dataMode, initialLoading]);
  const rooms = wallRooms(chambers, dataMode);
  const active = rooms.filter((room) => room.market?.state === "OPEN" || room.market?.state === "LOCKED");
  const recent = dataMode === "ENVIO" ? chambers.flatMap((chamber) =>
    chamber.omenHistory.map((omen) => ({
      ...omen, name: rooms.find((room) => room.chamber?.id === chamber.id)?.name ?? "Chamber",
      slug: chamber.slug,
    })),
  ).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0, 6) : [];
  return (
    <div className="discovery">
      <h1 className="sr-only">Augur creature prediction markets</h1>
      <section id="discover" aria-label="Creature Chambers" className="creature-wall-section">
        <div className="wall-tabs" role="group" aria-label="Choose a creature">
          {rooms.map((room, index) => (
            <button key={room.species} type="button" aria-pressed={selected === index}
              onClick={() => {
                setSelected(index);
                wall.current?.children[index]?.scrollIntoView({ block: "nearest", inline: "start", behavior: "smooth" });
              }}>{room.name}</button>
          ))}
        </div>
        <div className="creature-wall" ref={wall}
          onScroll={(event) => {
            const first = event.currentTarget.firstElementChild;
            if (first) setSelected(Math.min(2, Math.round(event.currentTarget.scrollLeft / (first.clientWidth + 8))));
          }}>
          {rooms.map((room) => (
            <article className={`wall-panel ${creatureMedia[room.species].accent}`} key={room.species} data-creature={room.slug}>
              <MediaStage source={creaturePlayback(room.species)} name={room.name} wall />
              <Link href={room.href} className="wall-chamber-link" aria-label={`Enter ${room.name}’s Chamber`}>
                <div className="wall-identity">
                  <span className="wall-species">{room.label}</span>
                  <h2>{room.name}</h2>
                  {room.omen && (
                    <div className={`wall-omen ${room.omen.value.toLowerCase()}`}>
                      <span>Latest Omen</span><strong>{room.omen.value}</strong>
                    </div>
                  )}
                  {room.market ? (
                    <div className="wall-market">
                      <span>{room.market.state} · Testnet</span>
                      <strong>{formatAugd(room.market.totalPool)} <small>AUGD pool</small></strong>
                    </div>
                  ) : <p className="wall-behavior">{room.behavior}</p>}
                  <span className="wall-enter">Enter Chamber <span aria-hidden="true">↗</span></span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
      <div className="page-shell">
        <PracticeExchange />
        <p className="watch-flow" aria-label="Prediction flow">
          <span>Watch</span><i aria-hidden="true">→</i><span>Predict</span><i aria-hidden="true">→</i>
          <span>Omen happens</span><i aria-hidden="true">→</i><span>Market resolves</span><i aria-hidden="true">→</i><span>Claim</span>
        </p>
        <p className="wall-source-note">Viewing footage is separate from indexed Omen evidence.</p>
        {updateError && <p className="notice" role="status">{chambers.length ? "Updates unavailable. Showing the last indexed record." : "Indexed market data is unavailable. Practice remains separate; no fixture market data was substituted."}</p>}
        <section className="discovery-section active-markets">
          <div className="section-heading"><h2>Onchain markets</h2><Link href="/chronicle">Monad Testnet history →</Link></div>
          {active.length ? active.map((room) => (
            <Link key={room.slug} href={room.href} className="active-market-row">
              <div><strong>{room.name}</strong><span>{room.label}</span></div>
              <span className={room.omen?.value.toLowerCase()}>{room.omen ? `Latest Omen · ${room.omen.value}` : "Awaiting Omen"}</span>
              <span>{room.market!.state}</span><strong>{formatAugd(room.market!.totalPool)} AUGD</strong><span>Predict ↗</span>
            </Link>
          )) : <p className="muted" role="status">{dataPending ? "Loading indexed markets…" : updateError ? "Indexed markets unavailable. No fixture data substituted." : "No active indexed markets available."}</p>}
        </section>
        <section className="exchange-recent">
          <div className="section-heading"><h2>Recent Omens</h2><Link href="/chronicle">Full history →</Link></div>
          {recent.length ? <div className="omen-ticker">
            {recent.map((omen) => <Link href={`/chambers/${omen.slug}`} className="ticker-event" key={`${omen.slug}-${omen.sequence}`}>
              <span>{omen.name}</span><strong className={omen.value.toLowerCase()}>{omen.value}</strong><span>#{omen.sequence}</span>
            </Link>)}
          </div> : <p className="muted">{dataPending ? "Loading published Omens…" : "No published Omens available."}</p>}
        </section>
        <section className="exchange-links">
          <Link href="/battles"><span>Battles</span><h2>Creature matchups →</h2></Link>
          <Link href="/chronicle"><span>Chronicle</span><h2>Omens and settlement history →</h2></Link>
        </section>
      </div>
    </div>
  );
}
