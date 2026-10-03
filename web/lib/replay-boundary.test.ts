import { afterEach, describe, expect, it, vi } from "vitest";
const run = vi.hoisted(() =>
  vi.fn(() => ({ mode: "LOCAL_DEMO", operationsSucceeded: 3 })),
);
vi.mock("@/lib/store", () => ({ getStore: () => ({ runShowcaseCycle: run }) }));
import { POST as replayPost } from "@/app/api/replays/showcase/route";
import { POST as legacyPost } from "@/app/api/showcase/route";
afterEach(() => {
  vi.unstubAllEnvs();
  run.mockClear();
});
describe("explicit replay boundary", () => {
  it("runs all three local creatures without disabling the original indexed guard", async () => {
    vi.stubEnv("ENVIO_GRAPHQL_URL", "https://example.org/graphql");
    const request = () =>
      new Request("https://example.org/api/replays/showcase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ durationMs: 5000, predictionsPerChamber: 9 }),
      });
    expect((await legacyPost(request())).status).toBe(409);
    expect(run).not.toHaveBeenCalled();
    const result = await replayPost(request());
    expect(result.status).toBe(200);
    expect((await result.json()).mode).toBe("LOCAL_DEMO");
    expect(run).toHaveBeenCalledExactlyOnceWith(
      ["pablo", "bubbles", "turbo"],
      5000,
      9,
    );
  });
});
