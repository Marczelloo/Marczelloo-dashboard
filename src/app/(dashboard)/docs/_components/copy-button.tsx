"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy — select the text instead");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? "Copied" : "Copy"}
      className="flex size-6 items-center justify-center rounded-sm text-fg-4 transition-colors duration-quick hover:bg-white/[.05] hover:text-fg-2"
    >
      {copied ? <Check className="size-3.5 text-ok" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
    </button>
  );
}
