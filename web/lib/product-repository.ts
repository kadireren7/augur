import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mediaSourceSchema, type MediaSource } from "@/lib/media";
import { getPersistence } from "@/lib/database";
import {
  chatInputSchema,
  reactionInputSchema,
  SocialStore,
  SocialError,
} from "@/lib/social";
import type { ChatMessage, ReactionPulse } from "@/lib/types";

export const metadataSchema = z.object({
  id: z.string().min(1).max(100),
  creatureId: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(48),
  species: z.enum(["Hamster", "Fish", "Turtle"]),
  description: z.string().max(280),
  registrationStatus: z.enum(["pending_operator", "indexed", "local_demo"]),
});
export type ChamberMetadata = z.infer<typeof metadataSchema>;
export class ProductDatabaseError extends Error {
  constructor(
    message = "Product database unavailable. No local fallback was used.",
  ) {
    super(message);
  }
}

// Server module only. This file must never be imported by a client component.
export class SupabaseProductRepository {
  readonly mode = "SUPABASE";
  constructor(
    private readonly url: string,
    private readonly key: string,
  ) {
    if (new URL(url).protocol !== "https:" || !key)
      throw new ProductDatabaseError(
        "Invalid server-side Supabase configuration",
      );
  }
  private async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    try {
      const response = await fetch(
        `${this.url.replace(/\/$/, "")}/rest/v1/${path}`,
        {
          method,
          headers: {
            apikey: this.key,
            ...(this.key.startsWith("sb_secret_")
              ? {}
              : { authorization: `Bearer ${this.key}` }),
            "content-type": "application/json",
            Prefer: "return=representation,resolution=merge-duplicates",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        },
      );
      if (response.status === 429)
        throw new SocialError(
          "RATE_LIMITED",
          "Social rate limit exceeded",
          60_000,
        );
      if (
        !response.ok &&
        (
          await response
            .clone()
            .json()
            .catch(() => null)
        )?.message === "RATE_LIMITED"
      )
        throw new SocialError(
          "RATE_LIMITED",
          "Social rate limit exceeded",
          60_000,
        );
      if (!response.ok) throw new ProductDatabaseError();
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SocialError) throw error;
      throw new ProductDatabaseError();
    }
  }
  async health() {
    try {
      await this.request("chamber_metadata?select=id&limit=1");
      return { mode: this.mode, status: "HEALTHY", path: null };
    } catch {
      return { mode: this.mode, status: "UNAVAILABLE", path: null };
    }
  }
  async getMedia(chamberId: string): Promise<MediaSource | null> {
    const rows = await this.request<Array<{ payload: unknown }>>(
      `media_sources?chamber_id=eq.${encodeURIComponent(chamberId)}&status=in.(available,unavailable)&select=payload&limit=1`,
    );
    return rows.length ? mediaSourceSchema.parse(rows[0].payload) : null;
  }
  async getMetadata(chamberId: string): Promise<ChamberMetadata | null> {
    const rows = await this.request<Array<{ payload: unknown }>>(
      `chamber_metadata?id=eq.${encodeURIComponent(chamberId)}&select=payload&limit=1`,
    );
    return rows.length ? metadataSchema.parse(rows[0].payload) : null;
  }
  async savePrepared(
    metadata: ChamberMetadata,
    media: MediaSource,
  ): Promise<void> {
    await this.request("rpc/prepare_chamber_metadata", "POST", {
      metadata_input: metadataSchema.parse(metadata),
      media_input: mediaSourceSchema.parse(media),
    });
  }
  async listMessages(chamberId: string): Promise<ChatMessage[]> {
    const rows = await this.request<Array<{ payload: ChatMessage }>>(
      `chat_messages?chamber_id=eq.${encodeURIComponent(chamberId)}&select=payload&order=created_at.desc&limit=100`,
    );
    return rows.reverse().map((row) => row.payload);
  }
  async postMessage(input: unknown): Promise<ChatMessage> {
    const parsed = chatInputSchema.parse(input);
    // Reuse the existing moderation and escaping policy. Distributed limits are in the database RPC.
    const message = new SocialStore().postMessage(parsed);
    return this.request<ChatMessage>("rpc/post_chat_message", "POST", {
      message_input: message,
    });
  }
  async getPulse(chamberId: string): Promise<ReactionPulse> {
    return this.request("rpc/reaction_pulse", "POST", {
      target_chamber: chamberId,
    });
  }
  async addReaction(input: unknown): Promise<ReactionPulse> {
    const value = reactionInputSchema.parse(input);
    return this.request("rpc/post_reaction", "POST", {
      reaction_id: randomUUID(),
      target_chamber: value.chamberId,
      target_session: value.sessionId,
      reaction_value: value.reaction,
    });
  }
}

export class LocalProductRepository {
  readonly mode = "SQLITE";
  async getMedia(chamberId: string) {
    const payload = getPersistence().loadProductRecord("media", chamberId);
    const media = payload ? mediaSourceSchema.parse(payload) : null;
    return media && media.status !== "pending" ? media : null;
  }
  async getMetadata(chamberId: string) {
    const payload = getPersistence().loadProductRecord("metadata", chamberId);
    return payload ? metadataSchema.parse(payload) : null;
  }
  async savePrepared(metadata: ChamberMetadata, media: MediaSource) {
    getPersistence().saveProductRecords(
      metadata.id,
      metadataSchema.parse(metadata),
      mediaSourceSchema.parse(media),
    );
  }
  async health() {
    return { ...getPersistence().health(), status: "HEALTHY" };
  }
}

export function getProductRepository():
  SupabaseProductRepository | LocalProductRepository {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return new SupabaseProductRepository(url, key);
  if (url || key || process.env.VERCEL === "1")
    throw new ProductDatabaseError(
      "Production persistence requires SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)",
    );
  return new LocalProductRepository();
}

export async function checkProductHealth() {
  try {
    return await getProductRepository().health();
  } catch {
    return { mode: "UNCONFIGURED", status: "UNAVAILABLE", path: null };
  }
}
