import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Users } from "lucide-react";
import { getDealerByUserId, isDbConfigured } from "@/lib/db";
import { getDealerLeads, listDealerTasks, type Lead, type DealerTask } from "@/lib/leads";
import { LeadCrm } from "@/components/dashboard/lead-crm";

export const metadata = { title: "Leads — Dealer Control Center" };

export default async function DealerLeadsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "private_seller") redirect("/dashboard/seller");
  if (session.user.role !== "dealer" && session.user.role !== "admin") redirect("/");

  let leads: Lead[] = [];
  let tasks: DealerTask[] = [];

  if (isDbConfigured() && session.user.role === "dealer") {
    const dealer = await getDealerByUserId(session.user.id);
    if (!dealer) redirect("/dealer/register");
    [leads, tasks] = await Promise.all([
      getDealerLeads(dealer.id),
      listDealerTasks(dealer.id),
    ]);
  }

  const won = leads.filter((l) => l.status === "won").length;
  const active = leads.filter((l) => !["won", "lost"].includes(l.status)).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Leads</h1>
        <p className="text-muted mt-0.5 text-sm">
          {leads.length} total · {active} active · {won} won
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-14 text-center">
          <Users className="h-10 w-10 text-muted mx-auto mb-3" />
          <p className="font-medium mb-1">No leads yet</p>
          <p className="text-sm text-muted max-w-sm mx-auto">
            When a buyer contacts you about a listing, they appear here. Move them through the
            pipeline, add notes, and set follow-up tasks.
          </p>
        </div>
      ) : (
        <LeadCrm initialLeads={leads} initialTasks={tasks} />
      )}
    </div>
  );
}
