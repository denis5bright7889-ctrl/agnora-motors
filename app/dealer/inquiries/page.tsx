import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MessageCircle, Mail, Phone, Car, Clock } from "lucide-react";
import {
  getDealerByUserId, getPrivateSellerByUserId,
  getInquiriesForDealer, getInquiriesForSeller,
  isDbConfigured,
} from "@/lib/db";
import type { Inquiry } from "@/lib/db";
import Link from "next/link";

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export default async function InquiriesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role;
  let inquiries: Inquiry[] = [];

  if (isDbConfigured()) {
    try {
      if (role === "dealer") {
        const dealer = await getDealerByUserId(session.user.id);
        if (!dealer) redirect("/dealer/register");
        if (dealer.status === "approved") {
          inquiries = await getInquiriesForDealer(dealer.id);
        }
      } else if (role === "private_seller") {
        const seller = await getPrivateSellerByUserId(session.user.id);
        if (!seller) redirect("/seller/register");
        inquiries = await getInquiriesForSeller(session.user.id);
      }
    } catch {
      // fall through with empty list
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-medium">Inquiries</h1>
        <p className="text-muted mt-1 text-sm">
          {inquiries.length > 0
            ? `${inquiries.length} buyer message${inquiries.length !== 1 ? "s" : ""}`
            : "No inquiries yet"}
        </p>
      </div>

      {inquiries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <MessageCircle className="h-10 w-10 text-muted mx-auto mb-3" />
          <p className="font-medium mb-1">No inquiries yet</p>
          <p className="text-sm text-muted max-w-xs mx-auto">
            When buyers contact you about a listing, their messages will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <InquiryCard key={inq.id} inquiry={inq} />
          ))}
        </div>
      )}

    </div>
  );
}

function InquiryCard({ inquiry: inq }: { inquiry: Inquiry }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 hover:border-accent/30 transition-colors">
      {/* Car row */}
      {(inq.carMake || inq.carModel) && (
        <div className="flex items-center gap-2">
          <Car className="h-3.5 w-3.5 text-muted shrink-0" />
          <span className="text-xs font-semibold text-muted">
            {inq.carYear && `${inq.carYear} `}{inq.carMake} {inq.carModel}
          </span>
          {inq.carSlug && (
            <Link
              href={`/cars/${inq.carSlug}`}
              className="ml-auto text-[10px] text-accent hover:underline shrink-0"
            >
              View listing
            </Link>
          )}
        </div>
      )}

      {/* Message */}
      <p className="text-sm leading-relaxed">{inq.message}</p>

      {/* Buyer info row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 border-t border-border">
        <span className="font-semibold text-sm">{inq.buyerName}</span>
        <a
          href={`mailto:${inq.buyerEmail}`}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
        >
          <Mail className="h-3 w-3" /> {inq.buyerEmail}
        </a>
        {inq.buyerPhone && (
          <a
            href={`tel:${inq.buyerPhone}`}
            className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
          >
            <Phone className="h-3 w-3" /> {inq.buyerPhone}
          </a>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted">
          <Clock className="h-3 w-3" /> {timeAgo(inq.createdAt)}
        </span>
      </div>
    </div>
  );
}
