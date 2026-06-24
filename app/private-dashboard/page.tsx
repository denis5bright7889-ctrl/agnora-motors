import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Migrated to /dashboard/seller (Agnora V10000). Role-aware redirect keeps old
// links and bookmarks working. Sub-routes (/private-dashboard/settings, etc.)
// remain until they are migrated in a later phase.
export default async function PrivateDashboardLegacyRedirect() {
  const session = await auth();
  if (!session) redirect("/login");
  redirect(session.user.role === "dealer" ? "/dashboard/dealer" : "/dashboard/seller");
}
