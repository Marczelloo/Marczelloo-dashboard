import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border border-line bg-surface bg-sheen text-fg shadow-inset-top", className)} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-0.5 border-b border-line-subtle px-3.5 py-3", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-[13.5px] font-semibold leading-snug", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-[11.5px] text-fg-3", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-3.5", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-3.5 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

/** Panel is the design-system name for a Card. */
const Panel = Card;

/** Title row of a Panel: icon, title, optional note, actions on the right. */
function PanelHeader({
  title,
  icon: Icon,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-3", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
          {Icon && <Icon className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} />}
          <span className="truncate">{title}</span>
        </h2>
        {description && <p className="mt-0.5 truncate text-[11.5px] text-fg-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export { Card, Panel, PanelHeader, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
