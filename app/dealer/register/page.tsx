import { redirect } from "next/navigation";

// Dealer registration has been removed — anyone can list a car with no
// account via the login-free posting form. Any remaining links here are
// sent straight to it.
export default function DealerRegisterPage() {
  redirect("/sell/new");
}
