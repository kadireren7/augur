import Link from "next/link";

import { getDataSource } from "@/lib/data-source";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const source = getDataSource();
  const chambers = await source.listChambers();
  return (
    <div className="page-shell">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Chamber discovery</p>
          <h1>Creature events, made inspectable.</h1>
          <p>
            {source.mode === "LOCAL"
              ? "All rooms below are deterministic fixture replays. None are labeled as live."
              : "Room lifecycle and market data are supplied by the configured indexed source."}
          </p>
        </div>
        <span className="mode-badge warning">Data: {source.mode}</span>
      </section>
      <section className="card-grid" aria-label="Available Chambers">
        {chambers.map((chamber) => (
          <article className="card" key={chamber.id}>
            <div className="card-title-row">
              <div>
                <p className="eyebrow">{chamber.creature.species}</p>
                <h2>{chamber.creature.name}</h2>
              </div>
              <span className={`status ${chamber.status.toLowerCase()}`}>{chamber.status}</span>
            </div>
            <dl className="facts">
              <div><dt>Source</dt><dd>{chamber.sourceMode}</dd></div>
              <div><dt>Asset</dt><dd>{chamber.asset}</dd></div>
              <div><dt>Latest Omen</dt><dd className={`omen ${chamber.latestOmen.value.toLowerCase()}`}>{chamber.latestOmen.value}</dd></div>
              <div><dt>Sequence</dt><dd>#{chamber.latestOmen.sequence}</dd></div>
              <div><dt>Market</dt><dd>{chamber.activeMarket?.state ?? "NONE"}</dd></div>
              <div><dt>Pool</dt><dd>{chamber.activeMarket?.totalPool ?? 0} AUGD</dd></div>
            </dl>
            <p className="muted">{chamber.sourceLabel}</p>
            <Link className="button" href={`/chambers/${chamber.slug}`}>Enter Chamber</Link>
          </article>
        ))}
      </section>
    </div>
  );
}
