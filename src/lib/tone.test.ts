import { describe, expect, it } from "vitest";
import { toTone } from "./tone";

describe("toTone", () => {
  it("maps legacy status names", () => {
    expect(toTone("online")).toBe("ok");
    expect(toTone("warning")).toBe("warn");
    expect(toTone("offline")).toBe("err");
    expect(toTone("unknown")).toBe("idle");
  });

  it("keeps tones unchanged", () => {
    for (const tone of ["ok", "live", "warn", "err", "idle"] as const) expect(toTone(tone)).toBe(tone);
  });
});
