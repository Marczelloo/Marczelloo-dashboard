import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea className={cn(fieldClass, "flex min-h-[80px] py-2 leading-relaxed", className)} ref={ref} {...props} />
));
Textarea.displayName = "Textarea";

export { Textarea };
