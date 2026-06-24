import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Migrated to /dashboard/dealer (Agnora V10000). Kept as a role-aware redirect
// so old links / bookmarks keep working.
export default async function DealerDashboardLegacyRedirect() {
  const session = await auth();
  if (!session) redirect("/login");
  redirect(session.user.role === "private_seller" ? "/dashboard/seller" : "/dashboard/dealer");
}
