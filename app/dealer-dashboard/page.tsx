import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DealerDashboardRedirect() {
  const session = await auth();
  if (!session) redirect("/login");
  // private_seller users hitting this URL get sent to their dashboard
  if (session.user.role === "private_seller") redirect("/private-dashboard");
  redirect("/dealer/dashboard");
}
