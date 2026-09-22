import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

/** Filter field for list pages: icon inside, full width on a phone, fixed width from sm up. */
export function SearchInput({ value, onChange, placeholder, className, "aria-label": ariaLabel }: { value: string; onChange(value: string): void; placeholder: string; className?: string; "aria-label"?: string }) {
  return (
    <label className={cn("relative block w-full sm:w-[240px]", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-4" strokeWidth={1.75} />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel ?? placeholder} className="h-8 pl-8" />
    </label>
  );
}
