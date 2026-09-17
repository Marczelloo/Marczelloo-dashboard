export type SidebarMode = "expanded" | "collapsed";

export const SIDEBAR_KEY = "mz.sidebar";

export function readSidebarMode(storage: Pick<Storage, "getItem"> | null): SidebarMode {
  try {
    return storage?.getItem(SIDEBAR_KEY) === "collapsed" ? "collapsed" : "expanded";
  } catch {
    return "expanded";
  }
}

export function writeSidebarMode(storage: Pick<Storage, "setItem"> | null, mode: SidebarMode): void {
  try {
    storage?.setItem(SIDEBAR_KEY, mode);
  } catch {
    // Private windows and blocked storage: the preference just does not persist.
  }
}

/** `window.localStorage`, or null when the browser refuses access. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
