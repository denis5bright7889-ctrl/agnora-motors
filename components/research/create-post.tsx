"use client";

import { useState, useRef } from "react";
import { ImagePlus, Video, X, Send, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  userName: string;
  userImage?: string;
  onPost: (content: string, mediaUrl?: string, mediaType?: "image" | "video") => Promise<void>;
}

const SUGGESTED_TAGS = [
  "#Toyota", "#Mercedes", "#SUV", "#Electric", "#Nairobi",
  "#ForSale", "#Luxury", "#Hybrid", "#BMW", "#Review",
];

export function CreatePost({ userName, userImage, onPost }: Props) {
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "">("");
  const [mediaPreview, setMediaPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const colors = ["bg-blue-500","bg-green-500","bg-purple-500","bg-orange-500","bg-pink-500","bg-teal-500"];
  const avatarColor = colors[userName.charCodeAt(0) % colors.length];

  function insertTag(tag: string) {
    const textarea = textRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const before = content.slice(0, selectionStart);
    const after = content.slice(selectionEnd);
    const spaceBefore = before.length > 0 && !before.endsWith(" ") ? " " : "";
    setContent(`${before}${spaceBefore}${tag} ${after}`);
    setTimeout(() => {
      const pos = selectionStart + spaceBefore.length + tag.length + 1;
      textarea.setSelectionRange(pos, pos);
      textarea.focus();
    }, 0);
  }

  function handleMediaUrl(url: string, type: "image" | "video") {
    setMediaUrl(url);
    setMediaType(type);
    setMediaPreview(url);
  }

  function clearMedia() {
    setMediaUrl("");
    setMediaType("");
    setMediaPreview("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onPost(content.trim(), mediaUrl || undefined, (mediaType as "image" | "video") || undefined);
      setContent("");
      clearMedia();
      setShowTags(false);
    } finally {
      setSubmitting(false);
    }
  }

  const chars = content.length;
  const over = chars > 1000;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-4 mb-6">
      <div className="flex gap-3">
        {/* Avatar */}
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userImage} alt={userName} className="h-9 w-9 rounded-full object-cover shrink-0 mt-0.5" />
        ) : (
          <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5", avatarColor)}>
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Textarea */}
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a car review, update, or opinion… Use #hashtags"
            rows={3}
            maxLength={1000}
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent placeholder:text-muted leading-relaxed"
          />

          {/* Char count */}
          {chars > 800 && (
            <p className={cn("text-right text-xs mt-1", over ? "text-red-500" : "text-muted")}>
              {chars}/1000
            </p>
          )}

          {/* Media preview */}
          {mediaPreview && (
            <div className="relative mt-2 rounded-xl overflow-hidden border border-border bg-surface-2">
              {mediaType === "video" ? (
                <video src={mediaPreview} controls muted className="w-full max-h-48 object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaPreview} alt="preview" className="w-full max-h-48 object-cover" />
              )}
              <button
                type="button"
                onClick={clearMedia}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Hashtag suggestions */}
          {showTags && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTag(tag)}
                  className="h-6 rounded-full border border-border bg-surface-2 px-2.5 text-[11px] font-medium text-accent hover:bg-accent-soft transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Image URL */}
            <label className="flex items-center gap-1.5 h-8 rounded-full border border-border px-3 text-xs font-medium cursor-pointer hover:bg-surface-2 transition-colors">
              <ImagePlus className="h-3.5 w-3.5 text-muted" />
              Image URL
              <input
                type="url"
                placeholder="https://…"
                className="sr-only"
                onBlur={(e) => { if (e.target.value) handleMediaUrl(e.target.value, "image"); }}
              />
            </label>

            {/* Video URL */}
            <label className="flex items-center gap-1.5 h-8 rounded-full border border-border px-3 text-xs font-medium cursor-pointer hover:bg-surface-2 transition-colors">
              <Video className="h-3.5 w-3.5 text-muted" />
              Video URL
              <input
                type="url"
                placeholder="https://…"
                className="sr-only"
                onBlur={(e) => { if (e.target.value) handleMediaUrl(e.target.value, "video"); }}
              />
            </label>

            {/* Hashtags toggle */}
            <button
              type="button"
              onClick={() => setShowTags((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                showTags ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2",
              )}
            >
              <Hash className="h-3.5 w-3.5" />
              Tags
            </button>

            <div className="flex-1" />

            {/* Submit */}
            <button
              type="submit"
              disabled={!content.trim() || over || submitting}
              className="flex items-center gap-1.5 h-9 rounded-full bg-accent text-white px-5 text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
