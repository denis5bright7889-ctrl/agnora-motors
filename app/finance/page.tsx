"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator, Building2, Users, ChevronRight, CheckCircle2,
  TrendingDown, Phone, ArrowRight, Banknote, Car,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";

export default function FinancePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative border-b border-border bg-surface/50 py-16 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 grain pointer-events-none opacity-30" />
        <div className="container max-w-container relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent mb-4">
            <Banknote className="h-3.5 w-3.5" /> Auto Finance Kenya
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-medium mb-4 max-w-2xl mx-auto">
            Finance your next car <span className="italic text-accent">the smart way</span>
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto mb-8">
            Compare loans, calculate payments, and find cars available for hire purchase — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#calculator" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              <Calculator className="h-4 w-4" /> Calculate payments
            </a>
            <a href="#lenders" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface-2 px-7 text-sm font-medium hover:bg-surface transition-colors">
              View lenders
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border">
        <div className="container max-w-container grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {[
            { value: "From 12%", label: "Interest rate p.a." },
            { value: "Up to 80%", label: "Financing available" },
            { value: "60 months", label: "Maximum loan term" },
            { value: "24 hrs",   label: "Typical approval time" },
          ].map(({ value, label }) => (
            <div key={label} className="py-6 px-4 text-center">
              <p className="font-display text-2xl font-medium text-accent">{value}</p>
              <p className="text-xs text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Finance Calculator */}
      <section id="calculator" className="py-20 px-4">
        <div className="container max-w-container max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-medium mb-2">Finance calculator</h2>
            <p className="text-muted">Uses the standard amortisation formula: M = P × [r(1+r)ⁿ] / [(1+r)ⁿ − 1]</p>
          </div>
          <FinanceCalculator />
        </div>
      </section>

      {/* Hire Purchase */}
      <section className="py-20 px-4 bg-surface/50 border-y border-border">
        <div className="container max-w-container">
          <div className="grid md:grid-cols-2 gap-12 items-start max-w-5xl mx-auto">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">Hire Purchase</span>
              <h2 className="font-display text-3xl font-medium mt-2 mb-4">Own it — pay as you go</h2>
              <p className="text-muted mb-6 leading-relaxed">
                Hire purchase lets you drive the car immediately while paying in instalments. Ownership transfers to you after the final payment — no bank required in many cases.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "No full upfront payment required",
                  "Fixed monthly instalments",
                  "Flexible deposit (typically 20–30%)",
                  "Ownership at end of term",
                  "Available on selected dealer vehicles",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/cars?hire_purchase=1"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground text-background text-sm font-medium px-6 hover:opacity-90 transition-opacity"
              >
                Browse hire purchase cars <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted">How hire purchase works</h3>
              {[
                { step: "1", title: "Choose your car", desc: "Find a car marked 'Hire Purchase Available' in our listings." },
                { step: "2", title: "Agree on deposit", desc: "Pay the agreed deposit (usually 20–30% of the car value)." },
                { step: "3", title: "Drive & pay monthly", desc: "Take the car home. Pay fixed monthly instalments to the dealer or finance partner." },
                { step: "4", title: "Own it", desc: "After the final payment, full ownership transfers to you." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
                  <div className="h-8 w-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {step}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-xs text-muted mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lenders */}
      <section id="lenders" className="py-20 px-4">
        <div className="container max-w-container">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-medium mb-2">Finance partners</h2>
            <p className="text-muted">Banks, SACCOs, and dealer finance options available in Kenya</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            <LenderSection
              icon={Building2}
              title="Banks"
              lenders={BANKS}
            />
            <LenderSection
              icon={Users}
              title="SACCOs"
              lenders={SACCOS}
            />
            <LenderSection
              icon={Car}
              title="Dealer Finance"
              lenders={DEALER_FINANCE}
            />
          </div>
        </div>
      </section>

      {/* Finance-eligible cars CTA */}
      <section className="py-16 px-4 bg-surface/50 border-y border-border">
        <div className="container max-w-container text-center max-w-2xl mx-auto">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
            <Banknote className="h-6 w-6 text-accent" />
          </div>
          <h2 className="font-display text-2xl font-medium mb-3">Browse finance-ready cars</h2>
          <p className="text-muted mb-6">
            These cars have been pre-approved for financing or hire purchase. Get behind the wheel faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cars?financing=1"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-white px-7 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Finance available <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/cars?hire_purchase=1"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface-2 px-7 text-sm font-medium hover:bg-surface transition-colors"
            >
              Hire purchase <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Finance News & Market Updates */}
      <FinanceNews />
    </div>
  );
}

// ── Finance News ─────────────────────────────────────────────

const FINANCE_ARTICLES = [
  {
    id: "1",
    category: "Market Update",
    categoryColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    title: "CBK holds base lending rate at 13% — what it means for car loans",
    excerpt:
      "The Central Bank of Kenya maintained its benchmark rate, keeping auto-loan interest rates steady for consumers seeking vehicle financing in 2025.",
    date: "May 2025",
    readTime: "3 min read",
  },
  {
    id: "2",
    category: "Buying Guide",
    categoryColor: "bg-green-500/15 text-green-600 dark:text-green-400",
    title: "Hire purchase vs. bank loan: which is cheaper for a used car in Kenya?",
    excerpt:
      "We compare the total cost of ownership across Kenya's most popular financing options — from dealer hire purchase to SACCO and commercial-bank loans.",
    date: "Apr 2025",
    readTime: "5 min read",
  },
  {
    id: "3",
    category: "Tips",
    categoryColor: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    title: "5 things lenders check before approving your car loan",
    excerpt:
      "Credit score, income-to-debt ratio, employment status — here's what Kenya's banks and SACCOs look at before saying yes to your auto-finance application.",
    date: "Apr 2025",
    readTime: "4 min read",
  },
  {
    id: "4",
    category: "Policy",
    categoryColor: "bg-purple-500/15 text-purple-500",
    title: "KRA duty changes on imported vehicles — updated 2025 guide",
    excerpt:
      "Kenya Revenue Authority revised excise duty bands on passenger vehicles. We break down exactly how much you'll pay on a 1,500 cc, 2,000 cc, or 2,500 cc import.",
    date: "Mar 2025",
    readTime: "6 min read",
  },
  {
    id: "5",
    category: "EV Finance",
    categoryColor: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    title: "Financing an electric vehicle in Kenya — banks that offer EV loans",
    excerpt:
      "As electric vehicles gain traction in Kenya, a growing number of banks now offer tailored EV finance products. We list the best deals and rates available today.",
    date: "Feb 2025",
    readTime: "4 min read",
  },
  {
    id: "6",
    category: "Market Update",
    categoryColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    title: "SACCO lending hits record high — cheaper auto loans for members",
    excerpt:
      "Kenya's cooperative sector reported its highest-ever vehicle-loan disbursement in Q1 2025, driven by lower rates and expanded credit limits for members.",
    date: "Jan 2025",
    readTime: "3 min read",
  },
];

function FinanceNews() {
  return (
    <section className="py-20 px-4">
      <div className="container max-w-container">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Finance news</p>
            <h2 className="font-display text-3xl font-medium">Market updates & guides</h2>
          </div>
          <Link
            href="/research"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            More research <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FINANCE_ARTICLES.map((article) => (
            <article
              key={article.id}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-5 hover:border-accent/40 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", article.categoryColor)}>
                  {article.category}
                </span>
                <span className="text-[10px] text-muted ml-auto">{article.date}</span>
              </div>
              <h3 className="font-semibold text-sm leading-snug mb-2 group-hover:text-accent transition-colors flex-1">
                {article.title}
              </h3>
              <p className="text-xs text-muted leading-relaxed line-clamp-3 mb-4">
                {article.excerpt}
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted mt-auto">
                <span>{article.readTime}</span>
                <span className="flex items-center gap-0.5 text-accent font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Read <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 sm:hidden text-center">
          <Link
            href="/research"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            More articles <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Finance Calculator ────────────────────────────────────────

function FinanceCalculator() {
  const [carPrice, setCarPrice]     = useState(3500000);
  const [depositPct, setDepositPct] = useState(20);
  const [rate, setRate]             = useState(13);
  const [months, setMonths]         = useState(48);

  const deposit   = Math.round(carPrice * depositPct / 100);
  const principal = Math.max(0, carPrice - deposit);
  const r         = rate / 100 / 12;          // monthly rate
  const n         = months;

  // M = P × [r(1+r)^n] / [(1+r)^n − 1]
  const monthly =
    r === 0
      ? Math.round(principal / n)
      : Math.round(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));

  const totalPayable = monthly * n + deposit;
  const totalInterest = totalPayable - carPrice;

  const inputCls = "w-full h-11 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent";

  return (
    <div className="rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-xl shadow-black/5 dark:shadow-black/30">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Car price (KSh)
            </label>
            <input
              type="number"
              value={carPrice}
              onChange={(e) => setCarPrice(Number(e.target.value))}
              className={inputCls}
              aria-label="Car price in KSh"
            />
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[1000000, 2000000, 3500000, 5000000, 8000000].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCarPrice(p)}
                  className={cn(
                    "h-6 rounded-full border px-2.5 text-[11px] font-medium transition-all",
                    carPrice === p ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-accent/50",
                  )}
                >
                  {formatPrice(p)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">Deposit</label>
              <span className="text-sm font-semibold text-accent">
                {depositPct}% — KSh {formatPrice(deposit)}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              step={5}
              value={depositPct}
              onChange={(e) => setDepositPct(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label="Deposit percentage"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>10%</span><span>50%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">Interest rate (p.a.)</label>
              <span className="text-sm font-semibold text-accent">{rate}%</span>
            </div>
            <input
              type="range"
              min={8}
              max={25}
              step={0.5}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label="Annual interest rate"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>8%</span><span>25%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">Loan term</label>
              <span className="text-sm font-semibold text-accent">{months} months</span>
            </div>
            <input
              type="range"
              min={12}
              max={60}
              step={6}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label="Loan term in months"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>12 mo</span><span>60 mo</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-accent/10 border border-accent/20 p-5 text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Monthly payment</p>
            <p className="font-display text-4xl font-bold text-accent">
              KSh {formatPrice(monthly)}
            </p>
            <p className="text-xs text-muted mt-1">for {months} months</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3">
            {[
              { label: "Car price",       value: `KSh ${formatPrice(carPrice)}` },
              { label: "Deposit (upfront)", value: `KSh ${formatPrice(deposit)}` },
              { label: "Loan amount",     value: `KSh ${formatPrice(principal)}` },
              { label: "Total interest",  value: `KSh ${formatPrice(Math.max(0, totalInterest))}` },
              { label: "Total payable",   value: `KSh ${formatPrice(totalPayable)}`, bold: true },
            ].map(({ label, value, bold }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-muted">{label}</span>
                <span className={cn("font-medium", bold && "font-bold text-foreground")}>{value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-accent" />
              <p className="text-xs font-semibold">Interest as % of loan</p>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round(totalInterest / principal * 100))}%` }}
              />
            </div>
            <p className="text-xs text-muted mt-1.5">
              {principal > 0 ? Math.round(totalInterest / principal * 100) : 0}% of loan amount paid as interest
            </p>
          </div>

          <p className="text-[10px] text-muted text-center">
            Indicative only. Actual rates depend on your lender and credit profile.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Lender data ───────────────────────────────────────────────

interface Lender {
  name: string;
  rate: string;
  maxLoan: string;
  contact: string;
  applyUrl?: string;
}

const BANKS: Lender[] = [
  { name: "Equity Bank",    rate: "13–16% p.a.", maxLoan: "80% of value", contact: "0763 000 000", applyUrl: "https://equitygroupholdings.com/ke/personal/loans/auto-loan/" },
  { name: "KCB Bank",       rate: "13–15% p.a.", maxLoan: "80% of value", contact: "0711 087 000", applyUrl: "https://ke.kcbgroup.com/personal/borrow/personal-loans" },
  { name: "Stanbic Bank",   rate: "14–17% p.a.", maxLoan: "75% of value", contact: "0703 085 000" },
  { name: "NCBA Bank",      rate: "14–16% p.a.", maxLoan: "75% of value", contact: "0711 056 444", applyUrl: "https://ke.ncbagroup.com/personal/loans/asset-finance/" },
  { name: "Absa Kenya",     rate: "15–18% p.a.", maxLoan: "70% of value", contact: "0709 116 000", applyUrl: "https://www.absa.co.ke/personal/borrow/vehicle-finance/" },
];

const SACCOS: Lender[] = [
  { name: "Stima SACCO",    rate: "12–14% p.a.", maxLoan: "3× savings",   contact: "0709 947 000" },
  { name: "Mwalimu SACCO",  rate: "12–13% p.a.", maxLoan: "3× savings",   contact: "0800 720 282" },
  { name: "Kenya Police SACCO", rate: "11–13% p.a.", maxLoan: "4× savings", contact: "0720 604 202" },
  { name: "Unaitas SACCO",  rate: "13–15% p.a.", maxLoan: "2.5× savings", contact: "0709 931 000" },
];

const DEALER_FINANCE: Lender[] = [
  { name: "CMC Motors",     rate: "14–16% p.a.", maxLoan: "75% of value", contact: "0709 904 000" },
  { name: "Toyota Kenya",   rate: "13–15% p.a.", maxLoan: "80% of value", contact: "0709 902 000" },
  { name: "CFAO Mobility",  rate: "14–17% p.a.", maxLoan: "70% of value", contact: "0709 123 000" },
];

function LenderSection({ icon: Icon, title, lenders }: { icon: React.ElementType; title: string; lenders: Lender[] }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="h-10 w-10 rounded-2xl bg-accent-soft flex items-center justify-center">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">
        {lenders.map((l) => (
          <div key={l.name} className="rounded-xl border border-border bg-surface-2 p-3.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-sm font-semibold">{l.name}</p>
              <span className="text-xs text-accent font-semibold shrink-0">{l.rate}</span>
            </div>
            <p className="text-xs text-muted mb-3">Max loan: {l.maxLoan}</p>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${l.contact.replace(/\s/g, "")}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border bg-surface text-xs font-medium hover:border-accent/50 hover:text-accent transition-colors"
              >
                <Phone className="h-3 w-3" /> Call
              </a>
              {l.applyUrl ? (
                <a
                  href={l.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Apply <ChevronRight className="h-3 w-3" />
                </a>
              ) : (
                <a
                  href={`tel:${l.contact.replace(/\s/g, "")}`}
                  className="flex-1 inline-flex items-center justify-center h-8 rounded-lg border border-border bg-surface text-xs font-medium text-muted hover:text-foreground transition-colors"
                >
                  {l.contact}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}