"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CarStatus } from "@/types";

// Row-level moderation menu rendered in /admin/cars. Each verb maps to a
// status transition the API enforces; "Delete" hits DELETE for true removal.
// We prompt for a reason on rejection (required by the API) and on
// hide/archive (optional but stored in admin_logs).

type Verb =
  | { kind: "status"; label: string; status: CarStatus; promptReason: boolean; reasonRequired: boolean; confirm: string }
  | { kind: "delete"; label: string; confirm: string };

const VERBS: Verb[] = [
  { kind: "status", label: "Approve",   status: "active",   promptReason: false, reasonRequired: false, confirm: "Approve and publish this listing?" },
  { kind: "status", label: "Hide",      status: "hidden",   promptReason: true,  reasonRequired: false, confirm: "Hide this listing from /cars?" },
  { kind: "status", label: "Reject",    status: "rejected", promptReason: true,  reasonRequired: true,  confirm: "Reject this listing? Owner will see the reason." },
  { kind: "status", label: "Archive",   status: "archived", promptReason: true,  reasonRequired: false, confirm: "Archive this listing? Reversible but invisible everywhere." },
  { kind: "status", label: "Mark sold", status: "sold",     promptReason: false, reasonRequired: false, confirm: "Mark as sold?" },
  { kind: "delete", label: "Delete",                                                                       confirm: "PERMANENTLY delete this listing? This cannot be undone." },
];

export function ModerationActions({
  carId,
  currentStatus,
}: {
  carId: string;
  currentStatus: CarStatus;
}) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState<string | null>(null);
  const [err, setErr]     = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run(verb: Verb) {
    setErr(null);
    if (!confirm(verb.confirm)) return;

    let reason: string | null = null;
    if (verb.kind === "status" && verb.promptReason) {
      const r = window.prompt(
        verb.reasonRequired
          ? "Reason (required — shown to the owner):"
          : "Reason (optional):",
        "",
      );
      if (verb.reasonRequired && !r?.trim()) {
        setErr("A reason is required for rejection.");
        return;
      }
      reason = r?.trim() || null;
    }

    setBusy(verb.label);
    try {
      const res = verb.kind === "delete"
        ? await fetch(`/api/admin/cars/${carId}`, { method: "DELETE" })
        : await fetch(`/api/admin/cars/${carId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ status: verb.status, reason }),
          });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error || `HTTP ${res.status}`);
      }
      setOpen(false);
      // Refresh server data so the new status / row removal is visible.
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium hover:bg-surface-3 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
      >
        Moderate ▾
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-border bg-surface shadow-lg overflow-hidden"
        >
          {VERBS.map((v) => {
            const disabled =
              v.kind === "status" && v.status === currentStatus;
            return (
              <button
                key={v.label}
                type="button"
                disabled={disabled || busy !== null}
                onClick={() => run(v)}
                className={`block w-full px-3 py-2 text-left text-xs hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  v.kind === "delete" ? "text-red-500 font-medium" : ""
                }`}
                role="menuitem"
              >
                {busy === v.label ? `${v.label}…` : v.label}
              </button>
            );
          })}
          {err && (
            <p className="px-3 py-2 text-[11px] text-red-500 border-t border-border">
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
