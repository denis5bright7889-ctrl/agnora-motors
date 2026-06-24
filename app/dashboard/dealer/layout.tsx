import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getDealerByUserId, getDealerAccountHealth, getSubscription, isDbConfigured,
} from "@/lib/db";
import { getPlan } from "@/lib/subscriptions";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

// Dealer Control Center — RBAC gate. Only approved/pending dealers (and
// admins, for support) reach the shell; everyone else is routed away.
export default async function DealerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role === "private_seller") redirect("/dashboard/seller");
  if (role !== "dealer" && role !== "admin") redirect("/");

  let name = session.user.name ?? "Dealer";
  let planId = "free";
  let suspended = false;

  if (isDbConfigured() && role === "dealer") {
    const dealer = await getDealerByUserId(session.user.id);
    if (!dealer) redirect("/dealer/register");
    if (dealer.status === "rejected") redirect("/dealer/rejected");
    name = dealer.businessName;

    const [sub, health] = await Promise.all([
      getSubscription(session.user.id),
      getDealerAccountHealth(dealer.id),
    ]);
    planId = sub?.plan ?? "free";
    suspended = health ? !health.isActive : false;
  }

  const plan = getPlan(planId);

  return (
    <DashboardShell
      variant="dealer"
      identity={{
        name,
        roleLabel: "Dealer",
        planId,
        planName: plan.name,
        suspended,
      }}
    >
      {children}
    </DashboardShell>
  );
}
