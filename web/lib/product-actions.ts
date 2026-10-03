import { SocialStore } from "./social";
import { ProductAuthError, type ProductIdentity } from "./product-auth";
import {
  getProductRepository,
  SupabaseProductRepository,
} from "./product-repository";
import { getStore } from "./store";

export async function productRequest<T>(
  path: string,
  identity?: ProductIdentity,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new ProductAuthError(503, "Product database unavailable.");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      ...(identity
        ? { authorization: `Bearer ${identity.accessToken}` }
        : key.startsWith("sb_")
          ? {}
          : { authorization: `Bearer ${key}` }),
      "content-type": "application/json",
      Prefer:
        method === "POST"
          ? "return=representation,resolution=ignore-duplicates"
          : "return=representation",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const rateLimited =
      response.status === 429 || body?.message === "RATE_LIMITED";
    throw new ProductAuthError(
      rateLimited ? 429 : 503,
      rateLimited
        ? "Please wait before posting again."
        : "Product action unavailable. Nothing was confirmed.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export async function postAuthenticatedMessage(
  identity: ProductIdentity,
  input: { chamberId: string; displayName: string; text: string },
) {
  const validated = new SocialStore().postMessage({
    ...input,
    sessionId: identity.userId,
  });
  const rows = await productRequest<
    Array<{
      id: string;
      chamber_id: string;
      user_id: string;
      display_name: string;
      body: string;
      created_at: string;
    }>
  >("rpc/send_product_message", identity, {
    room: validated.chamberId,
    content: validated.text,
    label: validated.displayName,
  });
  const value = rows[0];
  if (!value) throw new ProductAuthError(503, "Message was not confirmed.");
  return {
    id: value.id,
    chamberId: value.chamber_id,
    sessionId: value.user_id,
    displayName: value.display_name,
    text: value.body,
    createdAt: value.created_at,
    moderated: validated.moderated,
  };
}
export async function publicMessages(chamberId: string) {
  const repository = getProductRepository();
  if (!(repository instanceof SupabaseProductRepository))
    return getStore().social.listMessages(chamberId);
  const rows = await productRequest<
    Array<{
      id: string;
      chamber_id: string;
      display_name: string;
      body: string;
      created_at: string;
    }>
  >(
    `messages?chamber_id=eq.${encodeURIComponent(chamberId)}&select=id,chamber_id,display_name,body,created_at&order=created_at.desc&limit=50`,
  );
  return rows.reverse().map((value) => ({
    id: value.id,
    chamberId: value.chamber_id,
    sessionId: "",
    displayName: value.display_name,
    text: value.body,
    createdAt: value.created_at,
    moderated: false,
  }));
}
