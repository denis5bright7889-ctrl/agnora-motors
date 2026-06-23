"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Users, ShieldCheck, Store, User, Search, RefreshCw,
  AlertTriangle, ShieldOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  isActive?: boolean;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  strikeCount?: number;
  recentStrikeCount?: number;
  createdAt: string;
};

function strikeTooltip(recent: number, lifetime: number, suspendedReason: string | null | undefined): string {
  const parts = [
    `${recent} strike(s) in the rolling 30-day window`,
    `Lifetime total: ${lifetime}`,
  ];
  if (suspendedReason) parts.push(`Last reason: ${suspendedReason}`);
  return parts.join(". ") + ".";
}

const ROLE_STYLES: Record<string, string> = {
  admin:  "bg-accent-soft text-accent border-accent/20",
  dealer: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  buyer:  "bg-surface-2 text-muted border-border",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin:  ShieldCheck,
  dealer: Store,
  buyer:  User,
};

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json() as { users: UserRow[] };
      setUsers(data.users);
      setFiltered(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    let result = users;
    if (roleFilter !== "all") result = result.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name ?? "").toLowerCase().includes(q),
      );
    }
    setFiltered(result);
  }, [search, roleFilter, users]);

  async function changeRole(userId: string, newRole: string) {
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
        );
      }
    });
  }

  async function toggleSuspension(userId: string, suspend: boolean) {
    let reason: string | null = null;
    if (suspend) {
      reason = window.prompt("Reason for suspending this account (shown to them):", "");
      if (!reason?.trim()) return;
      reason = reason.trim();
    } else if (!confirm("Unsuspend this account? This also resets their strike counter.")) {
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, isActive: !suspend, reason }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? suspend
                ? { ...u, isActive: false, suspendedAt: new Date().toISOString(), suspendedReason: reason }
                : { ...u, isActive: true,  suspendedAt: null, suspendedReason: null, strikeCount: 0 }
              : u,
          ),
        );
      }
    });
  }

  const counts = {
    all:    users.length,
    admin:  users.filter((u) => u.role === "admin").length,
    dealer: users.filter((u) => u.role === "dealer").length,
    buyer:  users.filter((u) => u.role === "buyer").length,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Users</h1>
          <p className="text-sm text-muted mt-1">{users.length} registered accounts</p>
        </div>
        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 h-9 rounded-full border border-border bg-surface-2 px-4 text-sm font-medium hover:bg-surface transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "admin", "dealer", "buyer"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={cn(
              "flex items-center gap-1.5 h-8 rounded-full border px-3 text-xs font-medium capitalize transition-colors",
              roleFilter === r
                ? "bg-accent text-white border-accent"
                : "border-border bg-surface-2 text-muted hover:bg-surface hover:text-foreground",
            )}
          >
            {r === "all" ? <Users className="h-3 w-3" /> : null}
            {r === "admin" ? <ShieldCheck className="h-3 w-3" /> : null}
            {r === "dealer" ? <Store className="h-3 w-3" /> : null}
            {r === "buyer" ? <User className="h-3 w-3" /> : null}
            {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
            <span className="ml-0.5 opacity-70">
              {counts[r as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full h-10 rounded-xl border border-border bg-surface-2 pl-9 pr-4 text-sm outline-none focus:border-accent"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 rounded-full skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 skeleton rounded" />
                  <div className="h-3 w-48 skeleton rounded" />
                </div>
                <div className="h-6 w-16 skeleton rounded-full" />
                <div className="h-8 w-24 skeleton rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-8 w-8 text-muted/30 mb-3" />
            <p className="text-sm text-muted">
              {search || roleFilter !== "all" ? "No users match your filter." : "No users yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    User
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    Role
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted hidden sm:table-cell">
                    Joined
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    Change role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((user) => {
                  const RoleIcon = ROLE_ICONS[user.role] ?? User;
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-surface-2 transition-colors"
                    >
                      {/* Avatar + name/email + suspension state */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0 text-accent font-semibold text-sm">
                            {(user.name ?? user.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium truncate">
                                {user.name ?? <span className="text-muted italic">No name</span>}
                              </p>
                              {user.isActive === false && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">
                                  <ShieldOff className="h-2.5 w-2.5" /> Suspended
                                </span>
                              )}
                              {(user.recentStrikeCount ?? 0) > 0 && (
                                <span
                                  title={strikeTooltip(user.recentStrikeCount ?? 0, user.strikeCount ?? 0, user.suspendedReason)}
                                  className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-500"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {user.recentStrikeCount}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted truncate">{user.email}</p>
                            {user.suspendedReason && user.isActive === false && (
                              <p className="text-[10px] text-red-500 mt-0.5 truncate" title={user.suspendedReason}>
                                Reason: {user.suspendedReason}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role badge */}
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
                          ROLE_STYLES[user.role] ?? ROLE_STYLES.buyer,
                        )}>
                          <RoleIcon className="h-3 w-3" />
                          {user.role}
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-3.5 text-xs text-muted hidden sm:table-cell">
                        {new Date(user.createdAt).toLocaleDateString("en-KE", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </td>

                      {/* Role select + suspend toggle */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {user.isActive === false ? (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => toggleSuspension(user.id, false)}
                              className="h-8 inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 text-[11px] font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                            >
                              <ShieldCheck className="h-3 w-3" /> Unsuspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => toggleSuspension(user.id, true)}
                              className="h-8 inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 text-[11px] font-semibold text-orange-500 hover:bg-orange-500/25 transition-colors disabled:opacity-50"
                            >
                              <ShieldOff className="h-3 w-3" /> Suspend
                            </button>
                          )}
                          <select
                            defaultValue={user.role}
                            onChange={(e) => changeRole(user.id, e.target.value)}
                            disabled={isPending}
                            className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs outline-none focus:border-accent disabled:opacity-50 cursor-pointer"
                            aria-label={`Change role for ${user.email}`}
                          >
                            <option value="buyer">Buyer</option>
                            <option value="dealer">Dealer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted text-right">
          Showing {filtered.length} of {users.length} users
        </p>
      )}
    </div>
  );
}
