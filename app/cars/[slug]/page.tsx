"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { useState, use } from "react";
import {
  ChevronLeft, Shield, Star, Phone, MessageCircle, Check, AlertTriangle,
  X, Fuel, Settings, MapPin, Calendar, Gauge, ChevronRight, Heart
} from "lucide-react";
import { getCarBySlug, getSimilarCars } from "@/data/cars";
import { formatPrice, formatMileage, formatDate, cn } from "@/lib/utils";

export default function CarDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const car = getCarBySlug(slug);
  if (!car) notFound();

  const similar = getSimilarCars(car, 3);

  return <CarDetail car={car} similar={similar} />;
}

function CarDetail({ car, similar }: { car: ReturnType<typeof getCarBySlug> & object; similar: any[] }) {
  const [activeImg, setActiveImg] = useState(0);
  const [tab, setTab] = useState<"overview" | "specs" | "inspection">("overview");
  const [contactOpen, setContactOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const conditionLabel: Record<string, string> = { new: "New", used: "Used", certified: "Certified Pre-Owned", foreign_used: "Foreign Used", locally_used: "Locally Used" };
  const conditionText = conditionLabel[car!.condition] ?? car!.condition;
  const fuelLabel = { petrol: "Petrol", diesel: "Diesel", hybrid: "Hybrid", electric: "Electric" }[car!.fuel];

  return (
    <>
      <div className="min-h-screen">
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
                <div className="relative aspect-[16/10] rounded-3xl overflow-hidden bg-surface-2">
                  <img
                    src={car!.images[activeImg]}
                    alt={`${car!.year} ${car!.make} ${car!.model}`}
                    className="h-full w-full object-cover"
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
                  {car!.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous image"
                        onClick={() => setActiveImg((i) => Math.max(0, i - 1))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors disabled:opacity-30"
                        disabled={activeImg === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next image"
                        onClick={() => setActiveImg((i) => Math.min(car!.images.length - 1, i + 1))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors disabled:opacity-30"
                        disabled={activeImg === car!.images.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
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
                    </div>
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
              </div>

              {/* Tabs */}
              <div>
                <div className="flex gap-1 rounded-2xl bg-surface-2 p-1 w-fit">
                  {(["overview", "specs", "inspection"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={cn(
                        "rounded-xl px-4 py-2 text-sm font-medium capitalize transition-colors",
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
                    <div className="rounded-2xl border border-border overflow-hidden">
                      {[
                        ["Make", car!.make],
                        ["Model", car!.model],
                        ["Trim", car!.trim ?? "—"],
                        ["Year", String(car!.year)],
                        ["Body type", car!.bodyType],
                        ["Fuel type", fuelLabel],
                        ["Transmission", car!.transmission === "auto" ? "Automatic" : "Manual"],
                        ["Mileage", formatMileage(car!.mileage)],
                        ["Condition", conditionText],
                        ["Location", car!.location],
                      ].map(([label, value], i) => (
                        <div key={label} className={cn("grid grid-cols-2 px-4 py-3 text-sm", i % 2 === 0 ? "bg-surface" : "bg-surface/50")}>
                          <span className="text-muted">{label}</span>
                          <span className="font-medium capitalize">{value}</span>
                        </div>
                      ))}
                    </div>
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
                    onClick={() => setContactOpen(true)}
                    className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    <MessageCircle className="inline h-4 w-4 mr-2" />
                    Message dealer
                  </button>
                  <a
                    href={`tel:${car!.dealer.phone}`}
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

      {/* Contact modal */}
      {contactOpen && (
        <ContactModal car={car!} onClose={() => setContactOpen(false)} />
      )}
    </>
  );
}

function ContactModal({ car, onClose }: { car: any; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(`Hi, I'm interested in the ${car.year} ${car.make} ${car.model}. Is it still available?`);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
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
              <button
                type="submit"
                className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Send message
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

