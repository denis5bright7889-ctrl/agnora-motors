import { ScanLine, Inbox, CheckCircle2, AlertCircle } from "lucide-react";
import { isDbConfigured } from "@/lib/db";
import {
  listCorrectionPatterns, getVinQualityStats, REVIEW_THRESHOLD,
  type CorrectionPattern, type VinQualityStats,
} from "@/lib/vin-corrections";
import { VinReviewTable } from "./review-table";

export const metadata = { title: "VIN Learning — Admin" };

const FIELD_LABELS: Record<string, string> = {
  engineCc: "Engine", transmission: "Transmission", fuel: "Fuel",
  bodyType: "Body type", model: "Model", trim: "Trim", drivetrain: "Drivetrain",
};

export default async function AdminVinPage() {
  let patterns: CorrectionPattern[] = [];
  let stats: VinQualityStats | null = null;
  if (isDbConfigured()) {
    [patterns, stats] = await Promise.all([
      listCorrectionPatterns("pending").catch(() => []),
      getVinQualityStats().catch(() => null),
    ]);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-medium flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-accent" /> VIN Learning
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Seller corrections aggregated by VIN prefix. Approve a pattern to apply it to future decodes.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi icon={Inbox} label="Pending patterns" value={stats.pending} />
          <Kpi icon={AlertCircle} label={`Ready to review (≥${REVIEW_THRESHOLD})`} value={stats.readyForReview} accent />
          <Kpi icon={CheckCircle2} label="Approved" value={stats.approved} />
          <Kpi icon={ScanLine} label="Total patterns" value={stats.totalPatterns} />
        </div>
      )}

      {stats && stats.topCorrectedFields.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-sm mb-3">Most-corrected fields</h2>
          <div className="flex flex-wrap gap-2">
            {stats.topCorrectedFields.map((f) => (
              <span key={f.field} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs">
                {FIELD_LABELS[f.field] ?? f.field} <span className="font-semibold text-muted">{f.count}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">
            Fields corrected most often point to where the decoder's rules need improvement for the Kenyan market.
          </p>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-3">Pending review</h2>
        <VinReviewTable initial={patterns} reviewThreshold={REVIEW_THRESHOLD} />
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: number; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <Icon className={`h-4 w-4 mb-2 ${accent ? "text-accent" : "text-muted"}`} />
      <p className="text-2xl font-semibold font-display">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}
