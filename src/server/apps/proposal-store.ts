import "server-only";

import type { ImportProposal } from "./import/proposal";
import type { InventorySnapshot } from "./types";

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, { proposal: ImportProposal; snapshot: InventorySnapshot; expiresAt: number }>();

function sweep(now = Date.now()) {
  for (const [id, entry] of store) if (entry.expiresAt <= now) store.delete(id);
}

export function storeProposal(proposal: ImportProposal, snapshot: InventorySnapshot): void {
  sweep();
  store.set(proposal.id, { proposal, snapshot, expiresAt: Date.now() + TTL_MS });
}

export function takeProposal(id: string): { proposal: ImportProposal; snapshot: InventorySnapshot } | null {
  sweep();
  const entry = store.get(id);
  return entry ? { proposal: entry.proposal, snapshot: entry.snapshot } : null;
}
