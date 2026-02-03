"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, ExternalLink, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button, Badge } from "@/components/ui";
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
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h3 className="font-medium">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} onClose={() => setOpen(false)} />
                ))
              )}
            </div>

            <div className="border-t border-border p-2">
              <Link
                href="/audit"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 rounded p-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                View all activity
                <ExternalLink className="h-3 w-3" />
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
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const content = (
    <div
      className={`flex gap-3 p-3 hover:bg-secondary/50 transition-colors ${
        !notification.read ? "bg-secondary/20" : ""
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{notification.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
        <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(notification.timestamp)}</p>
      </div>
      {!notification.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
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
