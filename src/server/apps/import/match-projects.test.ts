import { describe, expect, it } from "vitest";
import { matchStackToProject, normalizeName, repoKey } from "./match-projects";

const projects = [
  { id: "atlas", name: "AtlasHub", slug: "atlashub", github_url: "https://github.com/Marczelloo/atlashub" },
  { id: "dash", name: "Marczelloo Dashboard", slug: "marczelloo-dashboard", github_url: "https://github.com/Marczelloo/Marczelloo-dashboard" },
  { id: "neo", name: "NeoBeat Buddy", slug: "neobeat-buddy", github_url: "https://github.com/Marczelloo/NeoBeat-Buddy" },
  { id: "book", name: "Bookhaven", slug: "bookhaven", github_url: "https://github.com/Marczelloo/BookHaven" },
];
const services = [
  { project_id: "atlas", compose_project: "atlas-hub", container_id: "atlashub-gateway" },
  { project_id: "dash", compose_project: "marczelloodashboard", container_id: "marczelloo-dashboard" },
  { project_id: "neo", compose_project: "neobeatbuddy", container_id: "neo-lavalink" },
  { project_id: null, compose_project: "atlas-hub", container_id: null },
];

describe("helpers", () => {
  it("normalizes names and GitHub URLs", () => {
    expect(normalizeName("Atlas-Hub")).toBe("atlashub");
    expect(repoKey("git@github.com:Marczelloo/atlas-hub.git")).toBe("marczelloo/atlashub");
    expect(repoKey("https://github.com/Marczelloo/atlashub")).toBe("marczelloo/atlashub");
    expect(repoKey(null)).toBeNull();
  });
});

describe("matchStackToProject", () => {
  it("matches by container name even when compose_project is wrong", () => {
    const match = matchStackToProject(
      { project: "marczelloo-dashboard", workingDir: "/home/Marczelloo_pi/projects/Marczelloo-dashboard", containerNames: ["marczelloo-dashboard", "marczelloo-runner"], gitRemote: "git@github.com:Marczelloo/Marczelloo-dashboard.git" },
      projects, services, []
    );
    expect(match).toMatchObject({ projectId: "dash", confidence: "high" });
  });

  it("matches renamed repositories and compose project names", () => {
    expect(
      matchStackToProject({ project: "atlas-hub", workingDir: "/home/Marczelloo_pi/projects/atlas-hub", containerNames: ["atlashub-gateway"], gitRemote: "git@github.com:Marczelloo/atlas-hub.git" }, projects, services, [
        { projectId: "atlas", composeProject: "atlas-hub" },
      ])
    ).toMatchObject({ projectId: "atlas", confidence: "high" });
  });

  it("uses the directory name as a medium signal", () => {
    expect(matchStackToProject({ project: "bookhaven", workingDir: "/srv/BookHaven", containerNames: [], gitRemote: null }, projects, [], [])).toMatchObject({
      projectId: "book",
      confidence: "medium",
    });
  });

  it("reports conflicting strong signals without choosing", () => {
    const match = matchStackToProject({ project: "atlas-hub", workingDir: null, containerNames: ["marczelloo-dashboard"], gitRemote: null }, projects, services, []);
    expect(match.projectId).toBeNull();
    expect(match.confidence).toBe("none");
    expect(match.reasons.join(" ")).toMatch(/sprzeczne/);
  });

  it("returns none when nothing matches", () => {
    expect(matchStackToProject({ project: "x", workingDir: "/srv/x", containerNames: [], gitRemote: null }, projects, services, [])).toEqual({
      projectId: null,
      confidence: "none",
      reasons: ["Brak dopasowania do projektu w dashboardzie."],
    });
  });
});
