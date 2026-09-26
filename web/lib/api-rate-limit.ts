import { SlidingWindowRateLimiter } from "@/lib/rate-limit";

const mutationLimiter = new SlidingWindowRateLimiter(30, 60_000);

export function requireMutationCapacity(request: Request, scope: string): void {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwarded || request.headers.get("x-real-ip") || "local";
  const result = mutationLimiter.check(`${scope}:${client}`);
  if (!result.allowed) {
    throw new PublicRateLimitError(result.retryAfterMs);
  }
}

export class PublicRateLimitError extends Error {
  readonly code = "RATE_LIMITED";

  constructor(readonly retryAfterMs: number) {
    super("Public mutation rate limit exceeded");
  }
}
