import Link from "next/link";
import { notFound } from "next/navigation";

import { ProofPanel } from "@/components/proof-panel";
import { getDataSource } from "@/lib/data-source";

export const dynamic = "force-dynamic";

export default async function ProofPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chamber = await getDataSource().getChamber(slug);
  if (!chamber) notFound();
  if (!chamber.proof) return <div className="page-shell narrow"><p><Link href={`/chambers/${slug}`}>← Back to Chamber</Link></p><section className="panel"><h1>Provenance manifest unavailable</h1><p>{chamber.latestOmen ? "This Chamber has an Omen commitment. The full offchain manifest is not available through the current data source." : "No Omen or full provenance manifest is available through the current data source."}</p></section></div>;
  return <div className="page-shell narrow"><p><Link href={`/chambers/${slug}`}>← Back to Chamber</Link></p><div className="page-heading"><div><p className="eyebrow">Provenance record</p><h1>{chamber.creature.name} · Omen #{chamber.proof.omenSequence}</h1></div></div><ProofPanel detailed proof={chamber.proof} /></div>;
}
