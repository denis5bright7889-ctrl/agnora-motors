import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPosts, createPost } from "@/lib/local-posts";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sort      = searchParams.get("sort") ?? "latest";
  const hashtag   = searchParams.get("hashtag") ?? "";
  const cursor    = searchParams.get("cursor") ?? "";
  const PAGE      = 20;

  let posts = listPosts();

  if (hashtag) {
    posts = posts.filter((p) =>
      p.hashtags.includes(hashtag.startsWith("#") ? hashtag.toLowerCase() : `#${hashtag.toLowerCase()}`),
    );
  }

  if (sort === "trending") {
    posts = [...posts].sort(
      (a, b) =>
        b.likes.length + b.comments.length * 2 -
        (a.likes.length + a.comments.length * 2),
    );
  }

  // Cursor-based pagination (by createdAt ISO string)
  const startIdx = cursor
    ? posts.findIndex((p) => p.createdAt < cursor)
    : 0;
  const slice = posts.slice(
    startIdx < 0 ? posts.length : startIdx,
    (startIdx < 0 ? posts.length : startIdx) + PAGE,
  );
  const nextCursor = slice.length === PAGE ? slice[slice.length - 1].createdAt : null;

  return NextResponse.json({ posts: slice, nextCursor });
}

const createSchema = z.object({
  content: z.string().min(1).max(1000),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const post = createPost({
    userId:    session.user.id,
    userName:  session.user.name ?? "Anonymous",
    userImage: session.user.image ?? undefined,
    content:   parsed.data.content,
    mediaUrl:  parsed.data.mediaUrl,
    mediaType: parsed.data.mediaType,
  });

  return NextResponse.json({ post }, { status: 201 });
}
