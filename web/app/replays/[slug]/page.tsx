import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaStage } from "@/components/media-stage";
import { SocialPanel } from "@/components/social-panel";
import { ChamberFavorite } from "@/components/chamber-favorite";
import { creatureMedia } from "@/lib/media";
import { creatureIdentity } from "@/lib/creature-identity";
import { getStore } from "@/lib/store";
import { configuredLiveMedia } from "@/lib/live-media";
import { getProductRepository } from "@/lib/product-repository";
export const dynamic = "force-dynamic";
export default async function ReplayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pair = Object.entries(creatureMedia).find(([, v]) => v.slug === slug);
  if (!pair) notFound();
  const [species, entry] = pair;
  const identity = creatureIdentity[species as keyof typeof creatureIdentity];
  const reference = getStore().getChamber(slug);
  let media = entry.media,
    unavailable = false;
  try {
    media =
      (await getProductRepository().getMedia(entry.media.chamberId)) ??
      (slug === "pablo" ? configuredLiveMedia(entry.media) : entry.media);
  } catch {
    unavailable = true;
  }
  return (
    <div className={`page-shell chamber-shell ${entry.accent}`}>
      <section className="page-heading chamber-heading">
        <div>
          <p className="eyebrow">{identity.label}</p>
          <h1>{identity.name}</h1>
        </div>
        <div className="chamber-heading-links"><Link href="/">All Chambers →</Link><ChamberFavorite chamberId={entry.media.chamberId}/></div>
      </section>
      {unavailable && (
        <p className="notice">
          Viewing configuration unavailable. Bundled reference footage is shown.
        </p>
      )}
      <div className="chamber-layout">
        <div className="main-column">
          <MediaStage
            source={media}
            name={identity.name}
            behavior={identity.behavior}
          />
          <div className="feed-signal">
            <span>
              Behavior template<strong>{identity.behavior}</strong>
            </span>
            <span>
              Market<strong>Not registered</strong>
            </span>
          </div>
        </div>
        <aside className="market-rail">
          <section className="panel">
            <h2>Next Omen market</h2>
            <p className="muted">
              No funded contract market is registered for this viewing room.
            </p>
            <div className="outcome-grid">
              {["BUY", "HOLD", "SELL"].map((v) => (
                <button
                  className={`outcome-button ${v.toLowerCase()}`}
                  disabled
                  key={v}
                >
                  <strong>{v}</strong>
                  <span>No pool</span>
                </button>
              ))}
            </div>
            <p>
              Positions open after authorized registration and an onchain market
              opening.
            </p>
            <Link className="button" href="/chambers/indexed-9d6541b7a855bf7c">
              View Pablo’s market →
            </Link>
            <details className="technical-details">
              <summary>Behavior rules</summary>
              <p>{identity.rules}</p>
              <p>
                Video viewing is independent of oracle observations and
                publication.
              </p>
            </details>
          </section>
        </aside>
      </div>
      <div className="chamber-below">
        <section className="panel">
          <h2>Signal history</h2>
          <p className="muted">No onchain publications yet.</p>
          <details className="technical-details">
            <summary>Deterministic rule replay history</summary>
            <p>
              Reference observations from the existing rules fixture, not
              signals detected in this video.
            </p>
            {reference.omenHistory.map((o) => (
              <p className="history-row" key={o.sequence}>
                <strong>{o.value}</strong>
                <span>#{o.sequence}</span>
                <time>{new Date(o.observedAt).toISOString()}</time>
              </p>
            ))}
          </details>
        </section>
        <SocialPanel chamberId={entry.media.chamberId} />
      </div>
    </div>
  );
}
