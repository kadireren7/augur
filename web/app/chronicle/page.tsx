import Link from "next/link";
import { Reveal } from "@/components/motion-system";
import { formatAugd } from "@/lib/token-amount";
import { getDataSource } from "@/lib/data-source";
import { creatureIdentity } from "@/lib/creature-identity";
export const dynamic = "force-dynamic";
export default async function ChroniclePage() {
  const source = getDataSource();
  const [chronicle, chambers] = await Promise.all([
    source.getChronicle(),
    source.listChambers(),
  ]);
  return (
    <div className="page-shell">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Chronicle / The historical ledger</p>
          <h1>Market history</h1>
          <p>{chronicle.disclaimer}</p>
        </div>
        <span className="mode-badge">DATA: {source.mode}</span>
      </section>
      <Reveal>
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Creature</th>
                <th>W / L / T</th>
                <th>Virtual PnL</th>
                <th>BUY</th>
                <th>HOLD</th>
                <th>SELL</th>
                <th>Backed</th>
              </tr>
            </thead>
            <tbody>
              {chronicle.standings.map((standing) => (
                <tr key={standing.creature.id}>
                  <td>
                    <strong>{standing.creature.name}</strong>
                    <br />
                    <small>{creatureIdentity[standing.creature.species].label}</small>
                  </td>
                  <td>
                    {standing.battleWins} / {standing.battleLosses} /{" "}
                    {standing.battleTies}
                  </td>
                  <td>{standing.virtualPnlMicros} µ</td>
                  <td className="omen buy">{standing.omenCounts.BUY}</td>
                  <td className="omen hold">{standing.omenCounts.HOLD}</td>
                  <td className="omen sell">{standing.omenCounts.SELL}</td>
                  <td>{formatAugd(standing.totalBacked)} AUGD</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </Reveal>
      <section className="two-column">
        <Reveal className="panel">
          <h2>Omen timeline</h2>
          {chambers.flatMap((chamber) =>
            chamber.omenHistory.map((omen) => (
              <article
                className="ledger-event"
                key={`${chamber.id}-${omen.sequence}`}
              >
                <span className={`omen ${omen.value.toLowerCase()}`}>
                  {omen.value}
                </span>
                <div>
                  <strong>
                    {chamber.creature.name} · #{omen.sequence}
                  </strong>
                  <time>{new Date(omen.observedAt).toLocaleString()}</time>
                  <Link href={`/chambers/${chamber.slug}/proof`}>
                    Inspect commitment ↗
                  </Link>
                </div>
              </article>
            )),
          )}
        </Reveal>
        <Reveal className="panel" delay={0.1}>
          <h2>Resolved markets</h2>
          {chronicle.recentMarkets.length === 0 ? (
            <p className="empty">No completed markets indexed.</p>
          ) : (
            chronicle.recentMarkets.map((market) => (
              <article className="ledger-event" key={market.id}>
                <span
                  className={`omen ${market.winningOutcome?.toLowerCase() ?? ""}`}
                >
                  {market.winningOutcome ?? "REFUND"}
                </span>
                <div>
                  <strong>
                    Market #{market.id} · {market.state}
                  </strong>
                  <p>{formatAugd(market.totalPool)} AUGD pool</p>
                  <small>
                    {market.state === "RESOLVED"
                      ? "Winning positions claim pro-rata. Claim history is not exposed by this view."
                      : `Participants can refund · ${market.cancellationReason ?? "Cancelled"}`}
                  </small>
                </div>
              </article>
            ))
          )}
        </Reveal>
      </section>
      <section className="two-column">
        <article className="panel">
          <h2>Activity</h2>
          <p>
            Most active Chamber:{" "}
            <strong>{chambers.find(chamber=>chamber.id===chronicle.mostActiveChamber)?.creature.name ?? "No activity"}</strong>
          </p>
          <p>
            Most backed creature:{" "}
            <strong>
              {chronicle.mostBackedCreature ?? "No predictions yet"}
            </strong>
          </p>
        </article>
        <article className="panel">
          <h2>Battle history</h2>
          {chronicle.battles.length ? (
            chronicle.battles.map((battle) => (
              <p className="history-row" key={battle.id}>
                <strong>
                  {battle.creatureA.name} vs {battle.creatureB.name}
                </strong>
                <span>{battle.result ?? battle.state}</span>
              </p>
            ))
          ) : (
            <p className="empty">
              No battles indexed. Replay demonstrations are available in the
              arena.
            </p>
          )}
        </article>
      </section>
    </div>
  );
}
