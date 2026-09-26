import { describe, expect, it } from "vitest";

import { SocialError, SocialStore } from "@/lib/social";

const base = { chamberId: "chamber-pablo", sessionId: "session-12345" };

describe("SocialStore", () => {
  it("aggregates directional reactions into a crowd pulse", () => {
    const store = new SocialStore();
    store.addReaction({ ...base, reaction: "BUY" }, 1);
    store.addReaction({ ...base, reaction: "BUY" }, 2);
    const pulse = store.addReaction({ ...base, reaction: "SELL" }, 3);
    expect(pulse.percentages).toEqual({ BUY: 67, HOLD: 0, SELL: 33 });
    expect(pulse.totalDirectional).toBe(3);
  });

  it("rejects malformed reactions", () => {
    const store = new SocialStore();
    expect(() => store.addReaction({ ...base, reaction: "MOON" }, 1)).toThrow();
  });

  it("rate limits reactions", () => {
    const store = new SocialStore();
    for (let index = 0; index < 12; index += 1) {
      store.addReaction({ ...base, reaction: "HYPE" }, index);
    }
    expect(() => store.addReaction({ ...base, reaction: "HYPE" }, 13)).toThrow(SocialError);
  });

  it("escapes chat markup and enforces chat rate limits", () => {
    const store = new SocialStore();
    const message = store.postMessage(
      { ...base, displayName: "<b>Alice</b>", text: "<script>alert(1)</script>" },
      1,
    );
    expect(message.text).toContain("&lt;script&gt;");
    expect(message.text).not.toContain("<script>");
    for (let index = 0; index < 4; index += 1) {
      store.postMessage({ ...base, displayName: "Alice", text: `message ${index}` }, index + 2);
    }
    expect(() =>
      store.postMessage({ ...base, displayName: "Alice", text: "too many" }, 10),
    ).toThrow(SocialError);
  });
});
