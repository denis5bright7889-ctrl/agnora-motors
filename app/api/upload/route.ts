import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

// Folders the login-free public listing form is allowed to upload to. Every
// other folder still requires an authenticated session (dealer docs, profile
// avatars, etc).
const PUBLIC_UPLOAD_FOLDERS = new Set(["agnora/cars"]);

// Cap per-image size to defend the Cloudinary account against spam from the
// anonymous upload path.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file   = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string | null) ?? "agnora";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Public folders (e.g. /sell/new car photos) are anonymous-allowed.
    // Everything else still requires a logged-in user.
    if (!PUBLIC_UPLOAD_FOLDERS.has(folder)) {
      const session = await auth();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image must be ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB or less` },
        { status: 413 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload(
        base64,
        {
          folder,
          resource_type: "image",
          transformation: [{ quality: "auto", fetch_format: "auto" }],
        },
        (err, res) => {
          if (err || !res) reject(err ?? new Error("Upload failed"));
          else resolve(res as { secure_url: string });
        },
      );
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
