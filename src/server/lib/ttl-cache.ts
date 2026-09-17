/**
 * Memoises an async loader for `ttlMs`. Concurrent callers share one load and a
 * failed load is not cached. Used to keep AtlasHub reads under its rate limit.
 */
export function ttlCache<T>(ttlMs: number, load: () => Promise<T>, now: () => number = Date.now): () => Promise<T> {
  let entry: { at: number; value: T } | null = null;
  let inflight: Promise<T> | null = null;
  return () => {
    if (entry && now() - entry.at < ttlMs) return Promise.resolve(entry.value);
    if (inflight) return inflight;
    inflight = load()
      .then((value) => {
        entry = { at: now(), value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}
