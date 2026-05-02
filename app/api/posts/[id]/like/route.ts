import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleLike } from "@/lib/local-posts";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const post = toggleLike(id, session.user.id);
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    likes: post.likes.length,
    liked: post.likes.includes(session.user.id),
  });
}
