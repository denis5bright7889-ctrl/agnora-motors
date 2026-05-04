"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Bot, Send, User, Loader2, X, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiChatWidgetProps {
  carDetails?: Record<string, unknown>;
  sellerInfo?: Record<string, unknown>;
}

export function AiChatWidget({ carDetails, sellerInfo }: AiChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gateError, setGateError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

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
        body: JSON.stringify({ messages: newMessages, carDetails, sellerInfo }),
      });

      if (res.status === 401) {
        setGateError("Sign in to use the AI assistant.");
        setMessages(messages);
        return;
      }
      if (res.status === 403) {
        const data = await res.json() as { error?: string };
        setGateError(data.error ?? "AI chat requires a Pro or Premium plan.");
        setMessages(messages);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "Something went wrong.");
        setMessages(messages);
        return;
      }

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
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as unknown as FormEvent);
    }
  }

  return (
    <>
      {/* Floating trigger button
          Mobile:  above sticky CTA (bottom-14=56px) + CTA height (~68px) → bottom-32
          Tablet:  sticky CTA sits at md:bottom-0, CTA ~68px → bottom-20
          Desktop: no sticky CTA, no bottom nav → bottom-6             */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Ask AI about this car"}
        className={cn(
          "fixed right-4 z-50 h-12 w-12 rounded-full shadow-lg shadow-black/20 flex items-center justify-center transition-all duration-200",
          "bottom-32 md:bottom-20 lg:bottom-6",
          open
            ? "bg-surface-2 border border-border text-muted hover:text-foreground"
            : "bg-accent text-white hover:opacity-90",
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      {/* Chat panel — opens upward from the button
          panel-bottom = button-bottom + button-height(3rem) + gap(0.5rem)  */}
      {open && (
        <div
          className={cn(
            "fixed right-4 z-50 w-[calc(100vw-2rem)] max-w-sm",
            "bottom-[11.5rem] md:bottom-[9.5rem] lg:bottom-[5rem]",
            "h-[60vh] max-h-[480px]",
            "rounded-3xl border border-border bg-background shadow-2xl shadow-black/20 flex flex-col",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0 rounded-t-3xl">
            <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">Agnora AI</p>
              <p className="text-[10px] text-muted mt-0.5 truncate">Ask anything about this car</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-full bg-surface-2 flex items-center justify-center hover:bg-surface transition-colors shrink-0"
              aria-label="Close AI assistant"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Gate error state */}
          {gateError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="h-12 w-12 rounded-2xl bg-surface-2 flex items-center justify-center">
                <Lock className="h-6 w-6 text-muted" />
              </div>
              <p className="text-sm text-muted leading-relaxed">{gateError}</p>
              <Link
                href="/dealer/subscription"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Upgrade <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-4">
                    <p className="text-xs text-muted px-2">
                      Ask me about pricing, condition, history, or anything else about this car.
                    </p>
                    <div className="flex flex-col gap-1.5 w-full">
                      {[
                        "Is this price fair for this mileage?",
                        "What should I check on the test drive?",
                      ].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setInput(q)}
                          className="text-left rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-muted hover:text-foreground hover:border-accent/30 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2", msg.role === "user" && "justify-end")}>
                    {msg.role === "assistant" && (
                      <div className="h-6 w-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3 w-3 text-accent" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-accent text-white rounded-br-sm"
                        : "bg-surface-2 text-foreground rounded-bl-sm",
                    )}>
                      {msg.content || (msg.role === "assistant" && loading && i === messages.length - 1
                        ? <Loader2 className="h-3 w-3 animate-spin text-muted" />
                        : msg.content)}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-6 w-6 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-muted" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-2">
                    <div className="h-6 w-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <Bot className="h-3 w-3 text-accent" />
                    </div>
                    <div className="bg-surface-2 rounded-2xl rounded-bl-sm px-3 py-2.5">
                      <Loader2 className="h-3 w-3 animate-spin text-muted" />
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-[10px] text-red-500 text-center">{error}</p>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={sendMessage}
                className="flex items-end gap-2 p-3 pt-2 border-t border-border shrink-0"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this car…"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-accent transition-colors placeholder:text-muted max-h-20 overflow-y-auto"
                  style={{ height: "auto" }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = `${Math.min(t.scrollHeight, 80)}px`;
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-white hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
                >
                  {loading
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Send className="h-3 w-3" />}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
