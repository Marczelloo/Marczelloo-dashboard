"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";

interface Notification {
  id: string;
  type: "deploy" | "alert" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load notifications on mount and poll every 30 seconds
  useEffect(() => {
    loadNotifications();

    const pollInterval = setInterval(() => {
      loadNotifications();
    }, 30000); // 30 seconds

    return () => clearInterval(pollInterval);
  }, []);

  // Also refresh when dropdown opens
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
      }
    } catch {
      // Fallback to empty
    }
    setIsLoading(false);
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(!open)}>
        <Bell className="size-4" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 grid min-w-[16px] place-items-center rounded-full bg-accent-solid px-1 font-mono text-[9.5px] leading-4 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-2rem))] animate-overlay-in overflow-hidden rounded-lg border border-line-strong bg-surface-raised shadow-overlay">
            <div className="flex items-center justify-between border-b border-line-subtle px-3 py-2.5">
              <h3 className="text-[13px] font-medium">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-fg-3 transition-colors duration-quick hover:text-fg">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-4 animate-spin text-fg-3" strokeWidth={1.75} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-fg-3">No notifications</div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} onClose={() => setOpen(false)} />
                ))
              )}
            </div>

            <div className="border-t border-line-subtle p-1.5">
              <Link
                href="/audit-log"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-sm p-2 text-xs text-fg-3 transition-colors duration-quick hover:bg-white/[.04] hover:text-fg"
              >
                View all activity
                <ExternalLink className="size-3" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationItem({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "deploy":
        return <CheckCircle className="size-4 text-ok" strokeWidth={1.75} />;
      case "alert":
        return <AlertTriangle className="size-4 text-warn" strokeWidth={1.75} />;
      default:
        return <Bell className="size-4 text-fg-3" strokeWidth={1.75} />;
    }
  };

  const content = (
    <div
      className={`flex gap-3 px-3 py-2.5 transition-colors duration-quick hover:bg-white/[.04] ${!notification.read ? "bg-white/[.02]" : ""}`}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium">{notification.title}</p>
        <p className="line-clamp-2 text-xs text-fg-3">{notification.message}</p>
        <p className="mt-1 font-mono text-[11px] text-fg-4">{formatRelativeTime(notification.timestamp)}</p>
      </div>
      {!notification.read && <span className="mt-1.5 size-[7px] shrink-0 rounded-full bg-accent" />}
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={onClose}>
        {content}
      </Link>
    );
  }

  return content;
}
