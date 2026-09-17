import { describe, expect, it } from "vitest";
import { PINNED_KEY, readPinned, togglePinned } from "./pinned-projects";

const storage = (value: string | null) => {
  let stored = value;
  return {
    getItem: () => stored,
    setItem: (_key: string, next: string) => {
      stored = next;
    },
    read: () => stored,
  };
};

describe("readPinned", () => {
  it("reads the stored ids", () => {
    expect(readPinned(storage('["a","b"]'))).toEqual(["a", "b"]);
  });

  it("returns nothing for missing, malformed or hostile storage", () => {
    expect(readPinned(null)).toEqual([]);
    expect(readPinned(storage(null))).toEqual([]);
    expect(readPinned(storage("not json"))).toEqual([]);
    expect(readPinned(storage('{"a":1}'))).toEqual([]);
    expect(readPinned(storage('["a",2]'))).toEqual(["a"]);
    expect(
      readPinned({
        getItem: () => {
          throw new Error("blocked");
        },
      })
    ).toEqual([]);
  });
});

describe("togglePinned", () => {
  it("adds, removes and persists", () => {
    const store = storage("[]");
    expect(togglePinned(store, "a")).toEqual(["a"]);
    expect(store.read()).toBe('["a"]');
    expect(togglePinned(store, "b")).toEqual(["a", "b"]);
    expect(togglePinned(store, "a")).toEqual(["b"]);
    expect(store.read()).toBe('["b"]');
  });

  it("still returns the new list when storage refuses to write", () => {
    const broken = {
      getItem: () => "[]",
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(togglePinned(broken, "a")).toEqual(["a"]);
  });
});
