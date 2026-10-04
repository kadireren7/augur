import { describe, expect, it } from "vitest";
import { creatureComposition, mediaComposition } from "./media-presentation";

describe("creature viewing composition", () => {
  it("keeps individual compositions separate from protocol data", () => {
    expect(Object.keys(creatureComposition)).toEqual(["Pablo", "Bubbles", "Turbo"]);
    for (const value of Object.values(creatureComposition)) {
      expect(value.position).toMatch(/^\d+% \d+%$/);
      expect(value.heroPosition).toMatch(/^\d+% \d+%$/);
      expect(value.wallPosition).toMatch(/^\d+% \d+%$/);
      expect(value.fit).toBe("cover");
    }
  });
  it("preserves the whole image for an unconfigured creature", () => {
    expect(mediaComposition("Other").fit).toBe("contain");
  });
});
