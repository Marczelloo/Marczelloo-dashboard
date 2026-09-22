"use client";

import { useEffect, useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/layout/form-layout";
import { Button, Input, SegmentedControl, Switch, Textarea } from "@/components/ui";
import { CodePanel } from "./code-panel";

type Bump = "patch" | "minor" | "major";

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = /github\.com[/:]([^/]+)\/([^/?#]+)/.exec(url);
  return match ? { owner: match[1], repo: match[2].replace(/\.git$/, "") } : null;
}

function bump(tag: string | null, kind: Bump): string {
  const match = /v?(\d+)\.(\d+)\.(\d+)/.exec(tag ?? "");
  const [major, minor, patch] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
  if (kind === "major") return `v${major + 1}.0.0`;
  if (kind === "minor") return `v${major}.${minor + 1}.0`;
  return `v${major}.${minor}.${patch + 1}`;
}

function ReleaseForm({ owner, repo, onCreated }: { owner: string; repo: string; onCreated?: (release: { tag_name: string; html_url: string }) => void }) {
  const [latest, setLatest] = useState<string | null>(null);
  const [kind, setKind] = useState<Bump>("patch");
  const [tagName, setTagName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [autoNotes, setAutoNotes] = useState(true);
  const [prerelease, setPrerelease] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/github/repos/${owner}/${repo}/releases?latest=true`).catch(() => null);
      const result = response?.ok ? ((await response.json()) as { data?: { tag_name?: string } | null }) : null;
      const tag = result?.data?.tag_name ?? null;
      setLatest(tag);
      setTagName(bump(tag, "patch"));
    })();
  }, [owner, repo]);

  function choose(next: Bump) {
    setKind(next);
    setTagName(bump(latest, next));
  }

  async function create() {
    if (!tagName.trim()) {
      toast.error("Give the release a tag");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/github/repos/${owner}/${repo}/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagName: tagName.trim(),
          name: name.trim() || tagName.trim(),
          description: autoNotes ? undefined : description,
          prerelease,
          autoGenerateNotes: autoNotes,
          previousTag: latest ?? undefined,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { data?: { tag_name: string; html_url: string }; error?: string };
      if (!response.ok || !result.data) {
        toast.error(result.error ?? "GitHub did not create the release");
        return;
      }
      toast.success(`Released ${result.data.tag_name}`);
      setLatest(result.data.tag_name);
      setTagName(bump(result.data.tag_name, kind));
      setName("");
      setDescription("");
      onCreated?.(result.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3.5 p-3.5">
      <p className="text-[12px] text-fg-3">
        Latest: <code className="text-fg-2">{latest ?? "none yet"}</code>
      </p>
      <SegmentedControl<Bump>
        aria-label="Version bump"
        value={kind}
        onChange={choose}
        options={[
          { value: "patch", label: "Patch" },
          { value: "minor", label: "Minor" },
          { value: "major", label: "Major" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Tag" htmlFor="release-tag">
          <Input id="release-tag" value={tagName} onChange={(event) => setTagName(event.target.value)} className="font-mono" />
        </FormField>
        <FormField label="Title" htmlFor="release-name">
          <Input id="release-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={tagName || "Same as the tag"} />
        </FormField>
      </div>
      <label className="flex items-center justify-between gap-3 text-[13px]">
        <span>
          Write notes from merged pull requests
          <span className="block text-[11.5px] text-fg-3">GitHub lists what changed since {latest ?? "the first commit"}.</span>
        </span>
        <Switch checked={autoNotes} onChange={setAutoNotes} aria-label="Generate notes" />
      </label>
      {!autoNotes && <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="What changed, in markdown" aria-label="Release notes" />}
      <label className="flex items-center justify-between gap-3 text-[13px]">
        Pre-release
        <Switch checked={prerelease} onChange={setPrerelease} aria-label="Pre-release" />
      </label>
      <Button onClick={() => void create()} loading={saving} disabled={!tagName.trim()}>
        <Tag strokeWidth={1.75} />
        Create {tagName || "release"}
      </Button>
    </div>
  );
}

/** Tag a new version on GitHub, with the next number suggested. */
export function ReleaseCreator({ githubUrl, onReleaseCreated }: { githubUrl: string; onReleaseCreated?: (release: { tag_name: string; html_url: string }) => void }) {
  const parsed = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);
  if (!parsed) return null;
  return (
    <CodePanel title="New release" icon={Tag} defaultOpen={false}>
      <ReleaseForm owner={parsed.owner} repo={parsed.repo} onCreated={onReleaseCreated} />
    </CodePanel>
  );
}
