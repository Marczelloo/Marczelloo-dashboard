"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { FormSection } from "@/components/layout/form-layout";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip } from "@/components/ui";
import type { Tone } from "@/lib/tone";

interface Info {
  atlashub: string;
  portainer: string;
  discord: string;
  agent: string;
  cloudflare: string;
}

interface GitHubStatus {
  configured: boolean;
  connected?: boolean;
  repoCount?: number;
  rateLimit?: { remaining: number; limit: number; resetsAt: string };
  error?: string;
}

const toneOf = (value: string | undefined): { tone: Tone; label: string } =>
  value === "configured" ? { tone: "ok", label: "configured" } : value === "not set" ? { tone: "idle", label: "not set" } : { tone: "err", label: "missing" };

function Row({
  name,
  description,
  tone,
  state,
  children,
}: {
  name: string;
  description: string;
  tone: Tone;
  state: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 [&+&]:border-t [&+&]:border-line-subtle">
      <StatusDot status={tone} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{name}</p>
        <p className="truncate text-[11.5px] text-fg-3">{description}</p>
      </div>
      <span className="flex shrink-0 items-center gap-2">
        <Chip tone={tone === "ok" ? "ok" : tone === "err" ? "err" : "idle"}>{state}</Chip>
        {children}
      </span>
    </div>
  );
}

/** Everything the dashboard talks to, in one list, each row saying whether it answers. */
export function ConnectionsSection({ agentReachable }: { agentReachable: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [github, setGithub] = useState<GitHubStatus | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [infoResponse, githubResponse] = await Promise.all([
      fetch("/api/settings/info", { cache: "no-store" }).then((response) => response.json().catch(() => null)),
      fetch("/api/github/status", { cache: "no-store" }).then((response) => response.json().catch(() => null)),
    ]);
    if (infoResponse) setInfo(infoResponse as Info);
    if (githubResponse) setGithub(githubResponse as GitHubStatus);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function test(what: "docker" | "github" | "discord") {
    setTesting(what);
    try {
      if (what === "docker") {
        const response = await fetch("/api/settings/test-portainer", { method: "POST" });
        const result = (await response.json().catch(() => ({}))) as { success?: boolean; endpoints?: number; error?: string };
        if (result.success) toast.success(`Docker answered · ${result.endpoints} endpoint${result.endpoints === 1 ? "" : "s"}`);
        else toast.error(result.error ?? "Docker did not answer");
      }
      if (what === "github") {
        const response = await fetch("/api/github/status", { cache: "no-store" });
        const result = (await response.json().catch(() => ({}))) as GitHubStatus;
        setGithub(result);
        if (result.connected) toast.success(`GitHub answered · ${result.repoCount ?? 0} repositories`);
        else toast.error(result.error ?? "GitHub did not answer");
      }
      if (what === "discord") {
        const response = await fetch("/api/settings/test-discord", { method: "POST" });
        const result = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (result.success) toast.success("Discord received the test message");
        else toast.error(result.error ?? "Discord did not accept the message");
      }
    } finally {
      setTesting(null);
    }
  }

  const githubState = !github ? { tone: "idle" as Tone, label: "checking" } : github.connected ? { tone: "ok" as Tone, label: "connected" } : github.configured ? { tone: "err" as Tone, label: "error" } : { tone: "idle" as Tone, label: "not set" };

  return (
    <FormSection id="connections" title="Connections" description="What the dashboard talks to, and whether it answers.">
      <div className="-my-1">
        <Row name="Deploy agent" description="Builds, deploys and reports on the Pi." tone={agentReachable ? "ok" : "err"} state={agentReachable ? "answering" : "silent"} />

        <Row name="Docker" description="Container state, logs and lifecycle, through Portainer." tone={toneOf(info?.portainer).tone} state={toneOf(info?.portainer).label}>
          <Button variant="secondary" size="sm" onClick={() => void test("docker")} disabled={testing !== null}>
            {testing === "docker" ? <Loader2 className="animate-spin" /> : <Plug strokeWidth={1.75} />}
            Test
          </Button>
        </Row>

        <Row
          name="GitHub"
          description={
            github?.rateLimit
              ? `Webhooks and repository reads · ${github.rateLimit.remaining} of ${github.rateLimit.limit} API calls left`
              : "Push webhooks, commits, pull requests and releases."
          }
          tone={githubState.tone}
          state={githubState.label}
        >
          <Button variant="secondary" size="sm" onClick={() => void test("github")} disabled={testing !== null}>
            {testing === "github" ? <Loader2 className="animate-spin" /> : <Plug strokeWidth={1.75} />}
            Test
          </Button>
        </Row>

        <Row name="Database" description="Projects, deploys, tasks and settings live in AtlasHub." tone={toneOf(info?.atlashub).tone} state={toneOf(info?.atlashub).label} />

        <Row name="Cloudflare" description="Tunnel routes and DNS records for every domain." tone={toneOf(info?.cloudflare).tone} state={toneOf(info?.cloudflare).label} />

        <Row name="Discord" description="Where alerts are posted." tone={info?.discord === "configured" ? "ok" : "idle"} state={info?.discord ?? "—"}>
          <Button variant="secondary" size="sm" onClick={() => void test("discord")} disabled={testing !== null || info?.discord !== "configured"}>
            {testing === "discord" ? <Loader2 className="animate-spin" /> : <Plug strokeWidth={1.75} />}
            Send test
          </Button>
        </Row>
      </div>

      <p className="text-[11.5px] text-fg-3">
        Each of these is configured with an environment variable on the dashboard container; the values never pass through this page.
      </p>
    </FormSection>
  );
}
