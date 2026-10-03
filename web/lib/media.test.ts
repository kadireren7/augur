import { describe, expect, it } from "vitest";
import {
  creatureMedia,
  mediaLabel,
  mediaSourceSchema,
  safeMediaUrl,
} from "./media";

describe("honest creature media", () => {
  it("ships three recorded, illustrative sources, never a fabricated live stream", () => {
    for (const value of Object.values(creatureMedia)) {
      expect(mediaSourceSchema.parse(value.media).evidence).toBe(
        "illustrative",
      );
      expect(mediaLabel(value.media)).toBe("REPLAY");
    }
  });
  it("rejects executable, private credential and traversal URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://localhost:8000/private",
      "https://user:password@example.org/camera",
      "/media/../private",
      "file:///tmp/video",
      "https://localhost/private.webm",
      "https://example.org/video?access_token=private",
    ])
      expect(safeMediaUrl(url)).toBe(false);
    expect(safeMediaUrl("https://example.org/public.m3u8")).toBe(true);
  });
  it("never persists a browser camera URL", () => {
    expect(() =>
      mediaSourceSchema.parse({
        ...creatureMedia.Hamster.media,
        sourceType: "browser_camera",
      }),
    ).toThrow();
    expect(
      mediaLabel({
        ...creatureMedia.Hamster.media,
        sourceType: "fixture",
        sourceUrl: null,
      }),
    ).toBe("SIMULATION");
  });
});
