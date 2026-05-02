"use client";

import { useState } from "react";
import { Heart, MessageCircle, Trash2, ChevronDown, ChevronUp, Send } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Post, PostComment } from "@/lib/local-posts";
import { cn } from "@/lib/utils";

interface Props {
  post: Post;
  currentUserId?: string;
  onLike: (id: string) => void;
  onComment: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export function PostCard({ post, currentUserId, onLike, onComment, onDelete }: Props) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const liked = currentUserId ? post.likes.includes(currentUserId) : false;
  const isOwner = currentUserId === post.userId;

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    await onComment(post.id, commentText.trim());
    setCommentText("");
    setSubmitting(false);
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 hover:border-border/70 transition-colors">
      {/* Author */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Avatar name={post.userName} image={post.userImage} />
          <div>
            <p className="text-sm font-semibold leading-tight">{post.userName}</p>
            <p className="text-xs text-muted">{formatDate(post.createdAt)}</p>
          </div>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={() => onDelete(post.id)}
            aria-label="Delete post"
            className="text-muted hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-3">
        {renderContent(post.content)}
      </p>

      {/* Media */}
      {post.mediaUrl && (
        <div className="mb-3 rounded-xl overflow-hidden bg-surface-2 border border-border">
          {post.mediaType === "video" ? (
            <video
              src={post.mediaUrl}
              controls
              muted
              className="w-full max-h-80 object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.mediaUrl}
              alt="Post media"
              className="w-full max-h-80 object-cover"
            />
          )}
        </div>
      )}

      {/* Hashtags */}
      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.hashtags.map((tag) => (
            <span key={tag} className="text-xs text-accent font-medium hover:underline cursor-pointer">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => onLike(post.id)}
          disabled={!currentUserId}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium transition-colors",
            liked ? "text-red-500" : "text-muted hover:text-red-500",
            !currentUserId && "opacity-50 cursor-not-allowed",
          )}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-red-500")} />
          {post.likes.length > 0 && post.likes.length}
          <span className="sr-only">likes</span>
        </button>

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {post.comments.length > 0 && post.comments.length}
          {showComments ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-4 space-y-3">
          {post.comments.length > 0 && (
            <div className="space-y-3">
              {post.comments.map((c) => (
                <CommentRow key={c.id} comment={c} />
              ))}
            </div>
          )}

          {currentUserId ? (
            <form onSubmit={handleComment} className="flex gap-2 mt-3">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                maxLength={500}
                className="flex-1 h-9 rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent placeholder:text-muted"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submitting}
                className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <p className="text-xs text-muted mt-2">Sign in to comment.</p>
          )}
        </div>
      )}
    </article>
  );
}

function CommentRow({ comment }: { comment: PostComment }) {
  return (
    <div className="flex gap-2.5">
      <Avatar name={comment.userName} image={comment.userImage} size="sm" />
      <div className="flex-1 rounded-xl bg-surface-2 px-3 py-2">
        <p className="text-xs font-semibold mb-0.5">{comment.userName}</p>
        <p className="text-xs text-muted leading-relaxed">{comment.text}</p>
      </div>
    </div>
  );
}

function Avatar({ name, image, size = "md" }: { name: string; image?: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name} className={cn(cls, "rounded-full object-cover shrink-0")} />;
  }
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-blue-500","bg-green-500","bg-purple-500","bg-orange-500","bg-pink-500","bg-teal-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={cn(cls, color, "rounded-full flex items-center justify-center text-white font-bold shrink-0")}>
      {initials}
    </div>
  );
}

function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(#[\w]+)/g);
  return parts.map((part, i) =>
    part.startsWith("#") ? (
      <span key={i} className="text-accent font-medium">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
