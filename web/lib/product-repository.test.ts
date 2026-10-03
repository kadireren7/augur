import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getProductRepository,
  ProductDatabaseError,
  SupabaseProductRepository,
} from "./product-repository";
import { creatureMedia } from "./media";
import { SocialError } from "./social";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("production product persistence", () => {
  it("fails closed rather than using SQLite on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => getProductRepository()).toThrow(ProductDatabaseError);
  });
  it("uses server-only REST headers and typed media", async () => {
    const mock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify([{ payload: creatureMedia.Hamster.media }]),
        ),
    );
    vi.stubGlobal("fetch", mock);
    const repository = new SupabaseProductRepository(
      "https://example.supabase.co",
      "sb_secret_test_not_a_real_key",
    );
    expect(await repository.getMedia("real-chamber")).toEqual(
      creatureMedia.Hamster.media,
    );
    expect(String(mock.mock.calls[0][0])).toContain(
      "chamber_id=eq.real-chamber",
    );
    expect(mock.mock.calls[0][1]?.headers).not.toHaveProperty("authorization");
  });
  it("does not expose upstream errors or fall back on database failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("sensitive upstream detail", { status: 500 }),
      ),
    );
    await expect(
      new SupabaseProductRepository(
        "https://example.supabase.co",
        "server-test",
      ).listMessages("c"),
    ).rejects.toThrow("No local fallback");
  });
  it("preserves moderation before making any remote write", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    await expect(
      new SupabaseProductRepository(
        "https://example.supabase.co",
        "server-test",
      ).postMessage({
        chamberId: "c",
        sessionId: "local-test-12345",
        displayName: "Guest",
        text: "hurt the animal",
      }),
    ).rejects.toBeInstanceOf(SocialError);
    expect(mock).not.toHaveBeenCalled();
  });
  it("surfaces database-enforced distributed rate limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "RATE_LIMITED" }), {
            status: 400,
          }),
      ),
    );
    await expect(
      new SupabaseProductRepository(
        "https://example.supabase.co",
        "server-test",
      ).addReaction({
        chamberId: "c",
        sessionId: "local-test-12345",
        reaction: "BUY",
      }),
    ).rejects.toBeInstanceOf(SocialError);
  });
});
