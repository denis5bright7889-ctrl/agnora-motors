import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cloudinary } from "@/lib/cloudinary";
import { sniffImageType } from "@/lib/image-type";
import { classifyVehicleImage, decidePhoto } from "@/lib/vehicle-classifier";
import { assessImageQuality } from "@/lib/image-quality";
import { recordUploadClassification } from "@/lib/db";

export const runtime = "nodejs";

// Every upload requires a signed-in user. There is no anonymous path: the
// folder is chosen from this fixed set so a caller can never write to an
// arbitrary location in the Cloudinary account.
const ALLOWED_FOLDERS = new Set(["agnora", "agnora/cars", "agnora/docs", "agnora/avatars"]);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in to upload photos.", code: "unauthenticated" },
        { status: 401 },
      );
    }

    const formData = await req.formData();
    const file   = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string | null) ?? "agnora";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: "Invalid upload destination" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image must be ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB or less` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = sniffImageType(buffer);
    if (!detectedType) {
      return NextResponse.json(
        { error: "That file isn't a supported image (JPEG, PNG, WebP, GIF, HEIC or AVIF)." },
        { status: 400 },
      );
    }

    const isVehiclePhoto = folder === "agnora/cars";

    // ── Gate 1: is this a usable photograph at all? ─────────────────────────
    // Runs for every folder: a corrupt or blank file is useless as a dealer
    // document or an avatar too. This answers only "is the image any good?" —
    // whether it shows a car is a separate question, decided below.
    const quality = await assessImageQuality(buffer);

    if (quality.isCorrupt) {
      return NextResponse.json(
        {
          error: "That image file is damaged or incomplete. Please re-save it and try again.",
          code: "corrupt_image",
        },
        { status: 400 },
      );
    }
    if (quality.isBlank) {
      return NextResponse.json(
        {
          error: quality.reasons[0] ?? "That image appears to be blank.",
          code: "blank_image",
          recommendation: quality.recommendation,
        },
        { status: 422 },
      );
    }
    // Resolution floor and an unusable score only gate actual vehicle photos.
    // A scan of a logbook is legitimately low-contrast and is not held to the
    // standard a buyer-facing car photo is.
    if (isVehiclePhoto && quality.verdict === "reject") {
      return NextResponse.json(
        {
          error: quality.reasons[0] ?? "That photo isn't clear enough to publish.",
          code: "low_quality",
          qualityScore: quality.score,
          reasons: quality.reasons,
          recommendation: quality.recommendation,
        },
        { status: 422 },
      );
    }

    // ── Gate 2: does it actually show a vehicle? ────────────────────────────
    // Decided from the bytes here on the server; the filename and the
    // client-declared type are both ignored. Other folders (dealer docs,
    // avatars) are not vehicle photos, so they skip classification entirely.
    const classification = isVehiclePhoto
      ? await classifyVehicleImage(buffer, detectedType)
      : { label: "unchecked" as const, score: null, provider: "none" };
    const decision = decidePhoto(classification);

    if (decision.action === "reject") {
      return NextResponse.json(
        { error: decision.message, code: "not_a_vehicle" },
        { status: 422 },
      );
    }

    const base64 = `data:${detectedType};base64,${buffer.toString("base64")}`;

    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      cloudinary.uploader.upload(
        base64,
        {
          folder,
          resource_type: "image",
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (err, res) => {
          if (err || !res) reject(err ?? new Error("Upload failed"));
          else resolve(res as { secure_url: string; public_id: string });
        },
      );
    });

    const sha256 = createHash("sha256").update(buffer).digest("hex");

    // Persist what the server decided. Listing creation reads this back by URL,
    // so a client cannot promote its own photo by claiming it was classified
    // or by inventing a quality score.
    if (isVehiclePhoto) {
      await recordUploadClassification({
        url: result.secure_url,
        publicId: result.public_id,
        sha256,
        label: classification.label,
        score: classification.score,
        provider: classification.provider,
        userId: session.user.id,
        quality,
      }).catch((e) => console.error("[upload] classification not recorded:", e));
    }

    return NextResponse.json({
      url: result.secure_url,
      sha256,
      // Advisory only — shown in the UI so a seller knows what the server
      // thought. The authoritative copies are the rows written above; nothing
      // here is read back as input.
      review: decision.action === "review" || quality.verdict === "review",
      quality: {
        score: quality.score,
        verdict: quality.verdict,
        reasons: quality.reasons,
        recommendation: quality.recommendation,
      },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
