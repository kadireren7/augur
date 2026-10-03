/** Short-lived verified-data cache. Failed requests are evicted, never replaced with fixtures. */
const snapshots = new Map<
  string,
  { expiresAt: number; promise: Promise<unknown>; pending: boolean }
>();
export function cachedSnapshot<T>(
  key: string,
  load: () => Promise<T>,
  now = Date.now(),
): Promise<T> {
  const hit = snapshots.get(key);
  if (hit && (hit.pending || hit.expiresAt > now))
    return hit.promise as Promise<T>;
  if (snapshots.size >= 16) snapshots.delete(snapshots.keys().next().value!);
  const promise = load()
    .then((value) => {
      const entry = snapshots.get(key);
      if (entry?.promise === promise) entry.pending = false;
      return value;
    })
    .catch((error) => {
      if (snapshots.get(key)?.promise === promise) snapshots.delete(key);
      throw error;
    });
  snapshots.set(key, { expiresAt: now + 2000, promise, pending: true });
  return promise;
}
