"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <h2 className="font-display text-xl font-medium mb-2">Something went wrong</h2>

      {/* Show the actual error message so it can be debugged */}
      <p className="text-sm text-muted mb-1 max-w-md">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted/60 font-mono mb-6">
          Error ID: {error.digest}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-2 h-10 rounded-full bg-accent px-6 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
