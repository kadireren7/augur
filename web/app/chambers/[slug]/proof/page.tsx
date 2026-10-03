import Link from "next/link";
import { notFound } from "next/navigation";

import { ProofPanel } from "@/components/proof-panel";
import { OmenCommitment } from "@/components/omen-commitment";
import { getDataSource } from "@/lib/data-source";

export const dynamic = "force-dynamic";

export default async function ProofPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chamber = await getDataSource().getChamber(slug);
  if (!chamber) notFound();
  if (!chamber.proof) return <div className="page-shell narrow"><p><Link href={`/chambers/${slug}`}>← Back to Chamber</Link></p><div className="page-heading"><div><p className="eyebrow">Provenance record</p><h1>{chamber.creature.name}{chamber.latestOmen ? ` · Omen #${chamber.latestOmen.sequence}` : " · Awaiting Omen"}</h1></div></div><OmenCommitment chamber={chamber} /></div>;
  return <div className="page-shell narrow"><p><Link href={`/chambers/${slug}`}>← Back to Chamber</Link></p><div className="page-heading"><div><p className="eyebrow">Provenance record</p><h1>{chamber.creature.name} · Omen #{chamber.proof.omenSequence}</h1></div></div><ProofPanel detailed proof={chamber.proof} /></div>;
}
