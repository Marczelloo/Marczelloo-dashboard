/**
 * AtlasHub hands row values straight to node-pg, which encodes JS arrays as
 * Postgres array literals ({"a","b"}) and jsonb rejects them. Sending JSON text
 * lets Postgres parse it as jsonb for arrays and objects alike.
 */
export function jsonbColumns<T extends object>(row: T, columns: ReadonlyArray<keyof T>): Record<string, unknown> {
  const out = { ...row } as Record<string, unknown>;
  for (const column of columns) {
    const value = row[column];
    if (value !== null && value !== undefined) out[column as string] = JSON.stringify(value);
  }
  return out;
}
