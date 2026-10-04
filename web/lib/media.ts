import { z } from "zod";
import type { Species } from "@/lib/types";

export const mediaSourceSchema = z
  .object({
    id: z.string().min(1).max(100),
    chamberId: z.string().min(1).max(100),
    creatureId: z.string().min(1).max(100),
    sourceType: z.enum([
      "live_hls",
      "browser_camera",
      "recorded_video",
      "fixture",
    ]),
    sourceUrl: z.string().max(2048).refine(safeMediaUrl).nullable(),
    poster: z.string().max(2048).refine(safeMediaUrl).nullable(),
    status: z.enum(["available", "pending", "unavailable"]),
    evidence: z.enum(["illustrative", "source_record"]),
    attribution: z.string().max(500),
  })
  .superRefine((value, context) => {
    if (
      ["live_hls", "recorded_video"].includes(value.sourceType) &&
      !value.sourceUrl
    )
      context.addIssue({
        code: "custom",
        message: "Video source URL is required",
        path: ["sourceUrl"],
      });
    if (
      ["browser_camera", "fixture"].includes(value.sourceType) &&
      value.sourceUrl !== null
    )
      context.addIssue({
        code: "custom",
        message: "This source must not persist a camera URL",
        path: ["sourceUrl"],
      });
  });
export type MediaSource = z.infer<typeof mediaSourceSchema>;

export function safeMediaUrl(value: string): boolean {
  if (
    value.startsWith("/media/") &&
    !value.includes("..") &&
    !value.includes("\\")
  )
    return true;
  try {
    const url = new URL(value);
    const privateHost =
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(
        url.hostname,
      ) || /\.(local|internal)$/.test(url.hostname);
    const credentialQuery = [...url.searchParams.keys()].some((key) =>
      /(token|api.?key|secret|signature|authorization|x-amz)/i.test(key),
    );
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !privateHost &&
      !credentialQuery
    );
  } catch {
    return false;
  }
}

export const creatureMedia: Record<
  Species,
  {
    slug: string;
    name: string;
    accent: string;
    behavior: string;
    media: MediaSource;
  }
> = {
  Hamster: {
    slug: "pablo",
    name: "Pablo",
    accent: "coral",
    behavior: "Movement, dwell, direction",
    media: {
      id: "hamster-replay",
      chamberId: "replay-pablo",
      creatureId: "pablo",
      sourceType: "recorded_video",
      sourceUrl: "/media/hamster.mp4",
      poster: "/media/hamster.jpg",
      status: "available",
      evidence: "illustrative",
      attribution: "Pixabay via Pexels · Pexels license",
    },
  },
  Fish: {
    slug: "bubbles",
    name: "Bubbles",
    accent: "cyan",
    behavior: "Zone crossing, direction",
    media: {
      id: "fish-replay",
      chamberId: "replay-bubbles",
      creatureId: "bubbles",
      sourceType: "recorded_video",
      sourceUrl: "/media/goldfish.mp4",
      poster: "/media/goldfish.jpg",
      status: "available",
      evidence: "illustrative",
      attribution: "Ammad Rasool via Pexels · Pexels license",
    },
  },
  Turtle: {
    slug: "turbo",
    name: "Turbo",
    accent: "sage",
    behavior: "Zone occupancy, dwell",
    media: {
      id: "turtle-replay",
      chamberId: "replay-turbo",
      creatureId: "turbo",
      sourceType: "recorded_video",
      sourceUrl: "/media/land-tortoise.mp4",
      poster: "/media/land-tortoise.jpg",
      status: "available",
      evidence: "illustrative",
      attribution: "Mikhail Nilov via Pexels · Pexels license",
    },
  },
};

export function mediaLabel(source: MediaSource): string {
  if (source.sourceType === "fixture") return "SIMULATION";
  if (source.sourceType === "recorded_video") return "REPLAY";
  return "LIVE SOURCE";
}

/** Public playback configuration only. Never substitutes a replay for a bad live URL. */
export function publicStreamSource(base: MediaSource, playbackUrl?: string): MediaSource {
  if (!playbackUrl?.trim()) return base;
  const valid = safeMediaUrl(playbackUrl) && playbackUrl.startsWith("https://");
  return {
    ...base, id: `${base.id}-live`, sourceType: "live_hls",
    sourceUrl: valid ? playbackUrl : null,
    status: valid ? "available" : "unavailable",
    evidence: "source_record", attribution: "Configured public stream · not independently attested",
  };
}

export function creaturePlayback(species: Species, configured?: MediaSource): MediaSource {
  const base = creatureMedia[species].media;
  if (configured && configured.id !== base.id) return configured;
  const urls = {
    Hamster: process.env.NEXT_PUBLIC_PABLO_LIVE_HLS_URL,
    Fish: process.env.NEXT_PUBLIC_BUBBLES_LIVE_HLS_URL,
    Turtle: process.env.NEXT_PUBLIC_TURBO_LIVE_HLS_URL,
  };
  return publicStreamSource(configured ?? base, urls[species]);
}
