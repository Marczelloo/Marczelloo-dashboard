"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProjectAction, updateProjectAction, updateProjectSharedNetworkAction } from "@/app/actions/projects";
import { FormActions, FormField, FormLayout, FormSection, SectionNav, type FormSectionLink } from "@/components/layout/form-layout";
import { StatusDot } from "@/components/status-dot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectStatus } from "@/types";
import type { ProjectDetail } from "@/server/projects/detail";

const SECTIONS: FormSectionLink[] = [
  { id: "identity", label: "Identity" },
  { id: "links", label: "Links" },
  { id: "deployment", label: "Deployment" },
  { id: "notes", label: "Notes" },
  { id: "danger", label: "Danger zone", tone: "danger" },
];

const STATUSES: ProjectStatus[] = ["active", "inactive", "maintenance", "archived"];
const toList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

/** managed: the project deploys through the agent, so its network setting applies. */
export function SettingsTab({ detail, managed }: { detail: ProjectDetail; managed: boolean }) {
  const router = useRouter();
  const { project } = detail;
  const [form, setForm] = useState({
    name: project.name,
    slug: project.slug,
    description: project.description ?? "",
    status: project.status,
    github_url: project.github_url ?? "",
    prod_url: project.prod_url ?? "",
    vercel_url: project.vercel_url ?? "",
    tags: (Array.isArray(project.tags) ? project.tags : []).join(", "),
    technologies: (Array.isArray(project.technologies) ? project.technologies : []).join(", "),
    notes: project.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharedNetwork, setSharedNetwork] = useState(detail.config?.sharedNetwork === true);
  const [savingNetwork, setSavingNetwork] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify({
    name: project.name,
    slug: project.slug,
    description: project.description ?? "",
    status: project.status,
    github_url: project.github_url ?? "",
    prod_url: project.prod_url ?? "",
    vercel_url: project.vercel_url ?? "",
    tags: (Array.isArray(project.tags) ? project.tags : []).join(", "),
    technologies: (Array.isArray(project.technologies) ? project.technologies : []).join(", "),
    notes: project.notes ?? "",
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = await updateProjectAction(project.id, {
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
      status: form.status,
      github_url: form.github_url || undefined,
      prod_url: form.prod_url || undefined,
      vercel_url: form.vercel_url || undefined,
      tags: toList(form.tags),
      technologies: toList(form.technologies),
      notes: form.notes || undefined,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Project saved");
      router.refresh();
    } else {
      toast.error("Could not save the project", { description: result.error });
    }
  };

  const toggleSharedNetwork = async (next: boolean) => {
    setSavingNetwork(true);
    const result = await updateProjectSharedNetworkAction(project.id, next);
    setSavingNetwork(false);
    if (result.success) {
      setSharedNetwork(next);
      toast.success(next ? "Every service joins the shared network" : "Only routed services join the shared network", { description: "Takes effect on the next deploy or environment apply." });
    } else {
      toast.error("Could not save the network setting", { description: result.error });
    }
  };

  const remove = async () => {
    setDeleting(true);
    const result = await deleteProjectAction(project.id);
    setDeleting(false);
    if (result.success) {
      toast.success(`${project.name} deleted`);
      router.push("/projects");
    } else {
      toast.error("Could not delete the project", { description: result.error });
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
      <SectionNav sections={SECTIONS} />
      <FormLayout
        rail={
          <>
            <Panel className="grid gap-2.5 p-3.5">
              <p className="text-[11.5px] text-fg-3">Preview in the list</p>
              <div className="rounded-md border border-line p-3">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <StatusDot status={detail.tone} />
                  <span className="truncate">{form.name || "Untitled project"}</span>
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-fg-3">{detail.domain ?? "no domain"}</p>
                {toList(form.tags).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {toList(form.tags).slice(0, 4).map((tag) => (
                      <Chip key={tag}>{tag}</Chip>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11.5px] text-fg-3">Address</p>
              <code className="text-[11.5px] text-fg-2">/projects/{form.slug || project.id}</code>
            </Panel>
            <Panel className="grid gap-2 p-3.5">
              <p className="text-[11.5px] text-fg-3">Related</p>
              <Link href={`/projects/${project.id}?tab=domains`} className="flex items-center gap-2 text-[13px] text-fg-2 hover:text-fg">
                <Globe className="size-4" strokeWidth={1.75} />
                Domains and tunnel
              </Link>
              <Link href={`/projects/${project.id}?tab=environment`} className="flex items-center gap-2 text-[13px] text-fg-2 hover:text-fg">
                <KeyRound className="size-4" strokeWidth={1.75} />
                Environment variables
              </Link>
            </Panel>
          </>
        }
      >
        <FormSection id="identity" title="Identity" description="How the project appears across the dashboard.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Name" htmlFor="name">
              <Input id="name" value={form.name} onChange={set("name")} required />
            </FormField>
            <FormField label="Slug" htmlFor="slug" hint="Used in URLs and compose project names.">
              <Input id="slug" className="font-mono" value={form.slug} onChange={set("slug")} required />
            </FormField>
          </div>
          <FormField label="Description" htmlFor="description">
            <Textarea id="description" rows={3} value={form.description} onChange={set("description")} />
          </FormField>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Status" htmlFor="status">
              <Select value={form.status} onValueChange={(status) => setForm((current) => ({ ...current, status: status as ProjectStatus }))}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tags" htmlFor="tags" hint="Comma separated.">
              <Input id="tags" value={form.tags} onChange={set("tags")} placeholder="backend, api" />
            </FormField>
          </div>
        </FormSection>

        <FormSection id="links" title="Links" description="Repository and public addresses.">
          <FormField label="GitHub URL" htmlFor="github">
            <Input id="github" className="font-mono" value={form.github_url} onChange={set("github_url")} placeholder="https://github.com/owner/repo" />
          </FormField>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Production URL" htmlFor="prod">
              <Input id="prod" className="font-mono" value={form.prod_url} onChange={set("prod_url")} placeholder="https://…" />
            </FormField>
            <FormField label="Vercel URL" htmlFor="vercel">
              <Input id="vercel" className="font-mono" value={form.vercel_url} onChange={set("vercel_url")} placeholder="https://…" />
            </FormField>
          </div>
          <FormField label="Technologies" htmlFor="tech" hint="Comma separated.">
            <Input id="tech" value={form.technologies} onChange={set("technologies")} placeholder="next.js, typescript" />
          </FormField>
        </FormSection>

        <FormSection id="deployment" title="Deployment" description="Domains and environment live on their own tabs.">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={`/projects/${project.id}?tab=domains`}>Open domains</Link>
            </Button>
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={`/projects/${project.id}?tab=environment`}>Open environment</Link>
            </Button>
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={`/projects/${project.id}?tab=deployments`}>Releases and rollback</Link>
            </Button>
          </div>
          {managed && (
            <label className="flex items-center justify-between gap-3 border-t border-line-subtle pt-3.5 text-[13px]">
              <span>
                Every service joins the shared network
                <span className="block text-[11.5px] text-fg-3">
                  Workers without a domain can then reach shared services by name, e.g. <code className="text-fg-2">http://atlashub-gateway:4545</code>. Takes effect on the next deploy or environment apply.
                </span>
              </span>
              <Switch checked={sharedNetwork} onChange={(next) => void toggleSharedNetwork(next)} disabled={savingNetwork} aria-label="Every service joins the shared network" />
            </label>
          )}
        </FormSection>

        <FormSection id="notes" title="Notes" description="Private notes; never shown in the demo.">
          <Textarea rows={4} value={form.notes} onChange={set("notes")} />
        </FormSection>

        <FormActions note={dirty ? "Unsaved changes" : "Everything saved"}>
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/projects/${project.id}`)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </FormActions>

        <FormSection id="danger" title="Danger zone" description="Deleting removes services, deploy history and tasks." tone="danger">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="danger" size="sm" loading={deleting}>
                <Trash2 strokeWidth={1.75} />
                Delete project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the project, its services, deploy history and tasks from the dashboard. Containers on the Pi are not touched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void remove()}>Delete project</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </FormSection>
      </FormLayout>
    </form>
  );
}
