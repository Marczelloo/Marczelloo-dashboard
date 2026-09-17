"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="bottom-right"
    toastOptions={{
      classNames: {
        toast: "!rounded-lg !border !border-line-strong !bg-surface-raised !text-fg !shadow-overlay !font-sans",
        title: "!text-[13px] !font-medium",
        description: "!text-xs !text-fg-3",
        actionButton: "!bg-accent-solid !text-white !rounded-sm",
        cancelButton: "!bg-surface-hover !text-fg-2 !rounded-sm",
        success: "[&_[data-icon]]:!text-ok",
        error: "[&_[data-icon]]:!text-err",
        warning: "[&_[data-icon]]:!text-warn",
        info: "[&_[data-icon]]:!text-fg-2",
      },
    }}
    {...props}
  />
);

export { Toaster };
