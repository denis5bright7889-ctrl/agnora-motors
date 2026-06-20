import { redirect } from "next/navigation";

// Seller verification (Email → Phone → Documents → Review wizard) has
// been removed. Sellers can list a car with no account via the
// login-free posting form.
export default function SellerVerifyPage() {
  redirect("/sell/new");
}
