import { notFound } from "next/navigation";

import { ChamberClient } from "@/components/chamber-client";
import { getDataSource } from "@/lib/data-source";
import { configuredLiveMedia } from "@/lib/live-media";
import { creatureMedia } from "@/lib/media";

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
  // Product metadata loads independently; never delay market/wallet rendering on it.
  let media = creatureMedia[chamber.creature.species].media;
  if (chamber.creature.species === "Hamster") {
    try {
      media = configuredLiveMedia(media);
    } catch {
      media = { ...media, status: "unavailable" };
    }
  }
  return (
    <>
      <ChamberClient initial={chamber} dataMode={source.mode} media={media} />
    </>
  );
}
