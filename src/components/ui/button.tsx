import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const primary =
  "bg-accent-solid text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(0,0,0,.4)] hover:bg-accent-solid-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_4px_14px_-4px_rgba(229,72,77,.55)]";
const secondary = "border-line-strong bg-surface-raised text-fg shadow-inset-top hover:bg-surface-hover";
const danger = "border-err/25 bg-err/10 text-err hover:border-err/40 hover:bg-err/15";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-sm border border-transparent font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-quick ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary,
        secondary,
        ghost: "text-fg-2 hover:bg-white/5 hover:text-fg",
        danger,
        link: "h-auto px-0 text-fg-2 underline-offset-4 hover:text-fg hover:underline active:scale-100",
        // Legacy names kept until every page is migrated (phase 8).
        default: primary,
        destructive: danger,
        outline: secondary,
      },
      size: {
        default: "h-8 px-3 text-[13px]",
        sm: "h-[26px] gap-1.5 px-[9px] text-xs [&_svg]:size-3.5",
        lg: "h-9 px-4 text-sm",
        icon: "h-8 w-8",
        "icon-sm": "h-[26px] w-[26px] [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading && !asChild ? (
          <>
            <Loader2 className="animate-spin" strokeWidth={1.75} />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
