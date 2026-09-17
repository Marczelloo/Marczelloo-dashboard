import { describe, expect, it } from "vitest";
import { FOOTER_LINKS, isActive, NAV_GROUPS, sectionFor } from "./nav";

describe("isActive", () => {
  it("matches Overview only on the root path", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/projects", "/")).toBe(false);
  });

  it("matches a section and its sub-pages but not look-alike prefixes", () => {
    expect(isActive("/projects", "/projects")).toBe(true);
    expect(isActive("/projects/abc?tab=env", "/projects")).toBe(true);
    expect(isActive("/projectsx", "/projects")).toBe(false);
  });
});

describe("sectionFor", () => {
  it("finds the navigation entry for nested and footer routes", () => {
    expect(sectionFor("/projects/abc")?.label).toBe("Projects");
    expect(sectionFor("/settings")?.label).toBe("Settings");
    expect(sectionFor("/")?.label).toBe("Overview");
    expect(sectionFor("/nowhere")).toBeNull();
  });
});

describe("navigation", () => {
  it("has unique destinations and no Tech News", () => {
    const hrefs = [...NAV_GROUPS.flatMap((group) => group.items), ...FOOTER_LINKS].map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).not.toContain("/news");
  });
});
