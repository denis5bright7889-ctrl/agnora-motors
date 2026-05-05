import { auth } from "@/auth";
import { LayoutDashboard, Users, MessageSquare, Package, BarChart3 } from "lucide-react";

export default async function DealerDashboard() {
  const session = await auth();

  return (
    <div className="container max-w-container py-12">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 space-y-2">
          <div className="p-4 mb-6 surface-2 rounded-xl">
            <p className="text-xs uppercase tracking-widest text-muted font-bold mb-1">Current Plan</p>
            <p className="text-accent font-bold">Basic Dealer</p>
          </div>
          <nav className="space-y-1">
            <button className="flex items-center gap-3 w-full p-3 bg-accent/10 text-accent rounded-lg font-medium">
              <LayoutDashboard size={20} /> Overview
            </button>
            <button className="flex items-center gap-3 w-full p-3 hover:bg-surface-2 rounded-lg text-muted">
              <Package size={20} /> Inventory
            </button>
            <button className="flex items-center gap-3 w-full p-3 hover:bg-surface-2 rounded-lg text-muted">
              <MessageSquare size={20} /> Messages <span className="ml-auto bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">3</span>
            </button>
            <button className="flex items-center gap-3 w-full p-3 hover:bg-surface-2 rounded-lg text-muted">
              <BarChart3 size={20} /> Analytics
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <header className="mb-8">
            <h1 className="font-display text-4xl">Dealer Panel</h1>
            <p className="text-muted font-serif italic">Performance overview for {session?.user?.name}</p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Views", val: "12.4k", trend: "+12%" },
              { label: "Active Leads", val: "48", trend: "+5%" },
              { label: "Avg. Days to Sale", val: "14", trend: "-2" },
            ].map((stat, i) => (
              <div key={i} className="surface p-6 border rounded-xl">
                <p className="text-sm text-muted mb-1">{stat.label}</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold">{stat.val}</span>
                  <span className="text-xs text-green-500 font-medium mb-1">{stat.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}