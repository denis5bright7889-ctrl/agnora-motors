import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deletePost } from "@/lib/local-posts";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = deletePost(params.id, session.user.id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
