import { z } from "zod";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SHA = /^[0-9a-f]{40}$/;
const ENV_FILE_NAME = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const MAX_ENV_FILE_CONTENT = 512_000;

export const deployTargetSchema = z.object({
  projectId: z.string().uuid(),
  composeProject: z.string().regex(IDENTIFIER).max(100),
  repoPath: z
    .string()
    .regex(/^\/[A-Za-z0-9._/@+-]+$/)
    .refine((value) => !value.split("/").includes(".."), "repoPath nie może zawierać ..")
    .transform((value) => value.replace(/\/+$/, "")),
  githubUrl: z.string().regex(/github\.com[/:][A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/, "Wymagane repozytorium GitHub."),
  branch: z
    .string()
    .regex(/^[A-Za-z0-9._/-]+$/)
    .refine((value) => !value.startsWith("-") && !value.includes(".."), "Nieprawidłowa gałąź."),
  composeFile: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_./-]*$/)
    .refine((value) => !value.includes(".."), "Nieprawidłowy plik Compose.")
    .nullable(),
  profiles: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)).max(10),
  tunnel: z
    .object({ hostname: z.string().regex(/^[a-z0-9.-]+$/).max(253), localPort: z.number().int().min(1).max(65535), probe: z.boolean().default(false) })
    .nullable(),
  generatedCompose: z.string().min(1).max(200_000).nullable().default(null),
});

export const jobRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("deploy"),
    target: deployTargetSchema,
    sha: z.string().regex(SHA),
    deployId: z.string().uuid(),
    triggeredBy: z.string().min(1).max(100),
    token: z.string().max(400).nullable(),
  }),
  z.object({
    kind: z.literal("rollback"),
    target: deployTargetSchema,
    sha: z.string().regex(SHA).nullable(),
    deployId: z.string().uuid(),
    triggeredBy: z.string().min(1).max(100),
  }),
  z.object({
    kind: z.literal("apply-env"),
    target: deployTargetSchema,
    deployId: z.string().uuid(),
    triggeredBy: z.string().min(1).max(100),
    envFile: z.object({
      name: z
        .string()
        .max(200)
        .regex(ENV_FILE_NAME)
        .refine((value) => !value.split("/").some((segment) => segment === "." || segment === ".."), "Nieprawidłowa nazwa pliku zmiennych."),
      content: z.string().max(MAX_ENV_FILE_CONTENT),
      previous: z.string().max(MAX_ENV_FILE_CONTENT).nullable(),
    }),
  }),
]);

export type AgentJobRequest = z.input<typeof jobRequestSchema>;

export const agentEventSchema = z.object({
  id: z.string().max(80),
  type: z.enum(["job.started", "job.finished"]),
  jobId: z.string().uuid(),
  deployId: z.string().uuid(),
  projectId: z.string().uuid(),
  composeProject: z.string().regex(IDENTIFIER),
  kind: z.enum(["deploy", "rollback", "apply-env"]),
  sha: z.string().regex(SHA),
  status: z.enum(["queued", "running", "succeeded", "failed", "rolled_back", "superseded"]),
  error: z.string().nullable(),
  rolledBackTo: z.string().regex(SHA).nullable(),
  at: z.string(),
});
