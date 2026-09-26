export class SlidingWindowRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    const cutoff = now - this.windowMs;
    const recent = (this.attempts.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= this.limit) {
      const retryAfterMs = Math.max(1, recent[0] + this.windowMs - now);
      this.attempts.set(key, recent);
      return { allowed: false, retryAfterMs };
    }
    recent.push(now);
    this.attempts.set(key, recent);
    return { allowed: true, retryAfterMs: 0 };
  }

  clear(): void {
    this.attempts.clear();
  }
}
