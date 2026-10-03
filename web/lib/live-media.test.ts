import { it, expect } from "vitest";
import { configuredLiveMedia } from "./live-media";
import { creatureMedia } from "./media";
it("uses a configured public HLS URL without turning bundled footage into live footage", () => {
  expect(configuredLiveMedia(creatureMedia.Hamster.media, "").sourceType).toBe(
    "recorded_video",
  );
  expect(
    configuredLiveMedia(
      creatureMedia.Hamster.media,
      "https://stream.example.org/live.m3u8",
    ).sourceType,
  ).toBe("live_hls");
  expect(() =>
    configuredLiveMedia(
      creatureMedia.Hamster.media,
      "https://stream.example.org/live.m3u8?token=secret",
    ),
  ).toThrow();
  expect(creatureMedia.Turtle.media.sourceUrl).toContain("tortoise");
});
