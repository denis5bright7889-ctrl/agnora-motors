"use client";

import { useState } from "react";
import { Loader2, MessageSquare, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPLAINT_CATEGORY_LABELS, type Complaint, type ComplaintCategory,
} from "@/lib/trust";

const STATUS_STYLE: Record<string, string> = {
  submitted:    "bg-red-500/15 text-red-600 dark:text-red-400",
  under_review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  resolved:     "bg-green-500/15 text-green-600 dark:text-green-400",
  dismissed:    "bg-surface-2 text-muted",
};
const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted", under_review: "Under review", resolved: "Resolved", dismissed: "Dismissed",
};

export function ComplaintsPanel({ initial }: { initial: Complaint[] }) {
  const [complaints, setComplaints] = useState(initial);

  function patch(updated: Complaint) {
    setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  if (complaints.length === 0) {
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-500/60 mx-auto mb-2" />
        <p className="text-sm text-muted">No complaints. Keep listings accurate and respond fast to stay clear.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {complaints.map((c) => <Row key={c.id} complaint={c} onPatch={patch} />)}
    </div>
  );
}

function Row({ complaint, onPatch }: { complaint: Complaint; onPatch: (c: Complaint) => void }) {
  const [response, setResponse] = useState(complaint.dealerResponse ?? "");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function send(patch: { status?: string; response?: string }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/dealer/complaints/${complaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) onPatch((await res.json()).complaint);
    } finally { setBusy(false); }
  }

  const closed = complaint.status === "resolved" || complaint.status === "dismissed";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">{COMPLAINT_CATEGORY_LABELS[complaint.category as ComplaintCategory] ?? complaint.category}</p>
          {complaint.carMake && (
            <p className="text-xs text-muted">{complaint.carYear} {complaint.carMake} {complaint.carModel}</p>
          )}
        </div>
        <span className={cn("shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_STYLE[complaint.status])}>
          {STATUS_LABEL[complaint.status]}
        </span>
      </div>

      <p className="text-sm text-muted mt-2">{complaint.detail}</p>

      {complaint.dealerResponse && !open && (
        <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-xs">
          <span className="font-semibold">Your response: </span>{complaint.dealerResponse}
        </div>
      )}

      {!closed && (
        <div className="mt-3">
          {open ? (
            <div className="space-y-2">
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={3}
                placeholder="Respond to this complaint…"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent resize-none"
              />
              <div className="flex gap-2">
                <button type="button" disabled={busy || !response.trim()} onClick={() => send({ response, status: "under_review" })}
                  className="h-8 px-3 rounded-full bg-foreground text-background text-xs font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save response
                </button>
                <button type="button" onClick={() => setOpen(false)} className="h-8 px-3 rounded-full border border-border text-xs font-medium hover:bg-surface-2">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setOpen(true)} className="h-8 px-3 rounded-full border border-border text-xs font-medium hover:bg-surface-2 inline-flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Respond
              </button>
              {complaint.status === "submitted" && (
                <button type="button" disabled={busy} onClick={() => send({ status: "under_review" })} className="h-8 px-3 rounded-full border border-border text-xs font-medium hover:bg-surface-2 disabled:opacity-50">
                  Acknowledge
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => send({ status: "resolved" })} className="h-8 px-3 rounded-full bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
