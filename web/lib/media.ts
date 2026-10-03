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
      sourceUrl: "/media/hamster.webm",
      poster: "/media/hamster.jpg",
      status: "available",
      evidence: "illustrative",
      attribution: "Greg Heartsfield · CC BY 2.0",
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
      sourceUrl: "/media/fish.webm",
      poster: "/media/fish.jpg",
      status: "available",
      evidence: "illustrative",
      attribution: "Horcrux92 · CC BY-SA 4.0",
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
      sourceUrl: "/media/tortoise.webm",
      poster: "/media/tortoise.jpg",
      status: "available",
      evidence: "illustrative",
      attribution: "Kasyap · CC0 1.0 · land tortoises",
    },
  },
};

export function mediaLabel(source: MediaSource): string {
  if (source.sourceType === "fixture") return "SIMULATION";
  if (source.sourceType === "recorded_video") return "REPLAY";
  return "LIVE SOURCE";
}
