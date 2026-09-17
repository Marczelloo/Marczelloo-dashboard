import { describe, expect, it, vi } from "vitest";
import { ttlCache } from "./ttl-cache";

describe("ttlCache", () => {
  it("reuses a value until it expires", async () => {
    let clock = 0;
    const load = vi.fn(async () => clock);
    const get = ttlCache(1000, load, () => clock);
    expect(await get()).toBe(0);
    clock = 999;
    expect(await get()).toBe(0);
    clock = 1000;
    expect(await get()).toBe(1000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent callers", async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((done) => (resolve = done)));
    const get = ttlCache(1000, load, () => 0);
    const both = Promise.all([get(), get()]);
    resolve("x");
    expect(await both).toEqual(["x", "x"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const get = ttlCache(1000, load, () => 0);
    await expect(get()).rejects.toThrow("boom");
    expect(await get()).toBe("ok");
  });
});
