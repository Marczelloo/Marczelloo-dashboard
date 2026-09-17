import { describe, expect, it } from "vitest";
import { readSidebarMode, SIDEBAR_KEY, writeSidebarMode } from "./sidebar-preference";

describe("sidebar preference", () => {
  it("defaults to expanded and reads a stored collapsed value", () => {
    expect(readSidebarMode(null)).toBe("expanded");
    expect(readSidebarMode({ getItem: () => "collapsed" })).toBe("collapsed");
    expect(readSidebarMode({ getItem: () => "garbage" })).toBe("expanded");
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readSidebarMode(broken)).toBe("expanded");
    expect(() => writeSidebarMode(broken, "collapsed")).not.toThrow();
  });

  it("writes under a stable key", () => {
    const written: string[] = [];
    writeSidebarMode({ setItem: (key, value) => written.push(`${key}=${value}`) }, "collapsed");
    expect(written).toEqual([`${SIDEBAR_KEY}=collapsed`]);
  });
});
