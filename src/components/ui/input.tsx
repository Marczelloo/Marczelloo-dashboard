import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const fieldClass =
  "w-full rounded-sm border border-line-strong bg-canvas px-2.5 text-[13px] text-fg placeholder:text-fg-4 transition-[border-color,box-shadow] duration-quick ease-out hover:border-white/20 focus-visible:border-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15 aria-[invalid=true]:border-err/50 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(fieldClass, "flex h-8 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-fg", className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
