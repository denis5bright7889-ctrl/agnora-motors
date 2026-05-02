import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { addComment } from "@/lib/local-posts";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ text: z.string().min(1).max(500) });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const post = addComment(params.id, {
    userId:    session.user.id,
    userName:  session.user.name ?? "Anonymous",
    userImage: session.user.image ?? undefined,
    text:      parsed.data.text,
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ comments: post.comments });
}
