import { it, expect, vi } from "vitest";
import { cachedSnapshot } from "./snapshot-cache";
it("deduplicates concurrent reads and expires without silently serving failed refreshes", async () => {
  const load = vi.fn(async () => ({ id: 1 }));
  await Promise.all([
    cachedSnapshot("dedup-test", load, 0),
    cachedSnapshot("dedup-test", load, 1),
  ]);
  expect(load).toHaveBeenCalledTimes(1);
  await cachedSnapshot("dedup-test", load, 2001);
  expect(load).toHaveBeenCalledTimes(2);
  const bad = vi.fn(async () => {
    throw new Error("unavailable");
  });
  await expect(cachedSnapshot("failed-test", bad, 0)).rejects.toThrow(
    "unavailable",
  );
  await expect(cachedSnapshot("failed-test", bad, 1)).rejects.toThrow(
    "unavailable",
  );
  expect(bad).toHaveBeenCalledTimes(2);
});
