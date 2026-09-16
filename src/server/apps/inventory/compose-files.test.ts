import { describe, expect, it } from "vitest";
import { extractEnvFileRefs, normalizeComposeConfig } from "./compose-files";

describe("extractEnvFileRefs", () => {
  it("resolves string, list and object env_file entries relative to the compose file", () => {
    const yaml = `services:
  bot:
    env_file:
      - .env
      - path: ./config/extra.env
        required: false
  lavalink:
    env_file: ../shared/lavalink.env
  plain:
    image: busybox
  templated:
    env_file: \${ENV_FILE}
`;
    expect(extractEnvFileRefs(yaml, "/home/Marczelloo_pi/projects/neobeatbuddy/docker-compose.yml")).toEqual([
      "/home/Marczelloo_pi/projects/neobeatbuddy/.env",
      "/home/Marczelloo_pi/projects/neobeatbuddy/config/extra.env",
      "/home/Marczelloo_pi/projects/shared/lavalink.env",
    ]);
  });

  it("returns nothing for files without services", () => {
    expect(extractEnvFileRefs("x: 1", "/a/docker-compose.yml")).toEqual([]);
  });
});

describe("normalizeComposeConfig", () => {
  it("unescapes $$ in environment values and labels from docker compose config JSON", () => {
    const config = normalizeComposeConfig({
      name: "x",
      services: { app: { environment: { PIN_HASH: "$$2a$$10$$abc", EMPTY: null, PLAIN: "p" }, labels: { note: "a$$b" } }, bare: {} },
    });
    expect(config.services.app.environment).toEqual({ PIN_HASH: "$2a$10$abc", EMPTY: null, PLAIN: "p" });
    expect(config.services.app.labels).toEqual({ note: "a$b" });
    expect(config.services.bare).toEqual({});
  });
});
