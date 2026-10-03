import { safeMediaUrl, type MediaSource } from "./media";

/** Public playback only; ingest credentials are never placed in a media descriptor. */
export function configuredLiveMedia(
  base: MediaSource,
  url = process.env.LIVE_STREAM_URL,
): MediaSource {
  if (!url) return base;
  if (!safeMediaUrl(url) || !url.startsWith("https://"))
    throw new Error(
      "LIVE_STREAM_URL must be a public HTTPS playback URL without credentials.",
    );
  return {
    ...base,
    id: `live-${base.id}`,
    sourceType: "live_hls",
    sourceUrl: url,
    evidence: "source_record",
    attribution:
      "Operator-configured stream · viewing is separate from oracle publication",
  };
}
