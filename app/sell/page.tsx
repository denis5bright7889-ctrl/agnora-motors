"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, TrendingUp, Clock, Shield, ArrowRight, Car, FileText, DollarSign, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SellPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative border-b border-border bg-surface/50 py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 grain pointer-events-none opacity-40" />
        <div className="container max-w-container relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent mb-4">
            <TrendingUp className="h-3.5 w-3.5" /> Kenya's fastest growing car marketplace
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-medium mb-4 max-w-2xl mx-auto">
            Sell your car <span className="italic text-accent">faster</span>, get a fair price
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto mb-8">
            List for free. Reach thousands of verified buyers across Kenya. We handle the inquiries so you don't have to.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dealer/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              List as a dealer <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#valuation"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface-2 px-7 text-sm font-medium hover:bg-surface transition-colors"
            >
              Get instant valuation
            </a>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-border bg-background">
        <div className="container max-w-container grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {[
            { value: "24K+", label: "Active listings" },
            { value: "48 hrs", label: "Avg. time to first inquiry" },
            { value: "Free", label: "Listing & messaging" },
            { value: "4,200+", label: "Cars sold this month" },
          ].map(({ value, label }) => (
            <div key={label} className="py-6 px-4 text-center">
              <p className="font-display text-2xl font-medium text-accent">{value}</p>
              <p className="text-xs text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sell paths */}
      <section className="py-20 px-4">
        <div className="container max-w-container">
          <h2 className="font-display text-3xl font-medium text-center mb-3">How would you like to sell?</h2>
          <p className="text-muted text-center mb-10 max-w-lg mx-auto">Choose the path that fits your situation. Both are free to list.</p>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <SellPathCard
              icon={Car}
              title="Private seller"
              description="List your own car. Buyers contact you directly. Great for individual vehicle sales with full control."
              features={["Free listing", "Direct buyer contact", "Manage your own schedule", "No dealer fees"]}
              cta="Create a private listing"
              href="/register"
              accent={false}
            />
            <SellPathCard
              icon={FileText}
              title="Become a dealer"
              description="Sell multiple cars under your business. Access a full dashboard, analytics, and bulk listing tools."
              features={["Unlimited listings", "Business dashboard", "Verified dealer badge", "Priority support"]}
              cta="Apply for dealer account"
              href="/dealer/register"
              accent={true}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-surface/50 border-y border-border">
        <div className="container max-w-container">
          <h2 className="font-display text-3xl font-medium text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { step: "1", icon: FileText, title: "Create your listing", desc: "Add photos, set your price, describe your car. Takes about 5 minutes." },
              { step: "2", icon: Shield, title: "We verify your details", desc: "Our team checks your listing for accuracy. Verified listings sell 3× faster." },
              { step: "3", icon: DollarSign, title: "Buyers contact you", desc: "Qualified buyers message or call you directly. No middleman, no markup." },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-accent-soft flex items-center justify-center">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">{step}</span>
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Valuation form */}
      <section id="valuation" className="py-20 px-4">
        <div className="container max-w-container max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl font-medium mb-2">Instant car valuation</h2>
            <p className="text-muted">Get a market estimate for your car in seconds. No signup required.</p>
          </div>
          <ValuationForm />
        </div>
      </section>

      {/* Finance section */}
      <section id="finance" className="py-20 px-4 bg-surface/50 border-y border-border">
        <div className="container max-w-container">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-4xl mx-auto">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">Car finance</span>
              <h2 className="font-display text-3xl font-medium mt-2 mb-4">Buying? Finance made easy.</h2>
              <p className="text-muted mb-6 leading-relaxed">
                We've partnered with leading banks and SACCOs to offer competitive auto loans. Get pre-approved in minutes and buy with confidence.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Interest rates from 12% p.a.",
                  "Financing for new and used cars",
                  "Up to 80% financing, 60-month terms",
                  "Fast approval — decision in 24 hours",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/cars"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground text-background text-sm font-medium px-6 hover:opacity-90 transition-opacity"
              >
                Browse cars to finance <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-3xl border border-border bg-surface p-6 space-y-4">
              <h3 className="font-semibold">Finance calculator</h3>
              <FinanceCalculator />
            </div>
          </div>
        </div>
      </section>

      {/* Trust / testimonials */}
      <section className="py-20 px-4">
        <div className="container max-w-container">
          <h2 className="font-display text-3xl font-medium text-center mb-10">What sellers say</h2>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: "Peter Kamau", location: "Nairobi", text: "Listed my Harrier on a Saturday and had 4 serious inquiries by Monday. Sold it within the week.", car: "2020 Toyota Harrier" },
              { name: "Aisha Mwangi", location: "Mombasa", text: "Better experience than the classifieds. Buyers come pre-qualified and the messaging is clean.", car: "2018 Mazda CX-5" },
              { name: "James Otieno", location: "Kisumu", text: "The valuation tool helped me price it right. First offer was within 5% of my asking price.", car: "2019 Toyota Fielder" },
            ].map(({ name, location, text, car }) => (
              <div key={name} className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-sm leading-relaxed text-muted mb-4">"{text}"</p>
                <div>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-muted">{location} · {car}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SellPathCard({
  icon: Icon, title, description, features, cta, href, accent,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  accent: boolean;
}) {
  return (
    <div className={cn(
      "rounded-3xl border p-6 flex flex-col",
      accent ? "border-accent/40 bg-accent-soft/30" : "border-border bg-surface"
    )}>
      <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center mb-4", accent ? "bg-accent text-white" : "bg-surface-2 text-accent")}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted mb-4 leading-relaxed">{description}</p>
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className={cn("h-4 w-4 shrink-0", accent ? "text-accent" : "text-accent")} />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={cn(
          "flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-opacity hover:opacity-90",
          accent ? "bg-accent text-white" : "bg-foreground text-background"
        )}
      >
        {cta}
      </Link>
    </div>
  );
}

function ValuationForm() {
  const makes = ["Toyota", "Nissan", "Mazda", "Subaru", "Honda", "BMW", "Mercedes-Benz", "Volkswagen", "Mitsubishi", "Ford", "Isuzu", "Land Rover"];
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("");
  const [result, setResult] = useState<{ low: number; high: number } | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => String(currentYear - i));

  function estimate() {
    if (!make || !year || !mileage) return;
    const base = 2500000;
    const ageFactor = Math.max(0.4, 1 - (currentYear - Number(year)) * 0.07);
    const mileageFactor = Math.max(0.6, 1 - (Number(mileage) / 300000) * 0.35);
    const condFactor = condition === "new" ? 1.1 : condition === "certified" ? 1.0 : 0.85;
    const mid = Math.round(base * ageFactor * mileageFactor * condFactor / 50000) * 50000;
    setResult({ low: Math.round(mid * 0.9), high: Math.round(mid * 1.1) });
  }

  const inputCls = "w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent";

  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl shadow-black/5 dark:shadow-black/30">
      <div className="space-y-3">
        <SelectField label="Make" value={make} onChange={setMake} options={makes} placeholder="Select make" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Harrier"
              className={inputCls}
              aria-label="Car model"
            />
          </div>
          <SelectField label="Year" value={year} onChange={setYear} options={years} placeholder="Select year" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Mileage (km)</label>
          <input
            type="number"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="e.g. 45000"
            className={inputCls}
            aria-label="Mileage in km"
          />
        </div>
        <SelectField
          label="Condition"
          value={condition}
          onChange={setCondition}
          options={["new", "certified", "used"]}
          labels={["New", "Certified Pre-Owned", "Used"]}
          placeholder="Select condition"
        />
        <button
          type="button"
          onClick={estimate}
          disabled={!make || !year || !mileage}
          className="w-full h-11 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Get estimate
        </button>

        {result && (
          <div className="rounded-2xl border border-accent/30 bg-accent-soft/30 p-4 text-center">
            <p className="text-xs text-muted mb-1">Estimated market value</p>
            <p className="text-2xl font-bold text-accent">
              KSh {result.low.toLocaleString()} – {result.high.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">Based on current Kenyan market data</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FinanceCalculator() {
  const [price, setPrice] = useState("2500000");
  const [deposit, setDeposit] = useState("500000");
  const [months, setMonths] = useState("48");
  const rate = 0.13;

  const principal = Math.max(0, Number(price) - Number(deposit));
  const monthlyRate = rate / 12;
  const n = Number(months);
  const monthly = n > 0 && principal > 0
    ? Math.round(principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1))
    : 0;

  const inputCls = "w-full h-10 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted mb-1">Car price (KSh)</label>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} aria-label="Car price" />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Deposit (KSh)</label>
        <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputCls} aria-label="Deposit amount" />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Term (months)</label>
        <select
          value={months}
          onChange={(e) => setMonths(e.target.value)}
          className={inputCls}
          aria-label="Loan term in months"
        >
          {[24, 36, 48, 60].map((m) => <option key={m} value={m}>{m} months</option>)}
        </select>
      </div>
      <div className="rounded-xl bg-surface-2 p-3 text-center">
        <p className="text-xs text-muted">Est. monthly payment</p>
        <p className="text-xl font-bold mt-0.5">KSh {monthly.toLocaleString()}</p>
        <p className="text-[10px] text-muted mt-1">Based on ~13% p.a. (indicative only)</p>
      </div>
      <Link
        href="/cars"
        className="flex h-10 items-center justify-center rounded-full border border-border text-xs font-medium hover:bg-surface-2 transition-colors"
      >
        Browse cars within this budget
      </Link>
    </div>
  );
}

function SelectField({
  label, value, onChange, options, labels, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: string[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent appearance-none"
          aria-label={label}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o, i) => <option key={o} value={o}>{labels?.[i] ?? o}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
      </div>
    </div>
  );
}
