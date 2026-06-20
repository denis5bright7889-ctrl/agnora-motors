import { redirect } from "next/navigation";

// Seller registration has been removed — anyone can list a car with no
// account via the login-free posting form. Any remaining links here are
// sent straight to it.
export default function SellerRegisterPage() {
  redirect("/sell/new");
}
