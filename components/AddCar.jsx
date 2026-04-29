"use client";

import { useState } from "react";

const initialState = {
  title: "",
  price: "",
  image: "",
  description: "",
};

export function AddCar({ onAdded }) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    const numericPrice = Number(form.price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Price must be a valid number.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          price: numericPrice,
          image: form.image.trim(),
          description: form.description.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to post car.");
      }

      setForm(initialState);
      if (onAdded) onAdded(payload.car);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to post car.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
          Title
        </label>
        <input
          type="text"
          required
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="e.g. 2020 Toyota Vitz"
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
          Price (KSh)
        </label>
        <input
          type="number"
          required
          min="1"
          step="1"
          value={form.price}
          onChange={(event) => updateField("price", event.target.value)}
          placeholder="Enter price"
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
          Image URL
        </label>
        <input
          type="url"
          value={form.image}
          onChange={(event) => updateField("image", event.target.value)}
          placeholder="https://..."
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted">
          Description (Optional)
        </label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Posting..." : "Post Car"}
      </button>
    </form>
  );
}
