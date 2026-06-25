"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  ChevronLeft, Shield, Star, Phone, MessageCircle, Check, AlertTriangle,
  X, Fuel, Settings, MapPin, Calendar, Gauge, ChevronRight, Heart
} from "lucide-react";
import { formatPrice, formatMileage, formatDate, cn } from "@/lib/utils";
import { AiChatWidget } from "@/components/ai-chat-widget";
import { TrustActions } from "@/components/cars/trust-actions";
import type { Car as CarType } from "@/types";

export function CarDetail({ car, similar }: { car: CarType; similar: CarType[] }) {
  const [activeImg, setActiveImg] = useState(0);
  const [tab, setTab] = useState<"overview" | "specs" | "inspection">("overview");
  const [contactOpen, setContactOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const touchStartX = useRef<number>(0);

  // PR8: track the listing view once per mount. Trust signals + price tier
  // are sent so funnel analysis can see which kinds of listings convert.
  useEffect(() => {
    if (!car) return;
    trackEvent("listing_viewed", {
      carId:         car.id,
      slug:          car.slug,
      make:          car.make,
      model:         car.model,
      year:          car.year,
      price:         car.price,
      condition:     car.condition,
      verified:      car.verified,
      priceTier:     car.priceTier,
      sellerType:    car.sellerType,
      listingCounty: car.location,
    });
  }, [car]);

  // Funnel events. contact_form_open precedes lead_created; phone_reveal is a
  // separate intent signal (buyer chose to call instead of message).
  function openContact() {
    trackEvent("contact_form_open", {
      carId: car!.id, sellerType: car!.sellerType, source: "vehicle_page",
    });
    setContactOpen(true);
  }
  function revealPhone() {
    trackEvent("phone_reveal", { carId: car!.id, sellerType: car!.sellerType });
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) setActiveImg((i) => Math.min(car!.images.length - 1, i + 1));
    else            setActiveImg((i) => Math.max(0, i - 1));
  }

  const conditionLabel: Record<string, string> = { new: "New", used: "Used", certified: "Certified Pre-Owned", foreign_used: "Foreign Used", locally_used: "Locally Used" };
  const conditionText = conditionLabel[car!.condition] ?? car!.condition;
  const fuelLabel = { petrol: "Petrol", diesel: "Diesel", hybrid: "Hybrid", electric: "Electric" }[car!.fuel];

  return (
    <>
      {/* pb-28 on mobile = bottom-nav (56px) + contact-CTA (~68px) clearance
          pb-20 on tablet = contact-CTA only (no bottom nav at md+)           */}
      <div className="min-h-screen pb-28 md:pb-20 lg:pb-0">
        {/* Breadcrumb */}
        <div className="border-b border-border bg-surface/50">
          <div className="container max-w-container py-3 flex items-center gap-2 text-sm text-muted">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/cars" className="hover:text-foreground transition-colors">Buy</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground truncate">{car!.year} {car!.make} {car!.model}</span>
          </div>
        </div>

        <div className="container max-w-container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
            {/* Left column */}
            <div className="space-y-6">
              {/* Gallery */}
              <div className="space-y-3">
                <div
                  className="relative aspect-[16/10] rounded-3xl overflow-hidden bg-surface-2 cursor-grab active:cursor-grabbing"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    src={car!.images[activeImg]}
                    alt={`${car!.year} ${car!.make} ${car!.model}`}
                    className="h-full w-full object-cover transition-opacity duration-200"
                  />
                  {car!.verified && (
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-accent/90 backdrop-blur-sm px-3 py-1.5 text-white text-xs font-semibold">
                      <Shield className="h-3.5 w-3.5" /> Verified
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSaved((v) => !v)}
                    className={cn(
                      "absolute top-4 right-4 h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors",
                      saved ? "bg-red-500 text-white" : "bg-black/30 text-white hover:bg-black/50"
                    )}
                    aria-label={saved ? "Unsave listing" : "Save listing"}
                  >
                    <Heart className={cn("h-4 w-4", saved && "fill-current")} />
                  </button>

                  {/* Prev / Next arrows — visible on desktop, hidden on mobile (use swipe) */}
                  {car!.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous image"
                        onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                        className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm items-center justify-center text-white hover:bg-black/50 transition-colors disabled:opacity-30"
                        disabled={activeImg === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next image"
                        onClick={() => setActiveImg((i) => Math.min(car!.images.length - 1, i + 1))}
                        className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm items-center justify-center text-white hover:bg-black/50 transition-colors disabled:opacity-30"
                        disabled={activeImg === car!.images.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>

                      {/* Dot indicators — touch-friendly, always visible */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {car!.images.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={`View image ${i + 1}`}
                            onClick={() => setActiveImg(i)}
                            className={cn(
                              "rounded-full transition-all duration-200",
                              i === activeImg
                                ? "w-5 h-1.5 bg-white"
                                : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80",
                            )}
                          />
                        ))}
                      </div>

                      {/* Swipe hint — only shown on mobile, fades out */}
                      <div className="sm:hidden absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1 text-white text-[10px] pointer-events-none">
                        <ChevronLeft className="h-3 w-3" />
                        swipe
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </>
                  )}
                </div>
                {car!.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {car!.images.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`View image ${i + 1}`}
                        onClick={() => setActiveImg(i)}
                        className={cn(
                          "shrink-0 h-16 w-24 rounded-xl overflow-hidden ring-2 transition-all",
                          i === activeImg ? "ring-accent" : "ring-transparent opacity-60 hover:opacity-100"
                        )}
                      >
                        <img src={img} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & quick stats */}
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-medium">
                      {car!.year} {car!.make} {car!.model} {car!.trim}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{car!.location}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Listed {formatDate(car!.createdAt)}</span>
                      <span className="flex items-center gap-1">{car!.images.length} photo{car!.images.length === 1 ? "" : "s"}</span>
                    </div>
                    <TrustBadges car={car!} />
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                    car!.condition === "certified" ? "bg-accent-soft text-accent" :
                    car!.condition === "new" ? "bg-blue-500/15 text-blue-500" :
                    "bg-surface-2 text-muted"
                  )}>
                    {conditionText}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Gauge, label: "Mileage", value: formatMileage(car!.mileage) },
                    { icon: Fuel, label: "Fuel", value: fuelLabel },
                    { icon: Settings, label: "Transmission", value: car!.transmission === "auto" ? "Automatic" : "Manual" },
                    { icon: Calendar, label: "Year", value: String(car!.year) },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-2xl border border-border bg-surface p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                        <Icon className="h-3.5 w-3.5" />{label}
                      </div>
                      <p className="text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Quick-facts row — only the most scannable optional specs.
                    Hidden entirely when the seller hasn't filled any of them. */}
                <QuickFacts car={car!} />
              </div>

              {/* Tabs */}
              <div>
                <div className="flex gap-1 rounded-2xl bg-surface-2 p-1 w-full sm:w-fit">
                  {(["overview", "specs", "inspection"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={cn(
                        "flex-1 sm:flex-none rounded-xl px-4 py-2.5 text-sm font-medium capitalize transition-colors",
                        tab === t ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  {tab === "overview" && (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-2">Description</h2>
                        <p className="text-sm leading-relaxed text-muted">{car!.description}</p>
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">Features</h2>
                        <div className="flex flex-wrap gap-2">
                          {car!.features.map((f) => (
                            <span key={f} className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs">
                              <Check className="h-3 w-3 text-accent" />{f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === "specs" && (
                    <SpecsTable car={car!} fuelLabel={fuelLabel} conditionText={conditionText} />
                  )}

                  {tab === "inspection" && car!.inspection && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
                        <div className="text-center">
                          <p className="text-4xl font-bold text-accent">{car!.inspection.score}</p>
                          <p className="text-xs text-muted mt-1">/ 100</p>
                        </div>
                        <div>
                          <p className="font-semibold">Inspection Score</p>
                          <p className="text-sm text-muted mt-0.5">Agnora certified multi-point inspection</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border overflow-hidden">
                        {car!.inspection.items.map(({ label, status }, i) => (
                          <div key={label} className={cn("flex items-center justify-between px-4 py-3 text-sm", i % 2 === 0 ? "bg-surface" : "bg-surface/50")}>
                            <span>{label}</span>
                            <span className={cn(
                              "flex items-center gap-1.5 text-xs font-semibold",
                              status === "pass" ? "text-green-500" : status === "warn" ? "text-yellow-500" : "text-red-500"
                            )}>
                              {status === "pass" ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                              {status === "pass" ? "Pass" : status === "warn" ? "Advisory" : "Fail"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === "inspection" && !car!.inspection && (
                    <p className="text-sm text-muted">Inspection report not available for this vehicle.</p>
                  )}
                </div>
              </div>

              {/* Similar cars */}
              {similar.length > 0 && (
                <div>
                  <h2 className="font-display text-xl font-medium mb-4">Similar cars</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {similar.map((c) => (
                      <Link
                        key={c.id}
                        href={`/cars/${c.slug}`}
                        className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition-colors"
                      >
                        <div className="aspect-[4/3] overflow-hidden">
                          <img
                            src={c.images[0]}
                            alt={`${c.year} ${c.make} ${c.model}`}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold">{c.year} {c.make} {c.model}</p>
                          <p className="text-xs text-muted mt-0.5">{formatMileage(c.mileage)}</p>
                          <p className="text-sm font-bold text-accent mt-1">KSh {formatPrice(c.price)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sticky column */}
            <div className="lg:sticky lg:top-24 h-fit space-y-4">
              {/* Price card */}
              <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl shadow-black/5 dark:shadow-black/30">
                <p className="text-3xl font-bold">KSh {formatPrice(car!.price)}</p>
                <p className="text-sm text-muted mt-0.5">Negotiable · No hidden fees</p>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={openContact}
                    className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    <MessageCircle className="inline h-4 w-4 mr-2" />
                    Message dealer
                  </button>
                  <a
                    href={`tel:${car!.dealer.phone}`}
                    onClick={revealPhone}
                    className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface-2 text-sm font-medium hover:bg-surface transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    {car!.dealer.phone}
                  </a>
                </div>

                <p className="mt-4 text-center text-xs text-muted">
                  Response time typically under 2 hours
                </p>
              </div>

              {/* Dealer card */}
              <div className="rounded-3xl border border-border bg-surface p-5">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-accent-soft flex items-center justify-center text-accent font-bold text-lg shrink-0">
                    {car!.dealer.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{car!.dealer.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{car!.dealer.rating}</span>
                      <span className="text-xs text-muted">({car!.dealer.reviews} reviews)</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{car!.dealer.location}
                    </p>
                  </div>
                </div>
                <Link
                  href="/cars"
                  className="mt-4 block text-center text-xs text-accent hover:underline"
                >
                  See all listings from this dealer
                </Link>
                <TrustActions carId={car!.id} hasDealer={car!.sellerType === "dealer"} />
              </div>

              {/* Trust badges */}
              <div className="rounded-2xl bg-surface-2 p-4 space-y-2.5">
                {[
                  { icon: Shield, text: "Verified dealer & listing" },
                  { icon: Check, text: "No registration fees" },
                  { icon: MessageCircle, text: "Direct contact, no middleman" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-xs text-muted">
                    <Icon className="h-4 w-4 text-accent shrink-0" />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile price + contact CTA
          bottom-14 on mobile = clears the 56-px bottom nav
          bottom-0 on tablet  = no bottom nav, sit flush at screen bottom  */}
      <div className="lg:hidden fixed bottom-14 md:bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3 max-w-container mx-auto">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg leading-none">KSh {formatPrice(car!.price)}</p>
            <p className="text-xs text-muted mt-0.5 truncate">
              {car!.year} {car!.make} {car!.model}
            </p>
          </div>
          <a
            href={`tel:${car!.dealer.phone}`}
            onClick={revealPhone}
            className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 transition-colors hover:bg-surface"
            aria-label="Call dealer"
          >
            <Phone className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="shrink-0 h-11 rounded-full bg-accent text-white px-5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Message
          </button>
        </div>
      </div>

      {/* Contact modal */}
      {contactOpen && (
        <ContactModal car={car!} onClose={() => setContactOpen(false)} />
      )}

      {/* AI chat widget — floating assistant for this listing */}
      <AiChatWidget
        carDetails={{
          year: car!.year,
          make: car!.make,
          model: car!.model,
          trim: car!.trim,
          price: car!.price,
          mileage: car!.mileage,
          fuel: car!.fuel,
          transmission: car!.transmission,
          condition: car!.condition,
          bodyType: car!.bodyType,
          location: car!.location,
          description: car!.description,
          features: car!.features,
        }}
        sellerInfo={{
          name: car!.dealer.name,
          phone: car!.dealer.phone,
          location: car!.dealer.location,
          rating: car!.dealer.rating,
          reviews: car!.dealer.reviews,
        }}
      />
    </>
  );
}

// Single scannable line of the most decision-driving optional specs. Most
// buyers scan before they read — surfacing 3–5 numbers here saves them a
// click into the full SpecsTable. Renders nothing when no values are set.
function QuickFacts({ car }: { car: CarType }) {
  const s = car.specifications ?? {};
  const dtLabel: Record<string, string> = {
    fwd: "FWD", rwd: "RWD", awd: "AWD", "4wd": "4WD",
  };
  const bits: string[] = [];
  if (s.horsepower)      bits.push(`${s.horsepower} hp`);
  if (s.drivetrain)      bits.push(dtLabel[s.drivetrain] ?? s.drivetrain.toUpperCase());
  if (s.seats)           bits.push(`${s.seats} seats`);
  if (s.fuelEconomyKmL)  bits.push(`${s.fuelEconomyKmL} km/L`);
  else if (s.rangeKm)    bits.push(`${s.rangeKm.toLocaleString()} km range`);

  if (bits.length === 0) return null;

  return (
    <p className="mt-3 text-sm font-medium text-foreground">
      {bits.map((b, i) => (
        <span key={b}>
          {i > 0 && <span className="text-muted mx-2">·</span>}
          {b}
        </span>
      ))}
    </p>
  );
}

// Buyer-facing specifications panel. Groups always-present fields with the
// optional Specifications JSONB the seller may have filled in. Empty values
// are skipped so we never show "—" rows that look like a half-broken form.
function SpecsTable({
  car, fuelLabel, conditionText,
}: {
  car: CarType;
  fuelLabel: string;
  conditionText: string;
}) {
  const s = car.specifications ?? {};
  const drivetrainLabel: Record<NonNullable<CarType["drivetrain"]>, string> = {
    fwd: "Front-wheel drive (FWD)",
    rwd: "Rear-wheel drive (RWD)",
    awd: "All-wheel drive (AWD)",
    "4wd": "4-wheel drive (4WD)",
  };
  const upholsteryLabel: Record<string, string> = {
    cloth: "Cloth", leather: "Leather", leatherette: "Leatherette",
    alcantara: "Alcantara",
  };

  const groups: { title: string; rows: [string, string | undefined][] }[] = [
    {
      title: "Identity",
      rows: [
        ["Make",       car.make],
        ["Model",      car.model],
        ["Trim",       car.trim],
        ["Year",       String(car.year)],
        ["Body type",  car.bodyType],
        ["Condition",  conditionText],
        ["Location",   car.location],
      ],
    },
    {
      title: "Engine & drivetrain",
      rows: [
        ["Fuel type",        fuelLabel],
        ["Transmission",     car.transmission === "auto" ? "Automatic" : "Manual"],
        ["Drivetrain",       car.drivetrain ? drivetrainLabel[car.drivetrain] : undefined],
        ["Engine capacity",  s.engineCc ? `${s.engineCc.toLocaleString()} cc` : (car.engineSizeL ? `${car.engineSizeL} L` : undefined)],
        ["Horsepower",       s.horsepower ? `${s.horsepower} hp` : undefined],
        ["Torque",           s.torqueNm ? `${s.torqueNm} Nm` : undefined],
        ["Fuel economy",     s.fuelEconomyKmL ? `${s.fuelEconomyKmL} km/L` : undefined],
        ["Mileage",          formatMileage(car.mileage)],
      ],
    },
    {
      title: "Battery & range",
      rows: [
        ["Battery capacity", s.batteryCapacityKwh ? `${s.batteryCapacityKwh} kWh` : undefined],
        ["Range",            s.rangeKm ? `${s.rangeKm.toLocaleString()} km` : undefined],
        ["Charging time",    s.chargingTimeHours ? `${s.chargingTimeHours} hrs` : undefined],
      ],
    },
    {
      title: "Capacity",
      rows: [
        ["Seats",            s.seats ? String(s.seats) : undefined],
        ["Payload",          s.payloadKg ? `${s.payloadKg.toLocaleString()} kg` : undefined],
        ["Towing capacity",  s.towingCapacityKg ? `${s.towingCapacityKg.toLocaleString()} kg` : undefined],
      ],
    },
    {
      title: "Interior & exterior",
      rows: [
        ["Exterior colour", car.exteriorColor],
        ["Interior colour", car.interiorColor],
        ["Upholstery",      s.upholstery ? upholsteryLabel[s.upholstery] : undefined],
      ],
    },
    {
      title: "Ownership",
      rows: [
        ["Previous owners", car.previousOwners != null ? String(car.previousOwners) : undefined],
        ["VIN verified",    car.vinVerified ? "Yes" : undefined],
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const filled = g.rows.filter(([, v]) => v != null && v !== "");
        if (filled.length === 0) return null;
        return (
          <div key={g.title}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
              {g.title}
            </p>
            <div className="rounded-2xl border border-border overflow-hidden">
              {filled.map(([label, value], i) => (
                <div
                  key={label}
                  className={cn(
                    "grid grid-cols-2 px-4 py-3 text-sm",
                    i % 2 === 0 ? "bg-surface" : "bg-surface/50",
                  )}
                >
                  <span className="text-muted">{label}</span>
                  <span className="font-medium capitalize">{value}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContactModal({ car, onClose }: { car: any; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(`Hi, I'm interested in the ${car.year} ${car.make} ${car.model}. Is it still available?`);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Persist the enquiry as a lead in the dealer's CRM.
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: car.id, name, email, phone: phone || undefined, message,
          source: "vehicle_page",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Could not send your message. Please try again.");
        return;
      }
      // PR8: track contact-request creation. We do NOT log buyer PII (name,
      // email, phone) — only the car context.
      trackEvent("contact_request_created", {
        carId: car.id, make: car.make, model: car.model, year: car.year, price: car.price,
      });
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center hover:bg-surface transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {sent ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-500/15 flex items-center justify-center">
              <Check className="h-7 w-7 text-green-500" />
            </div>
            <h2 className="font-display text-xl font-medium">Message sent!</h2>
            <p className="text-sm text-muted mt-2">The dealer will contact you shortly via email or phone.</p>
            <button type="button" onClick={onClose} className="mt-6 h-11 w-full rounded-full bg-accent text-white text-sm font-semibold">
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-medium mb-1">Contact dealer</h2>
            <p className="text-sm text-muted mb-5">{car.year} {car.make} {car.model} · KSh {formatPrice(car.price)}</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent placeholder:text-muted"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent placeholder:text-muted"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number (optional)"
                className="w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent placeholder:text-muted"
              />
              <textarea
                required
                aria-label="Message"
                placeholder="Your message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent placeholder:text-muted resize-none"
              />
              {error && (
                <p className="text-sm text-red-500" role="alert">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// PR7: compact verification badge row. Each badge is render-only when the
// underlying flag is true — no badge = no claim. "Verified dealer" comes
// from the existing top-level `verified` flag; the rest from PR6 columns.
// Accident-history badge is honest: "Accident-free" only when explicitly
// declared 'none'; "minor repaired" / "major repaired" surface as amber
// indicators rather than being hidden.
function TrustBadges({ car }: { car: CarType }) {
  // accidentHistory needs a small derivation because we render *different*
  // labels with *different* tones depending on the value. tone "positive"
  // = emerald (good news); "neutral" = amber (honest disclosure).
  const accidentBadge =
    car.accidentHistory === "none"
      ? { label: "Accident-free",  icon: Check,          tone: "positive" }
      : car.accidentHistory === "minor_repaired"
      ? { label: "Minor repaired", icon: AlertTriangle,  tone: "neutral"  }
      : car.accidentHistory === "major_repaired"
      ? { label: "Major repaired", icon: AlertTriangle,  tone: "neutral"  }
      : null; // "unknown" / undefined → no badge (don't mislead with absence)

  const baseBadges = [
    { active: !!car.verified,                label: "Verified dealer",  icon: Shield, tone: "positive" },
    { active: !!car.vinVerified,             label: "VIN verified",     icon: Check,  tone: "positive" },
    { active: !!car.mileageVerified,         label: "Mileage verified", icon: Check,  tone: "positive" },
    { active: !!car.logbookVerified,         label: "Logbook verified", icon: Check,  tone: "positive" },
    { active: !!car.inspectionAvailable,     label: "Inspection ready", icon: Check,  tone: "positive" },
    { active: !!car.serviceHistoryAvailable, label: "Service history",  icon: Check,  tone: "positive" },
    { active: !!car.ownershipVerified,       label: "Ownership OK",     icon: Check,  tone: "positive" },
  ].filter((b) => b.active);

  const badges = accidentBadge ? [...baseBadges, { active: true, ...accidentBadge }] : baseBadges;
  if (badges.length === 0) return null;

  const toneClass = (tone: string) => tone === "positive"
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {badges.map(({ label, icon: Icon, tone }) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass(tone)}`}
        >
          <Icon className="h-3 w-3" />
          {label}
        </span>
      ))}
    </div>
  );
}

