"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell, MessageCircle, Clock, CheckCheck, Star, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, typeof Bell> = {
  new_lead:         MessageCircle,
  task_due:         Clock,
  review:           Star,
  complaint:        AlertTriangle,
  listing_expiring: Clock,
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const json = await res.json();
        setItems(json.items ?? []);
        setUnread(json.unreadCount ?? 0);
      }
    } catch {
      /* offline — keep last state */
    }
  }, []);

  // Initial load + lightweight poll.
  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    void load();
  }

  async function openItem(item: NotificationItem) {
    if (!item.readAt && !item.id.startsWith("task:")) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
      >
        <Bell className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl z-50">
          <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs text-accent hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-muted/40 mx-auto mb-2" />
              <p className="text-sm text-muted">You're all caught up</p>
            </div>
          ) : (
            <ul>
              {items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;
                const body = (
                  <div className={cn(
                    "flex gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2 transition-colors",
                    !item.readAt && "bg-accent-soft/30",
                  )}>
                    <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-surface-2 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <span className="text-[10px] text-muted shrink-0">{timeAgo(item.createdAt)}</span>
                      </div>
                      {item.body && <p className="text-xs text-muted line-clamp-2">{item.body}</p>}
                    </div>
                    {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  </div>
                );
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link href={item.href} onClick={() => openItem(item)}>{body}</Link>
                    ) : (
                      <button type="button" className="w-full text-left" onClick={() => openItem(item)}>{body}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
