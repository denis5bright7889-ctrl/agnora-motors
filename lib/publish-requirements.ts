// The single definition of "is this listing fit to be public?".
//
// WHY THIS EXISTS
// Reinstating a listing used to be a bare status write: adminModerateCar set
// status = 'active' and nothing re-checked whether the listing still deserved
// to be public. So a listing suspended *because* it was deficient could be
// reinstated straight back into search while still deficient — and a listing
// created before a rule existed could be waved through by one click.
//
// enforcePublishQuality() in lib/db.ts already guarded the create path, but it
// throws, covers only photos and VIN, and reports one failure at a time. A
// moderator deciding whether to reinstate needs every reason at once, and
// needs them as data rather than an exception.

import { MIN_PUBLISH_PHOTOS, MIN_VIN_LEN, MAX_VIN_LEN } from "@/lib/quality-policy";
import { validateIdentifier } from "@/lib/vin-validate";
import { assessDescription } from "@/lib/description-quality";

export interface PublishCandidate {
  description?: string | null;
  vin?: string | null;
  /** Total photos attached to the listing. */
  photoCount: number;
  /**
   * Photos that have passed moderation. Null when per-photo records do not
   * exist for this listing (rows predating car_photos), in which case the
   * total is used instead — an older listing is not punished for a table
   * that did not exist when it was created.
   */
  approvedPhotoCount?: number | null;
}

export interface PublishCheck {
  ok: boolean;
  /** Every unmet requirement, in the order a seller would fix them. */
  failures: string[];
}

/**
 * Checks every publication requirement and reports all failures together.
 *
 * Pure and synchronous, so it can run inside request validation and be unit
 * tested without a database.
 */
export function checkPublishRequirements(candidate: PublishCandidate): PublishCheck {
  const failures: string[] = [];

  // --- Description -------------------------------------------------------
  const description = assessDescription(candidate.description);
  if (description.verdict === "reject") {
    failures.push(
      `The description does not pass quality checks: ${description.reasons[0] ?? "it does not read as a genuine description."}`,
    );
  } else if (description.verdict === "review") {
    failures.push(
      "The description has not been accepted yet — it scored " +
      `${description.score}/100 and is awaiting review.`,
    );
  }

  // --- Photographs -------------------------------------------------------
  if (candidate.photoCount < MIN_PUBLISH_PHOTOS) {
    failures.push(
      `Published listings need at least ${MIN_PUBLISH_PHOTOS} photos; this one has ${candidate.photoCount}.`,
    );
  } else if (
    candidate.approvedPhotoCount != null &&
    candidate.approvedPhotoCount < MIN_PUBLISH_PHOTOS
  ) {
    // The listing has enough photos, but not enough that a moderator has
    // cleared. Publishing on the raw count would put unreviewed images live.
    failures.push(
      `Only ${candidate.approvedPhotoCount} of ${candidate.photoCount} photos have passed moderation; ` +
      `${MIN_PUBLISH_PHOTOS} are required.`,
    );
  }

  // --- VIN / chassis -----------------------------------------------------
  const vin = (candidate.vin ?? "").trim();
  if (vin.length < MIN_VIN_LEN || vin.length > MAX_VIN_LEN) {
    failures.push(
      `A VIN or chassis number between ${MIN_VIN_LEN} and ${MAX_VIN_LEN} characters is required; ` +
      `this listing has ${vin.length ? `${vin.length} characters` : "none"}.`,
    );
  } else {
    const identifier = validateIdentifier(vin);
    if (!identifier.acceptable) {
      failures.push(
        `The VIN or chassis number is not valid: ${identifier.message ?? "it is structurally incorrect."}`,
      );
    }
  }

  return { ok: failures.length === 0, failures };
}

/** One sentence explaining a refusal, for an API response. */
export function explainRefusal(check: PublishCheck): string {
  return check.failures.length === 1
    ? check.failures[0]
    : `This listing cannot be published yet: ${check.failures.join(" ")}`;
}
