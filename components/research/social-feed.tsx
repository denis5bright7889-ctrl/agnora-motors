"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TrendingUp, Clock, Hash, Loader2, MessageSquare } from "lucide-react";
import { PostCard } from "./post-card";
import { CreatePost } from "./create-post";
import { cn } from "@/lib/utils";
import type { Post } from "@/lib/local-posts";

interface Props {
  userId?: string;
  userName?: string;
  userImage?: string;
}

const SORT_OPTIONS = [
  { value: "latest",   label: "Latest",   icon: Clock },
  { value: "trending", label: "Trending", icon: TrendingUp },
] as const;

const HASHTAG_FILTERS = [
  "#Toyota", "#Mercedes", "#SUV", "#Electric",
  "#Nairobi", "#Luxury", "#BMW", "#Review",
];

export function SocialFeed({ userId, userName, userImage }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState<"latest" | "trending">("latest");
  const [activeTag, setActiveTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(
    async (cursor?: string, replace = true) => {
      if (replace) setLoading(true); else setLoadingMore(true);
      try {
        const params = new URLSearchParams({ sort });
        if (activeTag) params.set("hashtag", activeTag);
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/posts?${params}`);
        const data = await res.json() as { posts: Post[]; nextCursor: string | null };
        setPosts((prev) => replace ? data.posts : [...prev, ...data.posts]);
        setNextCursor(data.nextCursor);
      } catch {
        // ignore
      } finally {
        if (replace) setLoading(false); else setLoadingMore(false);
      }
    },
    [sort, activeTag],
  );

  useEffect(() => { fetchPosts(undefined, true); }, [fetchPosts]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore) {
          fetchPosts(nextCursor, false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, fetchPosts]);

  async function handlePost(content: string, mediaUrl?: string, mediaType?: "image" | "video") {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, mediaUrl, mediaType }),
    });
    if (res.ok) {
      const { post } = await res.json() as { post: Post };
      setPosts((prev) => [post, ...prev]);
    }
  }

  async function handleLike(postId: string) {
    if (!userId) return;
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (res.ok) {
      const { likes, liked } = await res.json() as { likes: number; liked: boolean };
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likes: liked
                  ? [...p.likes.filter((id) => id !== userId), userId]
                  : p.likes.filter((id) => id !== userId),
              }
            : p,
        ),
      );
    }
  }

  async function handleComment(postId: string, text: string) {
    const res = await fetch(`/api/posts/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const { comments } = await res.json() as { comments: Post["comments"] };
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments } : p)),
      );
    }
  }

  async function handleDelete(postId: string) {
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  }

  return (
    <div>
      {/* Create post */}
      {userId && userName ? (
        <CreatePost userName={userName} userImage={userImage} onPost={handlePost} />
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-5 mb-6 text-center">
          <p className="text-sm text-muted">
            <a href="/login" className="text-accent font-semibold hover:underline">Sign in</a>
            {" "}to post, like, and comment on the community feed.
          </p>
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Sort */}
        <div className="flex rounded-full border border-border overflow-hidden">
          {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-4 text-xs font-medium transition-colors",
                sort === value ? "bg-accent text-white" : "text-muted hover:bg-surface-2",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Hashtag pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-wrap">
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag("")}
              className="h-7 rounded-full border border-accent bg-accent-soft text-accent px-3 text-xs font-medium shrink-0"
            >
              {activeTag} ×
            </button>
          )}
          {!activeTag && HASHTAG_FILTERS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className="h-7 rounded-full border border-border px-3 text-xs font-medium text-muted hover:border-accent/50 hover:text-accent transition-colors shrink-0 flex items-center gap-1"
            >
              <Hash className="h-3 w-3" />
              {tag.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-5 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-surface-2" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-surface-2" />
                  <div className="h-3 w-16 rounded bg-surface-2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-surface-2" />
                <div className="h-3 w-5/6 rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
            <MessageSquare className="h-6 w-6 text-muted" aria-hidden />
          </div>
          <p className="font-semibold mb-1">No posts yet</p>
          <p className="text-sm text-muted">Be the first to share something about cars.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={userId}
              onLike={handleLike}
              onComment={handleComment}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {loadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 text-muted animate-spin" />
        </div>
      )}
    </div>
  );
}
