"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="text-sm text-accent font-medium">
        You're subscribed! We'll send updates to {email}.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.co.ke"
        aria-label="Email address"
        className="flex-1 h-11 rounded-full border border-border bg-surface-2 px-4 text-sm outline-none focus:border-accent placeholder:text-muted"
      />
      <button
        type="submit"
        className="h-11 rounded-full bg-accent text-white px-6 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Subscribe
      </button>
    </form>
  );
}
