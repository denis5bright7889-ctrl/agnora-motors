"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

export function EmailSeller({
  carId, sellerEmail, sellerName, defaultSubject,
}: {
  carId: string;
  sellerEmail: string | null;
  sellerName: string | null;
  defaultSubject: string;
}) {
  const [open, setOpen]       = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  if (!sellerEmail) {
    return (
      <p className="text-xs text-muted">
        No account on file for this listing, so there is no email address to write to.
      </p>
    );
  }

  async function send() {
    setError("");
    setSending(true);
    try {
      const res = await fetch(`/api/admin/cars/${carId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSent(true);
      setOpen(false);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  if (sent && !open) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        Email sent to {sellerEmail}.
        <button
          type="button"
          onClick={() => { setSent(false); setOpen(true); }}
          className="text-accent hover:underline font-medium"
        >
          Send another
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 rounded-xl border border-border px-4 text-xs font-semibold hover:bg-surface-2 transition-colors"
      >
        <Mail className="h-3.5 w-3.5" />
        Email seller
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        To <span className="text-foreground font-medium">{sellerName ? `${sellerName} · ` : ""}{sellerEmail}</span>
      </p>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full h-10 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        placeholder="Write your message to the seller…"
        className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent resize-y"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={sending || subject.trim().length < 3 || message.trim().length < 10}
          className="inline-flex items-center gap-2 h-9 rounded-xl bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {sending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</> : "Send email"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="h-9 rounded-xl border border-border px-4 text-xs font-semibold hover:bg-surface-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
