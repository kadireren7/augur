import Link from "next/link";

import { CreatureArt } from "@/components/creature-art";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function BattlesPage() {
  const battles = [...getStore().battles.values()];
  return <div className="page-shell"><section className="page-heading"><div><p className="eyebrow">The Pit</p><h1>Instinct against instinct.</h1><p>Equal virtual notional, one declared price fixture, deterministic scoring.</p></div><span className="mode-badge warning">Local result commitments</span></section><section className="card-grid">{battles.map((battle) => <article className="card" key={battle.id}><p className="eyebrow">{battle.asset} · {battle.state}</p><div className="battle-emblems"><CreatureArt species={battle.creatureA.species} /><span>vs</span><CreatureArt species={battle.creatureB.species} /></div><h2>{battle.creatureA.name} vs {battle.creatureB.name}</h2><p>{battle.result === "CREATURE_A" ? battle.creatureA.name : battle.result === "CREATURE_B" ? battle.creatureB.name : "Tie"}</p><dl className="facts"><div><dt>{battle.creatureA.name}</dt><dd>{battle.pnlAMicros ?? 0} µ</dd></div><div><dt>{battle.creatureB.name}</dt><dd>{battle.pnlBMicros ?? 0} µ</dd></div><div><dt>Price source</dt><dd>{battle.priceSourceId}</dd></div><div><dt>Commitment</dt><dd>{battle.onchainCommitment}</dd></div></dl><Link className="button" href={`/battles/${battle.id}`}>Inspect battle</Link></article>)}</section></div>;
}
