import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";

export interface PostComment {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  hashtags: string[];
  likes: string[];        // array of userIds
  comments: PostComment[];
  createdAt: string;
}

const FILE = resolve(process.cwd(), ".local-posts.json");

function read(): Post[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, "utf-8")) as Post[];
  } catch {
    return [];
  }
}

function write(posts: Post[]): void {
  writeFileSync(FILE, JSON.stringify(posts, null, 2), "utf-8");
}

export function listPosts(): Post[] {
  return read().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getPost(id: string): Post | null {
  return read().find((p) => p.id === id) ?? null;
}

export function createPost(data: {
  userId: string;
  userName: string;
  userImage?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}): Post {
  const posts = read();
  const hashtags = (data.content.match(/#[\w]+/g) ?? []).map((t) =>
    t.toLowerCase(),
  );
  const post: Post = {
    id: crypto.randomUUID(),
    userId: data.userId,
    userName: data.userName,
    userImage: data.userImage,
    content: data.content,
    mediaUrl: data.mediaUrl,
    mediaType: data.mediaType,
    hashtags,
    likes: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
  posts.unshift(post);
  write(posts);
  return post;
}

export function toggleLike(postId: string, userId: string): Post | null {
  const posts = read();
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  if (post.likes.includes(userId)) {
    post.likes = post.likes.filter((id) => id !== userId);
  } else {
    post.likes.push(userId);
  }
  write(posts);
  return post;
}

export function addComment(
  postId: string,
  data: { userId: string; userName: string; userImage?: string; text: string },
): Post | null {
  const posts = read();
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  const comment: PostComment = {
    id: crypto.randomUUID(),
    userId: data.userId,
    userName: data.userName,
    userImage: data.userImage,
    text: data.text,
    createdAt: new Date().toISOString(),
  };
  post.comments.push(comment);
  write(posts);
  return post;
}

export function deletePost(postId: string, userId: string): boolean {
  const posts = read();
  const idx = posts.findIndex((p) => p.id === postId && p.userId === userId);
  if (idx === -1) return false;
  posts.splice(idx, 1);
  write(posts);
  return true;
}
