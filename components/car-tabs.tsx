"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Car } from "@/types";

type Tab = "overview" | "specs" | "features" | "inspection" | "location";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "specs", label: "Specs" },
  { id: "features", label: "Features" },
  { id: "inspection", label: "Inspection" },
  { id: "location", label: "Location" },
];

export function CarTabs({ car }: { car: Car }) {
  const [active, setActive] = useState<Tab>("overview");

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border overflow-x-auto scroll-rail">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "shrink-0 h-10 px-4 text-sm font-medium border-b-2 transition-all",
              active === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {active === "overview" && (
          <div>
            <p className="text-sm text-muted leading-relaxed">{car.description}</p>
          </div>
        )}

        {active === "specs" && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Make", car.make],
              ["Model", car.model],
              ...(car.trim ? [["Trim", car.trim]] : []),
              ["Year", String(car.year)],
              ["Mileage", `${car.mileage.toLocaleString()} km`],
              ["Fuel", car.fuel],
              ["Transmission", car.transmission],
              ["Body type", car.bodyType],
              ["Condition", car.condition],
              ["Location", car.location],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-2 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted mb-0.5">{k}</dt>
                <dd className="font-medium capitalize">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {active === "features" && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {car.features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                {f}
              </li>
            ))}
          </ul>
        )}

        {active === "inspection" && car.inspection && (
          <div>
            <div className="mb-5 flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(var(--surface-2))" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="rgb(var(--accent))" strokeWidth="3"
                    strokeDasharray={`${car.inspection.score} ${100 - car.inspection.score}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="font-display text-xl font-semibold">{car.inspection.score}</span>
              </div>
              <div>
                <p className="font-semibold">Inspection score</p>
                <p className="text-sm text-muted">120-point check by Agnora partner</p>
              </div>
            </div>
            <ul className="space-y-2">
              {car.inspection.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5 text-sm">
                  <span>{item.label}</span>
                  {item.status === "pass" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {item.status === "warn" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  {item.status === "fail" && <XCircle className="h-4 w-4 text-red-500" />}
                </li>
              ))}
            </ul>
          </div>
        )}

        {active === "inspection" && !car.inspection && (
          <p className="text-sm text-muted">No inspection report available for this listing.</p>
        )}

        {active === "location" && (
          <div>
            <div className="flex items-start gap-3 mb-4">
              <MapPin className="h-5 w-5 shrink-0 text-accent mt-0.5" />
              <div>
                <p className="font-medium">{car.dealer.location}</p>
                <p className="text-sm text-muted">{car.dealer.name}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-surface-2 aspect-[16/9] flex items-center justify-center">
              <p className="text-sm text-muted">Map integration available with Google Maps API key</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}