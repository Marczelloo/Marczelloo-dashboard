/** Key the previous projects list already used, so existing pins survive the redesign. */
export const PINNED_KEY = "marczelloo_pinned_projects";

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "getItem" | "setItem">;

export function readPinned(storage: Reader | null): string[] {
  try {
    const raw = storage?.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Returns the new list; persisting is best effort (private windows block storage). */
export function togglePinned(storage: Writer | null, projectId: string): string[] {
  const current = readPinned(storage);
  const next = current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId];
  try {
    storage?.setItem(PINNED_KEY, JSON.stringify(next));
  } catch {
    // Keep the pin for this session even when it cannot be stored.
  }
  return next;
}
