import { cn } from "@/lib/utils";

/** Form column plus a context rail; the rail moves below the form under lg. */
export function FormLayout({ children, rail, className }: { children: React.ReactNode; rail?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4", rail ? "lg:grid-cols-[minmax(0,1.5fr)_300px]" : "max-w-[720px]", className)}>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      {rail && <div className="flex flex-col gap-4">{rail}</div>}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  id,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
  tone?: "default" | "danger";
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-20 rounded-lg border bg-surface bg-sheen shadow-inset-top", tone === "danger" ? "border-err/25" : "border-line")}
    >
      <div className={cn("border-b px-3.5 py-3", tone === "danger" ? "border-err/20" : "border-line-subtle")}>
        <h2 className={cn("text-[13.5px] font-semibold", tone === "danger" && "text-err")}>{title}</h2>
        {description && <p className="mt-0.5 text-[11.5px] text-fg-3">{description}</p>}
      </div>
      <div className="grid gap-3.5 p-3.5">{children}</div>
    </section>
  );
}

/** Row of actions pinned to the bottom of a form panel. */
export function FormActions({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface bg-sheen px-3.5 py-2.5 shadow-inset-top">
      <span className="text-[11.5px] text-fg-3">{note}</span>
      <span className="flex items-center gap-2">{children}</span>
    </div>
  );
}

export function FormField({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-2">
        {label}
      </label>
      {children}
      {(error ?? hint) && <p className={cn("text-[11.5px]", error ? "text-err" : "text-fg-3")}>{error ?? hint}</p>}
    </div>
  );
}

export interface FormSectionLink {
  id: string;
  label: string;
  tone?: "default" | "danger";
}

/** Index of the sections on a long settings form. */
export function SectionNav({ sections }: { sections: FormSectionLink[] }) {
  return (
    <nav aria-label="Sections" className="sticky top-[68px] hidden lg:flex lg:flex-col lg:gap-px">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={cn(
            "rounded-sm px-2.5 py-1.5 text-[13px] transition-colors duration-quick hover:bg-white/[.04]",
            section.tone === "danger" ? "text-err/80 hover:text-err" : "text-fg-3 hover:text-fg"
          )}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
