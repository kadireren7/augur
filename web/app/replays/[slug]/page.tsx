import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaStage } from "@/components/media-stage";
import { Reveal } from "@/components/motion-system";
import { creatureMedia } from "@/lib/media";

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = Object.entries(creatureMedia).find(
    ([, value]) => value.slug === slug,
  );
  if (!entry) notFound();
  const [species, creature] = entry;
  return (
    <div className={`page-shell replay-page ${creature.accent}`}>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{species} / Recorded viewing room</p>
          <h1>{creature.name}</h1>
          <p>
            {creature.behavior}. This clip is illustrative, not an attested
            observation source.
          </p>
        </div>
        <span className="mode-badge">REPLAY · NO ONCHAIN MARKET</span>
      </section>
      <Reveal>
        <MediaStage
          source={creature.media}
          name={creature.name}
          behavior={creature.behavior}
        />
      </Reveal>
      <section className="replay-explanation">
        <h2>
          Watch the creature.
          <br />
          Understand the rules.
        </h2>
        <div>
          <p>
            The existing zone template maps LEFT → SELL, CENTER → HOLD, RIGHT →
            BUY after confidence and dwell validation. Video playback alone does
            not generate an Omen.
          </p>
          <p>
            No contract market has been created for this replay. Explore the
            explicit local showcase for deterministic market cycles, or return
            to the indexed contract Chamber.
          </p>
          <div className="button-row">
            <Link className="button" href="/showcase">
              Open local showcase ↗
            </Link>
            <Link className="button secondary" href="/">
              Find indexed Chambers
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
