"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Phone, Mail, Car, Clock, Plus, Check, Trash2, Loader2,
  MessageSquare, Activity as ActivityIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LEAD_STAGES, LEAD_STAGE_LABELS, type Lead, type LeadStage,
  type LeadActivity, type DealerTask,
} from "@/lib/leads";

// Stage accent colours for column headers + cards.
const STAGE_TONE: Record<LeadStage, string> = {
  new:         "text-blue-500 border-blue-500/30",
  contacted:   "text-indigo-500 border-indigo-500/30",
  negotiating: "text-amber-500 border-amber-500/30",
  test_drive:  "text-purple-500 border-purple-500/30",
  offer:       "text-orange-500 border-orange-500/30",
  won:         "text-green-500 border-green-500/30",
  lost:        "text-muted border-border",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}

export function LeadCrm({
  initialLeads,
  initialTasks,
}: {
  initialLeads: Lead[];
  initialTasks: DealerTask[];
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [tasks, setTasks] = useState<DealerTask[]>(initialTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  function patchLead(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  return (
    <div className="space-y-6">
      {/* Pipeline board */}
      <div className="flex gap-4 overflow-x-auto scroll-rail pb-2">
        {LEAD_STAGES.map((stage) => {
          const inStage = leads.filter((l) => l.status === stage);
          return (
            <div key={stage} className="w-64 shrink-0">
              <div className={cn(
                "flex items-center justify-between rounded-xl border bg-surface px-3 py-2 mb-2",
                STAGE_TONE[stage],
              )}>
                <span className="text-xs font-bold uppercase tracking-wider">{LEAD_STAGE_LABELS[stage]}</span>
                <span className="text-xs font-semibold text-muted">{inStage.length}</span>
              </div>
              <div className="space-y-2">
                {inStage.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className="w-full text-left rounded-xl border border-border bg-surface p-3 hover:border-accent/40 transition-colors"
                  >
                    <p className="font-medium text-sm truncate">{lead.buyerName}</p>
                    {lead.carMake && (
                      <p className="text-xs text-muted truncate flex items-center gap-1 mt-0.5">
                        <Car className="h-3 w-3 shrink-0" /> {lead.carYear} {lead.carMake} {lead.carModel}
                      </p>
                    )}
                    <p className="text-[10px] text-muted mt-1.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> {timeAgo(lead.createdAt)}
                    </p>
                  </button>
                ))}
                {inStage.length === 0 && (
                  <p className="text-xs text-muted/60 px-3 py-4 text-center border border-dashed border-border rounded-xl">
                    No leads
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tasks */}
      <TasksPanel tasks={tasks} setTasks={setTasks} />

      {/* Lead detail slide-over */}
      {selected && (
        <LeadDetail
          lead={selected}
          onClose={() => setSelectedId(null)}
          onPatch={patchLead}
          onTaskAdded={(t) => setTasks((prev) => [t, ...prev])}
        />
      )}
    </div>
  );
}

// ── Lead detail ──────────────────────────────────────────────

function LeadDetail({
  lead, onClose, onPatch, onTaskAdded,
}: {
  lead: Lead;
  onClose: () => void;
  onPatch: (l: Lead) => void;
  onTaskAdded: (t: DealerTask) => void;
}) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [activity, setActivity] = useState<LeadActivity[] | null>(null);
  const [taskTitle, setTaskTitle] = useState("");

  const loadActivity = useCallback(async () => {
    const res = await fetch(`/api/dealer/leads/${lead.id}`);
    if (res.ok) {
      const json = await res.json();
      setActivity(json.activity ?? []);
    }
  }, [lead.id]);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  async function changeStatus(status: LeadStage) {
    if (status === lead.status) return;
    setBusyStatus(true);
    const res = await fetch(`/api/dealer/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const json = await res.json();
      onPatch(json.lead);
      void loadActivity();
    }
    setBusyStatus(false);
  }

  async function saveNotes() {
    setSavingNotes(true);
    const res = await fetch(`/api/dealer/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) {
      const json = await res.json();
      onPatch(json.lead);
      void loadActivity();
    }
    setSavingNotes(false);
  }

  async function addTask() {
    const title = taskTitle.trim();
    if (!title) return;
    const res = await fetch("/api/dealer/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, leadId: lead.id }),
    });
    if (res.ok) {
      const json = await res.json();
      onTaskAdded(json.task);
      setTaskTitle("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md h-full overflow-y-auto bg-background border-l border-border shadow-2xl">
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{lead.buyerName}</h2>
            <p className="text-xs text-muted">Lead · {timeAgo(lead.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close panel" className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface-2 text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Contact */}
          <div className="space-y-2">
            {lead.buyerPhone && (
              <a href={`tel:${lead.buyerPhone}`} className="flex items-center gap-2 text-sm hover:text-accent transition-colors">
                <Phone className="h-4 w-4 text-muted" /> {lead.buyerPhone}
              </a>
            )}
            <a href={`mailto:${lead.buyerEmail}`} className="flex items-center gap-2 text-sm hover:text-accent transition-colors">
              <Mail className="h-4 w-4 text-muted" /> {lead.buyerEmail}
            </a>
            {lead.carMake && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Car className="h-4 w-4" /> {lead.carYear} {lead.carMake} {lead.carModel}
              </p>
            )}
            <p className="text-xs text-muted">Source: {lead.source}</p>
          </div>

          {/* Message */}
          {lead.message && (
            <div className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="text-xs font-semibold text-muted mb-1 flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> Buyer message
              </p>
              {lead.message}
            </div>
          )}

          {/* Stage */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Pipeline stage</p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busyStatus}
                  onClick={() => changeStatus(s)}
                  className={cn(
                    "h-7 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50",
                    lead.status === s
                      ? "border-accent bg-accent text-white"
                      : "border-border hover:border-accent/50",
                  )}
                >
                  {LEAD_STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add private notes about this buyer…"
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent resize-none"
            />
            <button
              type="button"
              onClick={saveNotes}
              disabled={savingNotes || notes === (lead.notes ?? "")}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground text-background px-4 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save notes
            </button>
          </div>

          {/* Add task */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Add follow-up task</p>
            <div className="flex gap-2">
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addTask(); } }}
                placeholder="e.g. Call about test drive"
                className="flex-1 h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent"
              />
              <button type="button" onClick={addTask} aria-label="Add task" className="h-9 w-9 flex items-center justify-center rounded-xl bg-accent text-white hover:opacity-90">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Activity */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
              <ActivityIcon className="h-3 w-3" /> Activity
            </p>
            <ul className="space-y-2.5">
              {(activity ?? []).map((a) => (
                <li key={a.id} className="flex gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  <span className="text-muted">
                    <span className="text-foreground font-medium">{activityLabel(a)}</span>
                    {" · "}{timeAgo(a.createdAt)}
                  </span>
                </li>
              ))}
              {activity !== null && activity.length === 0 && (
                <li className="text-xs text-muted">No activity yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function activityLabel(a: LeadActivity): string {
  switch (a.type) {
    case "created":        return "Lead created";
    case "status_changed": return `Moved to ${LEAD_STAGE_LABELS[a.detail.to as LeadStage] ?? a.detail.to}`;
    case "note_added":     return "Note updated";
    case "task_added":     return `Task: ${a.detail.title ?? "added"}`;
    case "contacted":      return "Marked contacted";
    default:               return a.type;
  }
}

// ── Tasks panel ──────────────────────────────────────────────

function TasksPanel({
  tasks, setTasks,
}: {
  tasks: DealerTask[];
  setTasks: React.Dispatch<React.SetStateAction<DealerTask[]>>;
}) {
  const [title, setTitle] = useState("");

  async function add() {
    const t = title.trim();
    if (!t) return;
    const res = await fetch("/api/dealer/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    });
    if (res.ok) {
      const json = await res.json();
      setTasks((prev) => [json.task, ...prev]);
      setTitle("");
    }
  }

  async function toggle(task: DealerTask) {
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)));
    await fetch(`/api/dealer/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
  }

  async function remove(id: string) {
    setTasks((prev) => prev.filter((x) => x.id !== id));
    await fetch(`/api/dealer/tasks/${id}`, { method: "DELETE" });
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">Tasks</h2>
        <span className="text-xs text-muted">{open.length} open</span>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
          placeholder="Add a task — e.g. Follow up on Prado buyer"
          className="flex-1 h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent"
        />
        <button type="button" onClick={add} className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-semibold hover:opacity-90 inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted text-center py-4">No tasks yet. Add follow-ups to stay on top of buyers.</p>
      ) : (
        <ul className="space-y-1.5">
          {[...open, ...done].map((task) => (
            <li key={task.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2 group">
              <button
                type="button"
                onClick={() => toggle(task)}
                aria-label={task.done ? "Mark not done" : "Mark done"}
                className={cn(
                  "h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors",
                  task.done ? "bg-accent border-accent text-white" : "border-border hover:border-accent",
                )}
              >
                {task.done && <Check className="h-3 w-3" />}
              </button>
              <span className={cn("flex-1 text-sm", task.done && "line-through text-muted")}>{task.title}</span>
              <button
                type="button"
                onClick={() => remove(task.id)}
                aria-label="Delete task"
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
