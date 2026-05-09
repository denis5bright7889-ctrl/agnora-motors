"use client";

import { useState } from "react";
import { Eye, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  targetName:  string;
  targetEmail: string;
  targetRole:  string;
}

export function ImpersonationBanner({ targetName, targetEmail, targetRole }: Props) {
  const router   = useRouter();
  const [exiting, setExiting] = useState(false);

  async function exitImpersonation() {
    setExiting(true);
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      router.push("/admin");
      router.refresh();
    } finally {
      setExiting(false);
    }
  }

  return (
    <div className="sticky top-0 z-[100] flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-amber-950">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Eye className="h-4 w-4 shrink-0" />
        Viewing as{" "}
        <span className="font-bold">{targetName || targetEmail}</span>
        <span className="hidden sm:inline font-normal opacity-80">
          &nbsp;·&nbsp;{targetEmail}&nbsp;·&nbsp;
          <span className="capitalize">{targetRole.replace(/_/g, " ")}</span>
        </span>
      </div>
      <button
        onClick={() => void exitImpersonation()}
        disabled={exiting}
        className="flex items-center gap-1.5 rounded-full bg-amber-950/20 hover:bg-amber-950/30 px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60"
      >
        {exiting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <X className="h-3.5 w-3.5" />}
        Exit
      </button>
    </div>
  );
}
