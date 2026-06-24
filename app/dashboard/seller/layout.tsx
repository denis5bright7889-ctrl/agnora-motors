import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getPrivateSellerByUserId, getSubscription, isDbConfigured,
} from "@/lib/db";
import { getPlan } from "@/lib/subscriptions";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

// Private Seller dashboard — RBAC gate. Simple, trust-focused experience.
export default async function SellerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role === "dealer") redirect("/dashboard/dealer");
  if (role !== "private_seller" && role !== "admin") redirect("/");

  let planId = "free";

  if (isDbConfigured() && role === "private_seller") {
    const seller = await getPrivateSellerByUserId(session.user.id);
    if (!seller) redirect("/seller/register");
    const sub = await getSubscription(session.user.id);
    planId = sub?.plan ?? "free";
  }

  const plan = getPlan(planId);

  return (
    <DashboardShell
      variant="seller"
      identity={{
        name: session.user.name ?? "Private Seller",
        roleLabel: "Private seller",
        planId,
        planName: plan.name,
      }}
    >
      {children}
    </DashboardShell>
  );
}
