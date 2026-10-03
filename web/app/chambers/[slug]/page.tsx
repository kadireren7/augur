import { notFound } from "next/navigation";

import { ChamberClient } from "@/components/chamber-client";
import { getDataSource } from "@/lib/data-source";
import { getProductRepository } from "@/lib/product-repository";

export const dynamic = "force-dynamic";

export default async function ChamberPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const source = getDataSource();
  const chamber = await source.getChamber(slug);
  if (!chamber) notFound();
  // Optional offchain viewing metadata never substitutes protocol data.
  let media;
  let mediaError = false;
  let view = chamber;
  try {
    const repository = getProductRepository();
    const [sourceMedia,metadata] = await Promise.all([repository.getMedia(chamber.id),repository.getMetadata(chamber.id)]);
    media = sourceMedia ?? undefined;
    if(metadata && metadata.creatureId===chamber.creature.id && metadata.registrationStatus!=="pending_operator") view={...chamber,creature:{...chamber.creature,name:metadata.name,description:metadata.description}};
  } catch {
    mediaError = true;
  }
  return (
    <>
      {mediaError && (
        <p className="notice" role="status">
          Offchain media configuration unavailable. Showing the labeled
          illustrative replay; indexed records are unchanged.
        </p>
      )}
      <ChamberClient initial={view} dataMode={source.mode} media={media} />
    </>
  );
}
