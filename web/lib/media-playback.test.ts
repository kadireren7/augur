import { describe, expect, it } from "vitest";
import { streamRetryDelay } from "./media-playback";
import { creatureMedia, publicStreamSource } from "./media";

describe("public stream and recovery boundary", () => {
  it("uses an exponential backoff with a bounded recovery probe interval", () => {
    expect([1, 2, 3, 4, 5, 6, 100].map(streamRetryDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
  it("keeps replay when no live source is configured", () => {
    const base = creatureMedia.Fish.media;
    expect(publicStreamSource(base)).toBe(base);
  });
  it("uses the configured public HTTPS stream without claiming source attestation", () => {
    const source = publicStreamSource(creatureMedia.Fish.media, "https://media.example.org/public/live.m3u8");
    expect(source.sourceType).toBe("live_hls");
    expect(source.sourceUrl).toBe("https://media.example.org/public/live.m3u8");
    expect(source.status).toBe("available");
    expect(source.attribution).toContain("not independently attested");
  });
  it("shows invalid live configuration as unavailable, never a replay fallback", () => {
    for (const url of ["javascript:alert(1)", "https://media.example.org/live?token=private", "http://localhost/live.m3u8"]) {
      const source = publicStreamSource(creatureMedia.Hamster.media, url);
      expect(source.sourceType).toBe("live_hls");
      expect(source.status).toBe("unavailable");
      expect(source.sourceUrl).toBeNull();
    }
  });
});
