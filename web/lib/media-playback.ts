/** Recovery probes are capped at thirty seconds, not an unbounded backoff. */
export function streamRetryDelay(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, Math.min(attempt - 1, 5)));
}
