import { describe, expect, it } from "vitest";
import { deployPhase } from "./phases";

describe("deployPhase", () => {
  it("maps agent step labels to UI phases", () => {
    expect(deployPhase("Aktualny commit")).toBe("fetch");
    expect(deployPhase("Sprawdzenie lokalnych zmian")).toBe("fetch");
    expect(deployPhase("Git clone")).toBe("fetch");
    expect(deployPhase("Git fetch 7e1f0aa")).toBe("fetch");
    expect(deployPhase("Git checkout 7e1f0aa")).toBe("fetch");
    expect(deployPhase("Compose config")).toBe("config");
    expect(deployPhase("Edge network")).toBe("config");
    expect(deployPhase("Walidacja Compose")).toBe("config");
    expect(deployPhase("Write .env")).toBe("config");
    expect(deployPhase("Build")).toBe("build");
    expect(deployPhase("Start containers")).toBe("start");
    expect(deployPhase("Bramka zdrowia")).toBe("health");
    expect(deployPhase("Rollback do 4c5d6e7")).toBe("rollback");
    expect(deployPhase("Przywracanie poprzedniego .env")).toBe("rollback");
  });

  it("returns null for missing or unknown steps", () => {
    expect(deployPhase(null)).toBeNull();
    expect(deployPhase(undefined)).toBeNull();
    expect(deployPhase("Something new")).toBeNull();
  });
});
