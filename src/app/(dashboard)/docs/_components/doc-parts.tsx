import Link from "next/link";
import { Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export { Kbd } from "@/components/ui";

/** One page of the docs: a panel with a title and a short lead. */
export function DocSection({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} data-doc-section className="scroll-mt-20 rounded-lg border border-line bg-surface bg-sheen shadow-inset-top">
      <header className="border-b border-line-subtle px-4 py-3.5 md:px-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
          <a href={`#${id}`} className="hover:underline hover:decoration-line-strong hover:underline-offset-4">
            {title}
          </a>
        </h2>
        {lead && <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{lead}</p>}
      </header>
      <div className="grid gap-4 px-4 py-4 text-[13.5px] leading-relaxed text-fg-2 md:px-5">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="-mb-1.5 mt-1 text-[13px] font-semibold text-fg">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[72ch]">{children}</p>;
}

export function C({ children }: { children: React.ReactNode }) {
  return <code className="rounded-xs bg-white/[.05] px-1 py-px font-mono text-[12px] text-fg">{children}</code>;
}

const LINK = "text-fg underline decoration-line-strong underline-offset-[3px] transition-colors hover:decoration-fg-3";

/** Link to a page of the app, or to another section of the docs with `#id`. */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={LINK}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={LINK}>
      {children}
    </Link>
  );
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="grid max-w-[72ch] gap-1.5 pl-4 [&>li]:list-disc [&>li]:marker:text-fg-4">{children}</ul>;
}

/** Numbered procedure; each child is one step. */
export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="grid max-w-[72ch] gap-3 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <li className="relative grid gap-1.5 pl-8 [counter-increment:step] before:absolute before:left-0 before:top-px before:flex before:size-5 before:items-center before:justify-center before:rounded-full before:border before:border-line-strong before:font-mono before:text-[10.5px] before:text-fg-3 before:content-[counter(step)]">
      <p className="font-medium text-fg">{title}</p>
      {children && <div className="grid gap-2 text-fg-2">{children}</div>}
    </li>
  );
}

export function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-canvas">
      <div className="flex items-center justify-between gap-2 border-b border-line-subtle py-1 pl-3 pr-1">
        <span className="text-[11px] text-fg-4">{title ?? "shell"}</span>
        <CopyButton value={children} />
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-[1.7] text-fg-2">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** Label/value rows, the same shape the settings pages use. */
export function Facts({ children }: { children: React.ReactNode }) {
  return <dl className="-my-1 grid">{children}</dl>;
}

export function Fact({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[180px_minmax(0,1fr)] [&+&]:border-t [&+&]:border-line-subtle">
      <dt className="text-[13px] text-fg">{label}</dt>
      <dd className="text-[13px] text-fg-3">{children}</dd>
    </div>
  );
}

export function Callout({ tone = "note", children }: { tone?: "note" | "warn"; children: React.ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div className={cn("flex gap-2.5 rounded-md border px-3 py-2.5 text-[13px]", tone === "warn" ? "border-warn/25 bg-warn/[.07]" : "border-line bg-white/[.02]")}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warn" ? "text-warn" : "text-fg-3")} strokeWidth={1.75} />
      <div className="grid gap-1.5 text-fg-2">{children}</div>
    </div>
  );
}

export interface EnvRow {
  name: string;
  what: React.ReactNode;
  required?: boolean;
  example?: string;
}

/** Environment variables of one group. */
export function EnvTable({ title, rows }: { title: string; rows: EnvRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <p className="border-b border-line-subtle bg-white/[.015] px-3 py-2 text-[12px] font-medium text-fg">{title}</p>
      {rows.map((row) => (
        <div key={row.name} className="grid gap-x-4 gap-y-1 px-3 py-2.5 md:grid-cols-[250px_minmax(0,1fr)] [&+&]:border-t [&+&]:border-line-subtle">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-[12px] text-fg">{row.name}</code>
            {row.required && <span className="text-[10.5px] font-medium uppercase tracking-wide text-warn">required</span>}
          </div>
          <div className="grid gap-0.5 text-[12.5px] text-fg-3">
            <span>{row.what}</span>
            {row.example && <code className="truncate font-mono text-[11.5px] text-fg-4">{row.example}</code>}
          </div>
        </div>
      ))}
    </div>
  );
}
