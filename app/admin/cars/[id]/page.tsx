import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ImageOff } from "lucide-react";
import { getAdminCarDetail, getCarModerationHistory, listCarPhotos, isDbConfigured } from "@/lib/db";
import { formatPrice, formatMileage, cloudinaryThumb } from "@/lib/utils";
import type { CarStatus } from "@/types";
import { ModerationActions } from "../moderation-actions";
import { StatusBadge, SellerTypeBadge, VerificationBadge } from "../badges";
import { EmailSeller } from "./email-seller";
import { validateIdentifier } from "@/lib/vin-validate";
import { PhotoModeration } from "./photo-moderation";

export default async function AdminCarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDbConfigured()) notFound();

  const [car, history, photos] = await Promise.all([
    getAdminCarDetail(id),
    getCarModerationHistory(id),
    listCarPhotos(id),
  ]);
  if (!car) notFound();

  const title = `${car.year} ${car.make} ${car.model}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/admin/cars"
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All listings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={car.status as CarStatus} />
            <span className="text-xs text-muted font-mono">{car.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/cars/${car.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-border px-4 text-xs font-semibold hover:bg-surface-2 transition-colors"
          >
            View public page <ExternalLink className="h-3 w-3" />
          </Link>
          <ModerationActions carId={car.id} currentStatus={car.status as CarStatus} />
        </div>
      </div>

      {/* ── Seller ─────────────────────────────────────────────────────── */}
      <Section title="Seller">
        {car.sellerType === "login_free" && (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            This listing predates the account requirement, so it has no owning user
            record. Only the name and phone captured on the form are available.
          </p>
        )}
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row label="Name"  value={car.sellerName} />
          <Row label="Email" value={car.sellerEmail} mono />
          <Row label="Phone" value={car.sellerPhone} mono />
          <Row label="Account created" value={
            car.sellerJoinedAt
              ? new Date(car.sellerJoinedAt).toLocaleDateString("en-GB",
                  { day: "2-digit", month: "short", year: "numeric" })
              : null
          } />
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Seller type</dt>
            <dd><SellerTypeBadge type={car.sellerType} /></dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Verification</dt>
            <dd><VerificationBadge status={car.verificationStatus} /></dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-border pt-5">
          <EmailSeller
            carId={car.id}
            sellerEmail={car.sellerEmail}
            sellerName={car.sellerName}
            defaultSubject={`Regarding your ${car.make} ${car.model} listing — Agnora Motors`}
          />
        </div>
      </Section>

      {/* ── Vehicle ────────────────────────────────────────────────────── */}
      <Section title="Vehicle">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Year"         value={String(car.year)} />
          <Row label="Make"         value={car.make} />
          <Row label="Model"        value={car.model} />
          <Row label="Trim"         value={car.trim} />
          <Row label="Condition"    value={car.condition} capitalize />
          <Row label="VIN / chassis" value={car.vin} mono />
          <Row label="Mileage"      value={`${formatMileage(car.mileage)} km`} />
          <Row label="Fuel"         value={car.fuel} capitalize />
          <Row label="Transmission" value={car.transmission} capitalize />
          <Row label="Body type"    value={car.bodyType} capitalize />
          <Row label="Location"     value={car.location} />
          <Row label="Price"        value={`KSh ${formatPrice(car.price)}`} />
        </dl>

        <IdentifierPanel vin={car.vin} />

        {car.description && (
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Description</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{car.description}</p>
          </div>
        )}

        {car.specifications && Object.keys(car.specifications).length > 0 && (
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Technical specifications
            </p>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
              {Object.entries(car.specifications).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 text-sm">
                  <dt className="text-muted capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Section>

      {/* ── Photos ─────────────────────────────────────────────────────── */}
      <Section title={`Photos — ${car.photoCount}`}>
        {car.photoCount < 10 && (
          <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            Below the 10-photo publish bar. This listing is hidden from public search
            unless it was grandfathered by the quality-policy cutoff.
          </p>
        )}
        {photos.length > 0 ? (
          <PhotoModeration initialPhotos={photos} />
        ) : car.images.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <ImageOff className="h-4 w-4" /> No photos uploaded.
          </div>
        ) : (
          <>
            {/* Reached only when the car_photos migration has not been applied. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {car.images.map((src, i) => (
                <a
                  key={`${src}-${i}`}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block aspect-[4/3] overflow-hidden rounded-xl border border-border bg-surface-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cloudinaryThumb(src, 320, 240) ?? src}
                    alt={`${title} photo ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                      Primary
                    </span>
                  )}
                </a>
              ))}
            </div>
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              Per-photo moderation needs the car_photos migration
              (db/migrations/2026-09-16-car-photos.sql). Until it runs, photos are
              read from the legacy array and can only be managed as a whole.
            </p>
          </>
        )}
      </Section>

      {/* ── Moderation ─────────────────────────────────────────────────── */}
      <Section title="Moderation">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row label="Current status" value={car.status} capitalize />
          <Row label="Last moderated by" value={car.moderatedBy} mono />
          <Row label="Last moderated at" value={
            car.moderatedAt ? new Date(car.moderatedAt).toLocaleString("en-GB") : null
          } />
          <Row label="Reason" value={car.moderationReason} />
          <Row label="Listing created" value={new Date(car.createdAt).toLocaleString("en-GB")} />
          <Row label="Last updated"    value={new Date(car.updatedAt).toLocaleString("en-GB")} />
        </dl>

        <div className="mt-5 border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Audit trail
          </p>
          {history.length === 0 ? (
            <p className="text-sm text-muted">No recorded admin actions for this listing.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-medium">{h.action.replace(/_/g, " ")}</span>
                  <span className="text-muted">by {h.adminEmail}</span>
                  <span className="text-xs text-muted">
                    {new Date(h.createdAt).toLocaleString("en-GB")}
                  </span>
                  {typeof h.details?.reason === "string" && h.details.reason && (
                    <span className="w-full text-xs text-muted">Reason: {h.details.reason}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}

/**
 * Identifier validation evidence for the moderator.
 *
 * Shows what the validator concluded about the VIN or chassis number, so a
 * reviewer can see WHY a listing was queued rather than re-deriving it. A
 * chassis number is reported as a chassis number - not as a failed VIN.
 */
function IdentifierPanel({ vin }: { vin: string | null | undefined }) {
  if (!vin) {
    return (
      <div className="mt-5 border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Identifier check
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-400">
          No VIN or chassis number recorded. A listing cannot go live without one.
        </p>
      </div>
    );
  }

  const v = validateIdentifier(vin);

  const KIND_LABEL: Record<string, string> = {
    vin: "Standard 17-character VIN",
    jp_chassis: "Japanese chassis / frame number",
    unknown: "Unrecognised format",
  };

  const STATUS_TONE: Record<string, string> = {
    valid: "bg-green-500/15 text-green-600 dark:text-green-400",
    suspect: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    unrecognised: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    invalid: "bg-red-500/15 text-red-500",
  };

  const CHECK_DIGIT_LABEL: Record<string, string> = {
    pass: "Check digit valid",
    fail: "Check digit does not match",
    not_applicable: "No check digit (chassis numbers have none)",
  };

  return (
    <div className="mt-5 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
        Identifier check
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_TONE[v.status]}`}>
          {v.status}
        </span>
        <span className="text-sm">{KIND_LABEL[v.kind]}</span>
        {v.manufacturer && (
          <span className="text-sm text-muted">· {v.manufacturer}</span>
        )}
        {v.needsReview && (
          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            Needs manual verification
          </span>
        )}
      </div>

      <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Normalised</dt>
          <dd className="font-mono text-xs">{v.normalized}</dd>
        </div>
        {v.checkDigit && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Check digit</dt>
            <dd>{CHECK_DIGIT_LABEL[v.checkDigit]}</dd>
          </div>
        )}
      </dl>

      {v.message && (
        <p className="mt-2 text-sm leading-snug text-muted">{v.message}</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border p-5">
      <h2 className="font-display text-lg font-medium mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, mono, capitalize }: {
  label: string; value: string | null | undefined; mono?: boolean; capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">{label}</dt>
      <dd className={[
        "text-sm",
        mono && "font-mono text-xs",
        capitalize && "capitalize",
        !value && "text-muted",
      ].filter(Boolean).join(" ")}>
        {value || "—"}
      </dd>
    </div>
  );
}
