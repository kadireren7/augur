import Link from "next/link";
import { notFound } from "next/navigation";

import { CreatureArt } from "@/components/creature-art";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = getStore().battles.get(id);
  if (!battle) notFound();
  return <div className="page-shell narrow"><p><Link href="/battles">← The Pit</Link></p><section className="page-heading"><div><p className="eyebrow">{battle.state} · {battle.asset}</p><h1>{battle.creatureA.name} vs {battle.creatureB.name}</h1></div><span className="mode-badge warning">{battle.onchainCommitment}</span></section><section className="panel"><div className="battle-emblems"><CreatureArt species={battle.creatureA.species} /><span>vs</span><CreatureArt species={battle.creatureB.species} /></div><h2>Deterministic result</h2><dl className="proof-grid"><div><dt>Winner</dt><dd>{battle.result}</dd></div><div><dt>{battle.creatureA.name} virtual PnL</dt><dd>{battle.pnlAMicros} µ</dd></div><div><dt>{battle.creatureB.name} virtual PnL</dt><dd>{battle.pnlBMicros} µ</dd></div><div><dt>Starting notional</dt><dd>{battle.startingNotionalMicros} µ each</dd></div><div><dt>Price source</dt><dd>{battle.priceSourceId}</dd></div><div><dt>Window</dt><dd>{battle.startsAt} → {battle.endsAt}</dd></div><div><dt>Scoring config</dt><dd><code className="hash">{battle.scoringConfigHash}</code></dd></div><div><dt>Price series</dt><dd><code className="hash">{battle.priceSeriesHash}</code></dd></div></dl><p className="notice">Animals do not custody or trade funds. Scores are virtual PnL from declared Omen and price replay inputs.</p></section></div>;
}
