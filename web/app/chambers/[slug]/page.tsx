import { notFound } from "next/navigation";

import { ChamberClient } from "@/components/chamber-client";
import { getDataSource } from "@/lib/data-source";

export const dynamic = "force-dynamic";

export default async function ChamberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chamber = await getDataSource().getChamber(slug);
  if (!chamber) notFound();
  return <ChamberClient initial={chamber} />;
}
