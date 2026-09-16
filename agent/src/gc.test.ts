import { describe, expect, it } from "vitest";
import { buildCacheLimit, collectableImages } from "./gc";

describe("collectableImages", () => {
  it("removes unmanaged tags while keeping releases and container images", () => {
    expect(
      collectableImages({
        repositories: ["marczelloo-tools-app", "marczelloo/neo-beat-buddy"],
        tags: [
          "marczelloo-tools-app:abc123def456",
          "marczelloo-tools-app:latest",
          "marczelloo/neo-beat-buddy:autoplay-0176493",
          "marczelloo/neo-beat-buddy:live",
          "other-project:latest",
          "marczelloo-tools-app:<none>",
          "<none>:<none>",
        ],
        kept: ["marczelloo-tools-app:abc123def456"],
        inUse: ["marczelloo/neo-beat-buddy:live", "sha256:container-image-id"],
      })
    ).toEqual(["marczelloo-tools-app:latest", "marczelloo/neo-beat-buddy:autoplay-0176493"]);
  });

  it("supports registry ports and namespaces", () => {
    expect(
      collectableImages({
        repositories: ["ghcr.io:443/org/app"],
        tags: ["ghcr.io:443/org/app:kept", "ghcr.io:443/org/app:old", "ghcr.io/org/app:old"],
        kept: ["ghcr.io:443/org/app:kept"],
        inUse: [],
      })
    ).toEqual(["ghcr.io:443/org/app:old"]);
  });
});

describe("buildCacheLimit", () => {
  it("accepts Docker size values and falls back for invalid input", () => {
    expect(buildCacheLimit("1.5GB")).toBe("1.5GB");
    expect(buildCacheLimit("250mb")).toBe("250mb");
    expect(buildCacheLimit("10 GiB")).toBe("10GB");
    expect(buildCacheLimit(undefined)).toBe("10GB");
  });
});
