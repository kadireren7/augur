import Link from "next/link";

import { BattlePortraits } from "@/components/battle-portraits";
import { Reveal } from "@/components/motion-system";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function BattlesPage() {
  const battles = [...getStore().battles.values()];
  return (
    <div className="page-shell">
      <section className="page-heading">
        <div>
          <p className="eyebrow">The creature arena</p>
          <h1>Instinct against instinct.</h1>
          <p>
            Declared Omen and price replays. Equal virtual notional,
            deterministic scoring. These matchups are local demonstrations, not
            funded onchain battles.
          </p>
        </div>
        <span className="mode-badge">REPLAY BATTLES · LOCAL</span>
      </section>
      <section className="card-grid">
        {battles.map((battle, index) => (
          <Reveal key={battle.id} delay={index * 0.1}>
            <article className="card battle-card">
              <p className="eyebrow">
                {battle.asset} · {battle.state}
              </p>
              <BattlePortraits
                a={battle.creatureA.species}
                b={battle.creatureB.species}
              />
              <h2>
                {battle.creatureA.name} vs {battle.creatureB.name}
              </h2>
              <p>
                {battle.result === "CREATURE_A"
                  ? `${battle.creatureA.name} wins`
                  : battle.result === "CREATURE_B"
                    ? `${battle.creatureB.name} wins`
                    : "Tie"}
              </p>
              <dl className="facts">
                <div>
                  <dt>{battle.creatureA.name} virtual PnL</dt>
                  <dd>{battle.pnlAMicros ?? 0} µ</dd>
                </div>
                <div>
                  <dt>{battle.creatureB.name} virtual PnL</dt>
                  <dd>{battle.pnlBMicros ?? 0} µ</dd>
                </div>
                <div>
                  <dt>Price source</dt>
                  <dd>{battle.priceSourceId}</dd>
                </div>
                <div>
                  <dt>Commitment</dt>
                  <dd>{battle.onchainCommitment}</dd>
                </div>
              </dl>
              <Link className="button secondary" href={`/battles/${battle.id}`}>
                Inspect result ↗
              </Link>
            </article>
          </Reveal>
        ))}
      </section>
    </div>
  );
}
