import "./globals.css";
import { Inter, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BottomNav } from "@/components/bottom-nav";
import { PwaRegister } from "@/components/pwa-register";
import type { Metadata, Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// ── PWA viewport — viewport-fit:cover enables iOS safe-area insets ──
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0a0a0b" },
  ],
};

export const metadata: Metadata = {
  title: "Agnora Motors — Kenya's verified car marketplace",
  description:
    "Buy and sell verified cars across Kenya. Thousands of listings from vetted dealers, fair pricing, and free messaging.",
  metadataBase: new URL("https://agnora-motors.com"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Agnora Motors",
    statusBarStyle: "black-translucent",
    startupImage: [],
  },
  openGraph: {
    title: "Agnora Motors",
    description: "Kenya's verified car marketplace",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg",     type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192",    type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512",    type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${serif.variable}`}>
      <body className="font-sans min-h-screen flex flex-col">
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <Navbar />
            {/* pb-14 md:pb-0: reserve space for the 56-px mobile bottom nav */}
            <main className="flex-1 pb-14 md:pb-0">{children}</main>
            <Footer />
            <BottomNav />
            <PwaRegister />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
