import Link from "next/link";
import { notFound } from "next/navigation";
import { BattlePortraits } from "@/components/battle-portraits";
import { Reveal } from "@/components/motion-system";
import { getStore } from "@/lib/store";
export const dynamic = "force-dynamic";
export default async function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const battle = getStore().battles.get(id);
  if (!battle) notFound();
  return (
    <div className="page-shell narrow">
      <p>
        <Link href="/battles">← Battles</Link>
      </p>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{battle.state} / Declared replay</p>
          <h1>
            {battle.creatureA.name}
            <br />
            <em>vs {battle.creatureB.name}</em>
          </h1>
        </div>
        <span className="mode-badge">
          {battle.onchainCommitment} · VIRTUAL PNL
        </span>
      </section>
      <Reveal>
        <BattlePortraits
          a={battle.creatureA.species}
          b={battle.creatureB.species}
        />
      </Reveal>
      <section className="panel">
        <h2>Deterministic result</h2>
        <dl className="proof-grid">
          <div>
            <dt>Winner</dt>
            <dd>
              {battle.result === "CREATURE_A"
                ? battle.creatureA.name
                : battle.result === "CREATURE_B"
                  ? battle.creatureB.name
                  : "Tie"}
            </dd>
          </div>
          <div>
            <dt>{battle.creatureA.name} virtual PnL</dt>
            <dd>{battle.pnlAMicros} µ</dd>
          </div>
          <div>
            <dt>{battle.creatureB.name} virtual PnL</dt>
            <dd>{battle.pnlBMicros} µ</dd>
          </div>
          <div>
            <dt>Starting notional</dt>
            <dd>{battle.startingNotionalMicros} µ each</dd>
          </div>
          <div>
            <dt>Price source</dt>
            <dd>{battle.priceSourceId}</dd>
          </div>
          <div>
            <dt>Window</dt>
            <dd>
              {battle.startsAt} → {battle.endsAt}
            </dd>
          </div>
          <div>
            <dt>Scoring config</dt>
            <dd className="hash">{battle.scoringConfigHash}</dd>
          </div>
          <div>
            <dt>Price series</dt>
            <dd className="hash">{battle.priceSeriesHash}</dd>
          </div>
        </dl>
        <p className="notice">
          Animals do not custody or trade funds. These local scores use declared
          Omen and price replay inputs. Portraits are illustrative replay
          stills, not proof of the scoring inputs.
        </p>
      </section>
    </div>
  );
}
