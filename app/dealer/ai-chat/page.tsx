"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Bot, Send, User, Loader2, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gateError, setGateError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (res.status === 403) {
        const data = await res.json() as { error?: string };
        setGateError(data.error ?? "AI chat requires an upgrade.");
        setMessages(messages); // revert
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        setMessages(messages);
        return;
      }

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value, { stream: true });
          setMessages([...newMessages, { role: "assistant", content: assistantText }]);
        }
      }
    } catch {
      setError("Network error. Please try again.");
      setMessages(messages);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as unknown as FormEvent);
    }
  }

  if (gateError) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto">
          <Lock className="h-7 w-7 text-muted" />
        </div>
        <h1 className="font-display text-2xl font-medium">AI Assistant</h1>
        <p className="text-sm text-muted">{gateError}</p>
        <Link
          href="/dealer/subscription"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Upgrade to Pro <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-3xl">

      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-3xl font-medium">AI Assistant</h1>
        <p className="text-muted mt-0.5 text-sm">Ask anything about your listings, buyers, pricing, or the Kenyan car market.</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-surface p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
            <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Bot className="h-7 w-7 text-accent" />
            </div>
            <div>
              <p className="font-semibold">Agnora AI Assistant</p>
              <p className="text-sm text-muted mt-1 max-w-sm">
                I can help with pricing guidance, buyer questions, listing tips, and market insights for the Kenyan car market.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-md">
              {[
                "What's a fair price for a 2019 Toyota Prado?",
                "How do I write a good car description?",
                "What do buyers typically ask about?",
                "Tips for getting more inquiries?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-left rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted hover:text-foreground hover:border-accent/30 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" && "justify-end")}>
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-accent" />
              </div>
            )}
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
              msg.role === "user"
                ? "bg-accent text-white rounded-br-sm"
                : "bg-surface-2 text-foreground rounded-bl-sm",
            )}>
              {msg.content || (msg.role === "assistant" && loading && i === messages.length - 1 ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted" />
              ) : msg.content)}
            </div>
            {msg.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4 text-muted" />
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <div className="bg-surface-2 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted" />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="mt-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted max-h-32 overflow-y-auto"
          style={{ height: "auto" }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="h-11 w-11 rounded-full bg-accent flex items-center justify-center text-white hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-2 text-center text-[10px] text-muted">Press Enter to send · Shift+Enter for new line</p>

    </div>
  );
}
