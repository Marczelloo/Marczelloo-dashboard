import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Buttons aligned to the right of the title. */
  actions?: React.ReactNode;
  /** Row under the title, typically tabs. */
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, children, className }: PageHeaderProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-fg">{title}</h1>
          {description && <p className="mt-1 text-[13px] text-fg-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6", className)}>{children}</div>;
}
