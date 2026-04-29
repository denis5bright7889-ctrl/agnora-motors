import Link from "next/link";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "Used cars", href: "/cars?condition=used" },
      { label: "New cars", href: "/cars?condition=new" },
      { label: "Certified pre-owned", href: "/cars?condition=certified" },
      { label: "SUVs & crossovers", href: "/cars?body=suv" },
      { label: "Pickups", href: "/cars?body=pickup" },
      { label: "Hybrids", href: "/cars?fuel=hybrid" },
    ],
  },
  {
    title: "Sell",
    links: [
      { label: "Post your car", href: "/sell" },
      { label: "Get a valuation", href: "/sell#valuation" },
      { label: "How selling works", href: "/sell#how" },
      { label: "Become a dealer", href: "/sell#dealer" },
    ],
  },
  {
    title: "Research",
    links: [
      { label: "Reviews & articles", href: "/research" },
      { label: "Buying guides", href: "/research?category=Buying+Guide" },
      { label: "Ownership tips", href: "/research?category=Ownership" },
      { label: "Browse by brand", href: "/#brands" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Agnora", href: "#" },
      { label: "Contact us", href: "#" },
      { label: "Help center", href: "#" },
      { label: "Careers", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-20">
      <div className="container max-w-container py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link href="/" className="flex items-center gap-2 font-display text-2xl tracking-tight">
              <span className="h-3 w-3 rounded-full bg-accent" aria-hidden />
              <span className="font-medium">Agnora<span className="text-accent">.</span></span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted">
              Kenya's easiest way to buy and sell cars. Thousands of listings from verified dealers across the country.
            </p>
            <form className="mt-6 flex max-w-sm gap-2">
              <label htmlFor="newsletter" className="sr-only">Email address</label>
              <input
                id="newsletter"
                type="email"
                placeholder="you@email.co.ke"
                className="flex-1 h-11 rounded-full border border-border bg-background px-4 text-sm placeholder:text-muted"
              />
              <button
                type="button"
                className="h-11 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Subscribe
              </button>
            </form>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="md:col-span-2">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
                {col.title}
              </h4>
              <ul className="space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-foreground/80 hover:text-foreground transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <div className="font-medium tracking-widest uppercase">© 2026 Agnora Motors · All rights reserved</div>
          <div className="flex gap-5">
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="#" className="hover:text-foreground">Terms</Link>
            <Link href="#" className="hover:text-foreground">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
