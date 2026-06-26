"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CorrectionPattern } from "@/lib/vin-corrections";

const FIELD_LABELS: Record<string, string> = {
  engineCc: "Engine (cc)", transmission: "Transmission", fuel: "Fuel",
  bodyType: "Body type", model: "Model", trim: "Trim", drivetrain: "Drivetrain",
};

export function VinReviewTable({
  initial, reviewThreshold,
}: {
  initial: CorrectionPattern[];
  reviewThreshold: number;
}) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, status: "approved" | "rejected") {
    setBusy(id);
    const res = await fetch(`/api/admin/vin/corrections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
    setBusy(null);
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No correction patterns awaiting review.</p>;
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left">
            <Th>VIN prefix</Th><Th>Field</Th><Th>Suggested value</Th>
            <Th className="text-right">Times seen</Th><Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">{r.vinPrefix}</td>
              <td className="px-4 py-3">{FIELD_LABELS[r.field] ?? r.field}</td>
              <td className="px-4 py-3 font-medium">{r.value}</td>
              <td className="px-4 py-3 text-right">
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  r.timesSeen >= reviewThreshold ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
                )}>
                  {r.timesSeen}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button" disabled={busy === r.id} onClick={() => act(r.id, "approved")}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-green-500/15 px-2.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/25 disabled:opacity-50"
                  >
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                  </button>
                  <button
                    type="button" disabled={busy === r.id} onClick={() => act(r.id, "rejected")}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-muted hover:text-red-500 hover:border-red-500/30 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-muted", className)}>{children}</th>;
}
