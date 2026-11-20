import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        background: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        foreground: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // Headings are Inter too, so the interface reads as ONE typographic
        // system. `font-display` is kept as a token rather than removed
        // because ~130 call sites use it: repointing it converts every
        // heading at once, instead of editing thirty files and inevitably
        // missing some.
        display: ["var(--font-inter)", "system-ui", "sans-serif"],
        // The serif survives for brand marks only — the Agnora wordmark and
        // the lettered brand chip. That is identity, not interface.
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      fontSize: {
        // Marketplace type scale. Sizes carry their own line-height so
        // headings stop inheriting body leading.
        "page-title":    ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em", fontWeight: "700" }],
        "section-title": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        "card-title":    ["1.0625rem", { lineHeight: "1.4rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        "price":         ["1.375rem", { lineHeight: "1.65rem", letterSpacing: "-0.02em", fontWeight: "700" }],
        "meta":          ["0.8125rem", { lineHeight: "1.125rem" }],
      },
      maxWidth: {
        container: "1280px",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "ticker": { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
        ticker: "ticker 60s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
