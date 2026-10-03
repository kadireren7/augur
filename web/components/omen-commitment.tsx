import type { ChamberView } from "@/lib/types";

export function OmenCommitment({ chamber }: { chamber: ChamberView }) {
  const omen = chamber.latestOmen;
  return <section className="panel proof-panel"><div className="panel-heading"><h2>Proof of Omen</h2><span className="mode-badge warning">Full manifest unavailable</span></div>
    <p className="muted">{omen ? "Indexed publication fields are available. Full offchain source and detection evidence is unavailable." : "No Omen commitment or offchain manifest is available yet."}</p>
    {omen && <dl className="proof-grid">
      <div><dt>Omen / sequence</dt><dd>{omen.value} · #{omen.sequence}</dd></div>
      <div><dt>Observed</dt><dd>{omen.observedAt}</dd></div>
      <div><dt>Chamber</dt><dd><code className="hash">{chamber.id}</code></dd></div>
      <div><dt>Creature</dt><dd><code className="hash">{chamber.creature.id}</code></dd></div>
      <div><dt>Ruleset commitment</dt><dd><code className="hash">{chamber.rulesetHash}</code></dd></div>
      <div><dt>Provenance commitment</dt><dd><code className="hash">{omen.provenanceHash}</code></dd></div>
    </dl>}
    {omen && <p className="notice">A commitment alone does not verify the unavailable source manifest or source honesty.</p>}
  </section>;
}
