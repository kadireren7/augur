import { afterEach, describe, it, expect, vi } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { createHash } from "node:crypto";
import {
  verifyPrivyAccessToken,
  requirePrivyIdentity,
  establishProductIdentity,
} from "./product-auth";
import { POST as chat } from "../app/api/chat/route";
import { POST as reaction } from "../app/api/reactions/route";
import { POST as prepare } from "../app/api/chambers/prepare/route";
import { GET as profile } from "../app/api/profile/route";
import { GET as favorites } from "../app/api/favorites/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("verified identity boundary", () => {
  it("verifies signatures, audience, issuer and expiry, not a browser wallet", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const sign = (aud: string, issuer = "privy.io", expiry = "1h") =>
      new SignJWT({})
        .setProtectedHeader({ alg: "ES256" })
        .setSubject("did:privy:verified-test-user")
        .setAudience(aud)
        .setIssuer(issuer)
        .setIssuedAt()
        .setExpirationTime(expiry)
        .sign(privateKey);
    expect(
      await verifyPrivyAccessToken(
        await sign("testapp"),
        "testapp",
        async () => publicKey,
      ),
    ).toBe("did:privy:verified-test-user");
    await expect(
      verifyPrivyAccessToken(
        await sign("other-app"),
        "testapp",
        async () => publicKey,
      ),
    ).rejects.toThrow("verified");
    await expect(
      verifyPrivyAccessToken(
        await sign("testapp", "imposter"),
        "testapp",
        async () => publicKey,
      ),
    ).rejects.toThrow("verified");
    await expect(
      verifyPrivyAccessToken(
        await sign("testapp", "privy.io", "-1h"),
        "testapp",
        async () => publicKey,
      ),
    ).rejects.toThrow("verified");
    await expect(
      requirePrivyIdentity(
        new Request("https://example.org", {
          headers: {
            "x-wallet-address": "0x1111111111111111111111111111111111111111",
          },
        }),
      ),
    ).rejects.toThrow("Log in");
  });
  it("rejects private API actions without login before reading their arbitrary identifiers", async () => {
    for (const handler of [chat, reaction, prepare, profile, favorites]) {
      const response = await handler(
        new Request("https://example.org/api/private", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: "someone-else",
            wallet_address: "0x1111111111111111111111111111111111111111",
          }),
        }),
      );
      expect(response.status).toBe(401);
    }
  });
  it("fails explicitly when production account configuration is missing", async () => {
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SECRET_KEY",
    ])
      vi.stubEnv(name, "");
    await expect(
      establishProductIdentity("did:privy:missing-config"),
    ).rejects.toThrow("configuration");
  });
  it("maps only verified subject to a Supabase Auth user and never accepts a preclaimed email", async () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "testapp");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-test-key");
    const subject = "did:privy:map-user-test",
      email = `${createHash("sha256").update(`testapp:${subject}`).digest("hex")}@identity.augur.invalid`;
    const mock = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith("admin/users"))
        return Response.json({ id: "test-user" });
      if (String(url).endsWith("generate_link"))
        return Response.json({
          id: "test-user",
          email,
          app_metadata: { privy_subject: subject },
          hashed_token: "test-hash",
          verification_type: "magiclink",
        });
      if (String(url).endsWith("/verify"))
        return Response.json({
          access_token: "test-session",
          expires_in: 3600,
          user: { id: "test-user" },
        });
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", mock);
    const [identity, concurrent] = await Promise.all([
      establishProductIdentity(subject),
      establishProductIdentity(subject),
    ]);
    expect(identity).toEqual({
      subject,
      userId: "test-user",
      accessToken: "test-session",
    });
    expect(concurrent).toEqual(identity);
    expect(
      mock.mock.calls.filter(([url]) => String(url).endsWith("generate_link")),
    ).toHaveLength(1);
    expect(
      mock.mock.calls.map(([, options]) => options?.body).join(" "),
    ).not.toContain("wallet_address");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        String(url).endsWith("admin/users")
          ? new Response(null, { status: 422 })
          : Response.json({
              id: "attacker",
              email,
              app_metadata: {},
              hashed_token: "hash",
              verification_type: "magiclink",
            }),
      ),
    );
    await expect(
      establishProductIdentity("did:privy:preclaimed-test"),
    ).rejects.toThrow("No guest identity");
  });
});
