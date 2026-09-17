"use client";

import { useRef, useState } from "react";
import { PinDialog } from "@/components/pin-dialog";
import { needsPin, type GuardedResult } from "./pin-guard";

/** Runs an action; when it needs the PIN, asks for it once and retries. */
export function usePinGuard() {
  const [open, setOpen] = useState(false);
  const pending = useRef<((verified: boolean) => void) | null>(null);

  async function run<T extends GuardedResult>(action: () => Promise<T>): Promise<T | null> {
    const first = await action();
    if (!needsPin(first)) return first;
    const verified = await new Promise<boolean>((resolve) => {
      pending.current = resolve;
      setOpen(true);
    });
    return verified ? action() : null;
  }

  const settle = (verified: boolean) => {
    setOpen(false);
    pending.current?.(verified);
    pending.current = null;
  };

  return { run, dialog: <PinDialog open={open} onSuccess={() => settle(true)} onCancel={() => settle(false)} /> };
}
