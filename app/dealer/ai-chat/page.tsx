"use client";

import {
  useState, useRef, useEffect, FormEvent, useCallback,
} from "react";
import {
  Bot, Send, User, Loader2, Lock, ArrowRight,
  Sparkles, Tag, MessageSquare, AlignLeft, X, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  buildListingPrompt, buildPricePrompt,
  buildBuyerReplyPrompt, buildSummarizePrompt,
} from "@/lib/ai";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function newMsg(role: "user" | "assistant", content: string): Message {
  return { id: crypto.randomUUID(), role, content };
}

type ActionMode = "listing" | "price" | "buyer" | "summarize" | null;

// ── Quick action form state ───────────────────────────────────────────────────

interface ListingForm {
  make: string; model: string; year: string;
  mileage: string; condition: string; price: string; notes: string;
}

interface PriceForm {
  make: string; model: string; year: string;
  mileage: string; condition: string;
}

const EMPTY_LISTING: ListingForm = {
  make: "", model: "", year: "", mileage: "", condition: "Good", price: "", notes: "",
};
const EMPTY_PRICE: PriceForm = {
  make: "", model: "", year: "", mileage: "", condition: "Good",
};
const CONDITIONS = ["Excellent", "Good", "Fair", "Needs work"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function inputCls(err?: boolean) {
  return cn(
    "w-full h-10 rounded-xl border bg-surface-2 px-3 text-sm outline-none transition-colors placeholder:text-muted",
    err ? "border-red-500" : "border-border focus:border-accent",
  );
}

function Label({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
      {children}
    </label>
  );
}

// ── Quick action buttons ──────────────────────────────────────────────────────

const ACTIONS = [
  { mode: "listing"  as ActionMode, icon: Sparkles,      label: "Generate listing",  desc: "Write a full listing from car details" },
  { mode: "price"    as ActionMode, icon: Tag,            label: "Suggest price",     desc: "Get a competitive KES price range"     },
  { mode: "buyer"    as ActionMode, icon: MessageSquare,  label: "Reply to buyer",    desc: "Draft a professional buyer response"   },
  { mode: "summarize"as ActionMode, icon: AlignLeft,      label: "Summarize chat",    desc: "Extract buyer intent from messages"    },
];

// ── Chat message renderer ─────────────────────────────────────────────────────

function ChatMessage({ msg, isStreaming }: Readonly<{ msg: Message; isStreaming: boolean }>) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "justify-end")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-accent" />
        </div>
      )}
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
        isUser
          ? "bg-accent text-white rounded-br-sm"
          : "bg-surface-2 text-foreground rounded-bl-sm whitespace-pre-wrap",
      )}>
        {msg.content || (isStreaming ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        ) : null)}
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted" />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AiChatPage() {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [gateError, setGateError]   = useState("");
  const [mode, setMode]             = useState<ActionMode>(null);
  const [listingForm, setListingForm] = useState<ListingForm>(EMPTY_LISTING);
  const [priceForm, setPriceForm]   = useState<PriceForm>(EMPTY_PRICE);
  const [buyerMsg, setBuyerMsg]     = useState("");
  const [summarizeText, setSummarizeText] = useState("");
  const [showActions, setShowActions] = useState(true);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Stream handler ──────────────────────────────────────────────────────────

  const sendMessages = useCallback(async (newMessages: Message[]) => {
    setLoading(true);
    setError("");
    setMode(null);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: newMessages }),
      });

      if (res.status === 403) {
        const data = await res.json() as { error?: string };
        setGateError(data.error ?? "AI chat requires an upgrade.");
        // Revert: remove the user message we optimistically added
        setMessages(newMessages.slice(0, -1));
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        setMessages(newMessages.slice(0, -1));
        return;
      }

      // Append streaming assistant placeholder with a stable ID
      const assistantId = crypto.randomUUID();
      setMessages([...newMessages, { id: assistantId, role: "assistant", content: "" }]);

      const reader  = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Functional update so we only touch the last message, not rebuild the array
          setMessages((prev) => {
            const next = [...prev];
            const last = next.at(-1);
            if (last?.id === assistantId) {
              next[next.length - 1] = { ...last, content: last.content + chunk };
            }
            return next;
          });
        }
      }
    } catch {
      setError("Network error. Please check your connection.");
      setMessages(newMessages.slice(0, -1));
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Free-text send ──────────────────────────────────────────────────────────

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, newMsg("user", text)];
    setMessages(next);
    setInput("");
    await sendMessages(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(e as unknown as FormEvent);
    }
  }

  // ── Quick action submit handlers ────────────────────────────────────────────

  function submitListing(e: FormEvent) {
    e.preventDefault();
    const f = listingForm;
    if (!f.make || !f.model || !f.year || !f.mileage || !f.price) return;
    const prompt = buildListingPrompt(f);
    const next: Message[] = [...messages, newMsg("user", prompt)];
    setMessages(next);
    setListingForm(EMPTY_LISTING);
    void sendMessages(next);
  }

  function submitPrice(e: FormEvent) {
    e.preventDefault();
    const f = priceForm;
    if (!f.make || !f.model || !f.year || !f.mileage) return;
    const prompt = buildPricePrompt(f);
    const next: Message[] = [...messages, newMsg("user", prompt)];
    setMessages(next);
    setPriceForm(EMPTY_PRICE);
    void sendMessages(next);
  }

  function submitBuyerReply(e: FormEvent) {
    e.preventDefault();
    if (!buyerMsg.trim()) return;
    const prompt = buildBuyerReplyPrompt(buyerMsg.trim());
    const next: Message[] = [...messages, newMsg("user", prompt)];
    setMessages(next);
    setBuyerMsg("");
    void sendMessages(next);
  }

  function submitSummarize(e: FormEvent) {
    e.preventDefault();
    if (!summarizeText.trim()) return;
    const prompt = buildSummarizePrompt(summarizeText.trim());
    const next: Message[] = [...messages, newMsg("user", prompt)];
    setMessages(next);
    setSummarizeText("");
    void sendMessages(next);
  }

  // ── Upgrade gate screen ─────────────────────────────────────────────────────

  if (gateError) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto">
          <Lock className="h-7 w-7 text-muted" />
        </div>
        <h1 className="font-display text-2xl font-medium">AI Assistant</h1>
        <p className="text-sm text-muted leading-relaxed">{gateError}</p>
        <Link
          href="/dealer/subscription"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Upgrade to Pro <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────────

  const isStreaming = loading && messages.at(-1)?.role === "assistant";

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-10rem)] max-w-6xl">

      {/* ── Chat panel (left) ── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <div className="mb-3">
          <h1 className="font-display text-2xl font-medium">AI Assistant</h1>
          <p className="text-sm text-muted mt-0.5">
            Your personal sales coach for the Kenyan car market.
          </p>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-surface p-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-6">
              <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Bot className="h-7 w-7 text-accent" />
              </div>
              <div>
                <p className="font-semibold">Agnora AI</p>
                <p className="text-sm text-muted mt-1 max-w-xs">
                  Ask me anything or use a quick action to generate a listing, get pricing, or draft a buyer reply.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-sm">
                {[
                  "What's a competitive price for a 2020 Toyota Prado TX?",
                  "How do I write a compelling car description?",
                  "What do Kenyan buyers look for in a used car?",
                  "Tips to get more inquiries on my listing?",
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
            <ChatMessage
              key={msg.id}
              msg={msg}
              isStreaming={isStreaming && i === messages.length - 1}
            />
          ))}

          {/* Typing indicator when first chunk hasn't arrived */}
          {loading && messages.at(-1)?.role === "user" && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="bg-surface-2 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted" />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="mt-3 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about listings, pricing, buyers…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted max-h-32 overflow-y-auto disabled:opacity-60"
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
        <p className="mt-1.5 text-center text-[10px] text-muted">
          Enter to send · Shift+Enter for new line · AI suggestions are indicative, not guaranteed
        </p>
      </div>

      {/* ── Quick actions panel (right) ── */}
      <div className="lg:w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">

        {/* Actions list */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <button
            type="button"
            aria-label="Toggle quick actions"
            onClick={() => setShowActions((v) => !v)}
            className="flex w-full items-center justify-between mb-3"
          >
            <span className="text-sm font-semibold">Quick actions</span>
            <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", !showActions && "-rotate-90")} />
          </button>

          {showActions && (
            <div className="space-y-2">
              {ACTIONS.map(({ mode: m, icon: Icon, label, desc }) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(mode === m ? null : m)}
                  disabled={loading}
                  className={cn(
                    "w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50",
                    mode === m
                      ? "border-accent/40 bg-accent/10"
                      : "border-border hover:border-accent/30 hover:bg-surface-2",
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    mode === m ? "bg-accent text-white" : "bg-surface-2 text-muted",
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="text-xs text-muted mt-0.5 leading-snug">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Generate Listing form ── */}
        {mode === "listing" && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Car details</p>
              <button type="button" aria-label="Close" onClick={() => setMode(null)}><X className="h-4 w-4 text-muted hover:text-foreground" /></button>
            </div>
            <form onSubmit={submitListing} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Make *</Label>
                  <input value={listingForm.make}
                    onChange={(e) => setListingForm({ ...listingForm, make: e.target.value })}
                    placeholder="Toyota" className={inputCls()} />
                </div>
                <div>
                  <Label>Model *</Label>
                  <input value={listingForm.model}
                    onChange={(e) => setListingForm({ ...listingForm, model: e.target.value })}
                    placeholder="Prado" className={inputCls()} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Year *</Label>
                  <input value={listingForm.year} type="number" min={1990} max={2026}
                    onChange={(e) => setListingForm({ ...listingForm, year: e.target.value })}
                    placeholder="2020" className={inputCls()} />
                </div>
                <div>
                  <Label>Mileage (km) *</Label>
                  <input value={listingForm.mileage} type="number"
                    onChange={(e) => setListingForm({ ...listingForm, mileage: e.target.value })}
                    placeholder="45000" className={inputCls()} />
                </div>
              </div>
              <div>
                <Label>Condition *</Label>
                <select aria-label="Condition" value={listingForm.condition}
                  onChange={(e) => setListingForm({ ...listingForm, condition: e.target.value })}
                  className={inputCls()}>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Asking price (KSh) *</Label>
                <input value={listingForm.price} type="number"
                  onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })}
                  placeholder="3500000" className={inputCls()} />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <textarea value={listingForm.notes} rows={2}
                  onChange={(e) => setListingForm({ ...listingForm, notes: e.target.value })}
                  placeholder="e.g. Full-service history, sunroof, leather seats"
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent resize-none placeholder:text-muted" />
              </div>
              <button type="submit"
                disabled={!listingForm.make || !listingForm.model || !listingForm.year || !listingForm.mileage || !listingForm.price || loading}
                className="w-full h-10 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate listing
              </button>
            </form>
          </div>
        )}

        {/* ── Suggest price form ── */}
        {mode === "price" && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Vehicle details</p>
              <button type="button" aria-label="Close" onClick={() => setMode(null)}><X className="h-4 w-4 text-muted hover:text-foreground" /></button>
            </div>
            <form onSubmit={submitPrice} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Make *</Label>
                  <input value={priceForm.make}
                    onChange={(e) => setPriceForm({ ...priceForm, make: e.target.value })}
                    placeholder="Subaru" className={inputCls()} />
                </div>
                <div>
                  <Label>Model *</Label>
                  <input value={priceForm.model}
                    onChange={(e) => setPriceForm({ ...priceForm, model: e.target.value })}
                    placeholder="Forester" className={inputCls()} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Year *</Label>
                  <input value={priceForm.year} type="number" min={1990} max={2026}
                    onChange={(e) => setPriceForm({ ...priceForm, year: e.target.value })}
                    placeholder="2018" className={inputCls()} />
                </div>
                <div>
                  <Label>Mileage (km) *</Label>
                  <input value={priceForm.mileage} type="number"
                    onChange={(e) => setPriceForm({ ...priceForm, mileage: e.target.value })}
                    placeholder="80000" className={inputCls()} />
                </div>
              </div>
              <div>
                <Label>Condition</Label>
                <select aria-label="Condition" value={priceForm.condition}
                  onChange={(e) => setPriceForm({ ...priceForm, condition: e.target.value })}
                  className={inputCls()}>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit"
                disabled={!priceForm.make || !priceForm.model || !priceForm.year || !priceForm.mileage || loading}
                className="w-full h-10 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                Suggest price
              </button>
            </form>
          </div>
        )}

        {/* ── Reply to buyer form ── */}
        {mode === "buyer" && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Buyer message</p>
              <button type="button" aria-label="Close" onClick={() => setMode(null)}><X className="h-4 w-4 text-muted hover:text-foreground" /></button>
            </div>
            <form onSubmit={submitBuyerReply} className="space-y-3">
              <div>
                <Label>Paste the buyer&apos;s message *</Label>
                <textarea value={buyerMsg} rows={4}
                  onChange={(e) => setBuyerMsg(e.target.value)}
                  placeholder="e.g. Hi, is the car still available? Can you do 2.8M?"
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent resize-none placeholder:text-muted" />
              </div>
              <button type="submit"
                disabled={!buyerMsg.trim() || loading}
                className="w-full h-10 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Generate reply
              </button>
            </form>
          </div>
        )}

        {/* ── Summarize conversation form ── */}
        {mode === "summarize" && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Conversation to summarize</p>
              <button type="button" aria-label="Close" onClick={() => setMode(null)}><X className="h-4 w-4 text-muted hover:text-foreground" /></button>
            </div>
            <form onSubmit={submitSummarize} className="space-y-3">
              <div>
                <Label>Paste the conversation *</Label>
                <textarea value={summarizeText} rows={6}
                  onChange={(e) => setSummarizeText(e.target.value)}
                  placeholder={"Buyer: Is the Honda CRV still available?\nYou: Yes, still available.\nBuyer: Can you come down to 1.9M? ..."}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent resize-none placeholder:text-muted font-mono text-xs" />
              </div>
              <button type="submit"
                disabled={!summarizeText.trim() || loading}
                className="w-full h-10 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlignLeft className="h-4 w-4" />}
                Summarize
              </button>
            </form>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] text-muted text-center px-2 pb-2">
          AI responses are suggestions only. Always verify pricing with local market data before listing.
        </p>
      </div>
    </div>
  );
}
