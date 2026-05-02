import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleLike } from "@/lib/local-posts";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const post = toggleLike(params.id, session.user.id);
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ likes: post.likes.length, liked: post.likes.includes(session.user.id) });
}
