import { randomUUID } from "node:crypto";

import { z } from "zod";

import { SlidingWindowRateLimiter } from "@/lib/rate-limit";
import type { ChatMessage, ReactionPulse, ReactionValue } from "@/lib/types";

export const chatInputSchema = z.object({
  chamberId: z.string().min(1).max(80),
  sessionId: z.string().min(8).max(100),
  displayName: z.string().trim().min(1).max(32),
  text: z.string().trim().min(1).max(280),
});

export const reactionInputSchema = z.object({
  chamberId: z.string().min(1).max(80),
  sessionId: z.string().min(8).max(100),
  reaction: z.enum(["BUY", "HOLD", "SELL", "HYPE", "RIP"]),
});

const blockedTerms = ["animal abuse", "hurt the animal", "kill the animal"];

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export class SocialStore {
  private readonly messages = new Map<string, ChatMessage[]>();
  private readonly reactions = new Map<string, Record<ReactionValue, number>>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 60_000);
  private readonly reactionLimiter = new SlidingWindowRateLimiter(12, 60_000);

  listMessages(chamberId: string): ChatMessage[] {
    return [...(this.messages.get(chamberId) ?? [])];
  }

  postMessage(input: unknown, now = Date.now()): ChatMessage {
    const value = chatInputSchema.parse(input);
    const rate = this.chatLimiter.check(`${value.chamberId}:${value.sessionId}`, now);
    if (!rate.allowed) {
      throw new SocialError("RATE_LIMITED", "Chat rate limit exceeded", rate.retryAfterMs);
    }
    const normalized = value.text.toLowerCase();
    if (blockedTerms.some((term) => normalized.includes(term))) {
      throw new SocialError("MODERATED", "Message rejected by moderation policy");
    }
    const message: ChatMessage = {
      id: randomUUID(),
      chamberId: value.chamberId,
      sessionId: value.sessionId,
      displayName: escapeHtml(value.displayName),
      text: escapeHtml(value.text),
      createdAt: new Date(now).toISOString(),
      moderated: false,
    };
    const current = this.messages.get(value.chamberId) ?? [];
    current.push(message);
    this.messages.set(value.chamberId, current.slice(-100));
    return message;
  }

  addReaction(input: unknown, now = Date.now()): ReactionPulse {
    const value = reactionInputSchema.parse(input);
    const rate = this.reactionLimiter.check(`${value.chamberId}:${value.sessionId}`, now);
    if (!rate.allowed) {
      throw new SocialError("RATE_LIMITED", "Reaction rate limit exceeded", rate.retryAfterMs);
    }
    const counts = this.reactions.get(value.chamberId) ?? {
      BUY: 0,
      HOLD: 0,
      SELL: 0,
      HYPE: 0,
      RIP: 0,
    };
    counts[value.reaction] += 1;
    this.reactions.set(value.chamberId, counts);
    return this.getPulse(value.chamberId);
  }

  getPulse(chamberId: string): ReactionPulse {
    const counts = this.reactions.get(chamberId) ?? {
      BUY: 0,
      HOLD: 0,
      SELL: 0,
      HYPE: 0,
      RIP: 0,
    };
    const totalDirectional = counts.BUY + counts.HOLD + counts.SELL;
    const percentage = (count: number) =>
      totalDirectional === 0 ? 0 : Math.round((count / totalDirectional) * 100);
    return {
      chamberId,
      counts: { ...counts },
      percentages: {
        BUY: percentage(counts.BUY),
        HOLD: percentage(counts.HOLD),
        SELL: percentage(counts.SELL),
      },
      totalDirectional,
    };
  }

  clear(): void {
    this.messages.clear();
    this.reactions.clear();
    this.chatLimiter.clear();
    this.reactionLimiter.clear();
  }
}

export class SocialError extends Error {
  constructor(
    readonly code: "RATE_LIMITED" | "MODERATED",
    message: string,
    readonly retryAfterMs = 0,
  ) {
    super(message);
  }
}
