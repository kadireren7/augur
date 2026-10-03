import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export class ProductAuthError extends Error {
  constructor(
    public readonly status = 401,
    message = "Log in to continue.",
  ) {
    super(message);
  }
}
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyPrivyAccessToken(
  token: string,
  appId: string,
  key?: JWTVerifyGetKey,
): Promise<string> {
  try {
    if (!appId || !/^[a-zA-Z0-9_-]+$/.test(appId) || token.length > 12000)
      throw new Error();
    let keys = key ?? keySets.get(appId);
    if (!keys) {
      const remote = createRemoteJWKSet(
        new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`),
        { timeoutDuration: 5000, cooldownDuration: 30000 },
      );
      keySets.set(appId, remote);
      keys = remote;
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer: "privy.io",
      audience: appId,
      algorithms: ["ES256"],
      requiredClaims: ["sub", "exp", "iat"],
      clockTolerance: 5,
    });
    if (!payload.sub?.startsWith("did:privy:") || payload.sub.length > 200)
      throw new Error();
    return payload.sub;
  } catch {
    throw new ProductAuthError(
      401,
      "Your session could not be verified. Log in again.",
    );
  }
}
export async function requirePrivyIdentity(request: Request): Promise<string> {
  const match = /^Bearer ([^\s]+)$/.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match) throw new ProductAuthError();
  return verifyPrivyAccessToken(
    match[1],
    process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "",
  );
}
export interface ProductIdentity {
  subject: string;
  userId: string;
  accessToken: string;
}
const sessions = new Map<
  string,
  { identity: ProductIdentity; expiresAt: number }
>();
const pendingSessions = new Map<string, Promise<ProductIdentity>>();
function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !service)
    throw new ProductAuthError(
      503,
      "Product account service unavailable. Supabase configuration is required.",
    );
  try {
    if (new URL(url).protocol !== "https:") throw new Error();
  } catch {
    throw new ProductAuthError(
      503,
      "Product account configuration unavailable.",
    );
  }
  return { url: url.replace(/\/$/, ""), anon, service };
}
/** Privy authenticates. Supabase Auth issues a server-held, per-user session for RLS.
 * No address, profile UUID or user-supplied email participates in this mapping. */
async function createProductIdentity(
  subject: string,
): Promise<ProductIdentity> {
  const { url, anon, service } = config();
  const digest = createHash("sha256")
    .update(`${process.env.NEXT_PUBLIC_PRIVY_APP_ID}:${subject}`)
    .digest("hex");
  const cacheKey = `${url}:${digest}`;
  const cached = sessions.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;
  async function auth(path: string, key: string, body: unknown) {
    const response = await fetch(`${url}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        apikey: key,
        ...(key.startsWith("sb_") ? {} : { authorization: `Bearer ${key}` }),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new ProductAuthError(
        503,
        "Product account service unavailable. No guest identity was substituted.",
      );
    return response.json();
  }
  try {
    // Internal, non-deliverable alias. Never use or verify a browser-supplied email.
    const email = `${digest}@identity.augur.invalid`;
    const created = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: service,
        ...(service.startsWith("sb_")
          ? {}
          : { authorization: `Bearer ${service}` }),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        email_confirm: true,
        app_metadata: { privy_subject: subject },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!created.ok && created.status !== 422) throw new Error();
    const link = await auth("admin/generate_link", service, {
      type: "magiclink",
      email,
    });
    const user = link.user ?? link;
    // Prevent an unrelated pre-created email account from being adopted.
    if (
      !user.id ||
      user.email !== email ||
      user.app_metadata?.privy_subject !== subject ||
      !link.hashed_token
    )
      throw new Error();
    const type = link.verification_type;
    if (type !== "magiclink" && type !== "signup") throw new Error();
    const session = await auth("verify", anon, {
      type,
      token_hash: link.hashed_token,
    });
    if (!session.access_token || session.user?.id !== user.id)
      throw new Error();
    const profile = await fetch(`${url}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: service,
        ...(service.startsWith("sb_")
          ? {}
          : { authorization: `Bearer ${service}` }),
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ id: user.id, privy_subject: subject }),
      signal: AbortSignal.timeout(5000),
    });
    if (!profile.ok) throw new Error();
    const identity = {
      subject,
      userId: user.id,
      accessToken: session.access_token,
    };
    if (sessions.size >= 256) sessions.delete(sessions.keys().next().value!);
    sessions.set(cacheKey, {
      identity,
      expiresAt:
        Date.now() +
        Math.min(Number(session.expires_in ?? 300), 300) * 1000 -
        10000,
    });
    return identity;
  } catch {
    throw new ProductAuthError(
      503,
      "Product account service unavailable. No guest identity was substituted.",
    );
  }
}
export async function requireProductIdentity(request: Request) {
  return establishProductIdentity(await requirePrivyIdentity(request));
}
export function establishProductIdentity(
  subject: string,
): Promise<ProductIdentity> {
  // Serialize one user's OTP exchange so simultaneous requests cannot invalidate it.
  let url: string;
  try {
    url = config().url;
  } catch (error) {
    return Promise.reject(error);
  }
  const key = `${url}:${process.env.NEXT_PUBLIC_PRIVY_APP_ID}:${subject}`;
  const pending = pendingSessions.get(key);
  if (pending) return pending;
  const promise = createProductIdentity(subject).finally(() =>
    pendingSessions.delete(key),
  );
  pendingSessions.set(key, promise);
  return promise;
}
