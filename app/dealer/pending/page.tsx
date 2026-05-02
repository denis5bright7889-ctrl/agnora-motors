import Link from "next/link";
import { Clock, ArrowLeft } from "lucide-react";

export default function DealerPendingPage() {
  return (
    <div className="grain flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/15">
          <Clock className="h-9 w-9 text-yellow-500" />
        </div>
        <h1 className="font-display text-3xl font-medium mb-3">
          Application under review
        </h1>
        <p className="text-muted mb-8 leading-relaxed">
          Your dealer application is being reviewed by the Agnora team.
          This typically takes{" "}
          <strong className="text-foreground">1–2 business days</strong>.
          You'll receive an email once a decision is made.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to homepage
        </Link>
      </div>
    </div>
  );
}
