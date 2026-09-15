import { describe, expect, it } from "vitest";
import { groupByComposeProject, parseDockerInspect } from "./docker-facts";

const inspect = JSON.stringify([
  {
    Id: "c1",
    Name: "/marczelloo-drive",
    Created: "2026-08-29T13:03:00Z",
    Image: "sha256:" + "a".repeat(64),
    State: { Status: "running" },
    Config: {
      Image: "marczelloo-drive-drive",
      Env: ["PATH=/usr/bin", "ATLASHUB_API_URL=https://api.example", "EMPTY=", "WITH_EQ=a=b"],
      Labels: {
        "com.docker.compose.project": "marczelloo-drive",
        "com.docker.compose.service": "drive",
        "com.docker.compose.project.working_dir": "/home/Marczelloo_pi/projects/marczelloo-drive",
        "com.docker.compose.project.config_files": "/home/Marczelloo_pi/projects/marczelloo-drive/docker-compose.yml",
      },
    },
    NetworkSettings: {
      Ports: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "3030" }], "9229/tcp": null },
      Networks: { "marczelloo-drive_default": {} },
    },
    Mounts: [],
  },
  {
    Id: "c2",
    Name: "/marczelloo-drive-compressor",
    Created: "2026-08-29T13:03:00Z",
    Image: "sha256:" + "a".repeat(64),
    State: { Status: "running" },
    Config: { Image: "marczelloo-drive-compressor", Env: null, Labels: { "com.docker.compose.project": "marczelloo-drive", "com.docker.compose.service": "compressor", "com.docker.compose.oneoff": "False" } },
    NetworkSettings: { Ports: {}, Networks: {} },
    Mounts: [{ Type: "volume", Name: "marczelloo-drive_compression-tmp", Source: "/var/lib/docker/volumes/x/_data", Destination: "/var/lib/marczelloo-drive/compression", RW: true }],
  },
  { Id: "c3", Name: "/standalone", Created: "2026-01-01T00:00:00Z", Image: "sha256:" + "b".repeat(64), State: { Status: "exited" }, Config: { Image: "busybox", Env: [], Labels: null }, NetworkSettings: null, Mounts: null },
]);

describe("parseDockerInspect", () => {
  it("normalizes names, labels, env, ports and mounts", () => {
    const [drive, compressor] = parseDockerInspect(inspect);
    expect(drive).toMatchObject({
      name: "marczelloo-drive",
      image: "marczelloo-drive-drive",
      status: "running",
      composeProject: "marczelloo-drive",
      composeService: "drive",
      oneOff: false,
      workingDir: "/home/Marczelloo_pi/projects/marczelloo-drive",
      configFiles: ["/home/Marczelloo_pi/projects/marczelloo-drive/docker-compose.yml"],
      env: { PATH: "/usr/bin", ATLASHUB_API_URL: "https://api.example", EMPTY: "", WITH_EQ: "a=b" },
      ports: [{ hostIp: "127.0.0.1", hostPort: 3030, containerPort: 3000, protocol: "tcp" }],
      networks: ["marczelloo-drive_default"],
    });
    expect(compressor.mounts).toEqual([
      { type: "volume", name: "marczelloo-drive_compression-tmp", source: "/var/lib/docker/volumes/x/_data", destination: "/var/lib/marczelloo-drive/compression", readOnly: false },
    ]);
  });

  it("groups by compose project and keeps loose containers", () => {
    const { stacks, loose } = groupByComposeProject(parseDockerInspect(inspect));
    expect([...stacks.keys()]).toEqual(["marczelloo-drive"]);
    expect(stacks.get("marczelloo-drive")).toHaveLength(2);
    expect(loose.map((container) => container.name)).toEqual(["standalone"]);
  });
});
