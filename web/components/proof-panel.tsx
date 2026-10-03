import type { ReactNode } from "react";

import type { ProofView } from "@/lib/types";

function HashValue({ value }: { value: string }) {
  return <code className="hash" title={value}>{value}</code>;
}

export function ProofPanel({ proof, detailed = false }: { proof: ProofView; detailed?: boolean }) {
  const fields: Array<[string, ReactNode]> = [
    ["Integrity", proof.integrityVerified ? "VERIFIED" : "FAILED"],
    ["Source trust", proof.sourceTrust.replaceAll("_", " ")],
    ["Publication", proof.publicationState.replaceAll("_", " ")],
    ["Creature ID", proof.creatureId],
    ["Chamber ID", proof.chamberId],
    ["Source segment", proof.sourceSegmentId],
    ["Capture range", `${proof.captureStart} → ${proof.captureEnd}`],
    ["Behavior", `${proof.behaviorType} (${Math.round(proof.behaviorConfidence * 100)}%)`],
    ["Ruleset", `${proof.omenRulesetVersion}`],
    ["Omen", `${proof.omenValue} · #${proof.omenSequence}`],
  ];
  if (detailed) {
    fields.push(
      ["Source hash", <HashValue key="source" value={proof.sourceHash} />],
      ["Detection hash", <HashValue key="detection" value={proof.detectionHash} />],
      ["Behavior ruleset hash", <HashValue key="behavior-rules" value={proof.behaviorRulesetHash} />],
      ["Omen ruleset hash", <HashValue key="omen-rules" value={proof.omenRulesetHash} />],
      ["Manifest hash", <HashValue key="manifest" value={proof.manifestHash} />],
    );
    if (proof.transactionHash) {
      fields.push(["Transaction", <HashValue key="transaction" value={proof.transactionHash} />]);
    }
  }
  return (
    <section className="panel proof-panel">
      <div className="panel-heading">
        <h2>Proof of Omen</h2>
        <span className={`status ${proof.integrityVerified ? "active" : "closed"}`}>
          {proof.integrityVerified ? "Integrity verified" : "Verification failed"}
        </span>
      </div>
      <dl className="proof-grid">
        {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className="notice">
        Hash verification proves artifact consistency. It does not prove that the camera or operator was honest.
      </p>
    </section>
  );
}
