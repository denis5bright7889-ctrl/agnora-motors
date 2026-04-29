"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function ThemeToggle({ className }: Props) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function toggle() {
    document.documentElement.classList.add("theme-transition");
    setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark");
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 220);
  }

  const isDark = mounted && (resolvedTheme ?? theme) === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className={cn(
        "h-10 w-10 inline-flex items-center justify-center rounded-full",
        "bg-surface-2 hover:bg-surface text-foreground border border-border",
        "transition-colors",
        className,
      )}
    >
      <span className="sr-only">Toggle theme</span>
      {/* render both icons; swap visibility to avoid hydration mismatch */}
      <Sun className={cn("h-4 w-4", mounted && isDark ? "block" : "hidden")} aria-hidden />
      <Moon className={cn("h-4 w-4", mounted && !isDark ? "block" : "hidden")} aria-hidden />
      {!mounted && <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
