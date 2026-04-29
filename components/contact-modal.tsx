"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  carTitle: string;
  dealerName: string;
  onClose: () => void;
}

export function ContactModal({ carTitle, dealerName, onClose }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { message: `Hi, I'm interested in the ${carTitle}. Is it still available?` },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function onSubmit(data: FormData) {
    return new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 h-8 w-8 flex items-center justify-center rounded-full bg-surface-2 hover:bg-surface text-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-display text-xl font-medium mb-1">Contact {dealerName}</h2>
        <p className="text-sm text-muted mb-5">{carTitle}</p>

        {isSubmitSuccessful ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
              <Check className="h-7 w-7 text-green-500" />
            </div>
            <h3 className="font-semibold mb-1">Message sent!</h3>
            <p className="text-sm text-muted">
              {dealerName} will get back to you within a few hours.
            </p>
            <button
              onClick={onClose}
              className="mt-6 h-10 rounded-full bg-foreground px-6 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Your name" error={errors.name?.message}>
              <input
                {...register("name")}
                placeholder="Jane Doe"
                className={inputCls(!!errors.name)}
              />
            </Field>
            <Field label="Email address" error={errors.email?.message}>
              <input
                {...register("email")}
                type="email"
                placeholder="you@email.co.ke"
                className={inputCls(!!errors.email)}
              />
            </Field>
            <Field label="Phone number" error={errors.phone?.message}>
              <input
                {...register("phone")}
                type="tel"
                placeholder="+254 7XX XXX XXX"
                className={inputCls(!!errors.phone)}
              />
            </Field>
            <Field label="Message" error={errors.message?.message}>
              <textarea
                {...register("message")}
                rows={3}
                className={cn(inputCls(!!errors.message), "resize-none")}
              />
            </Field>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "w-full h-11 rounded-xl border bg-surface-2 px-4 text-sm outline-none transition-colors",
    "placeholder:text-muted",
    hasError
      ? "border-red-500 focus:border-red-500"
      : "border-border focus:border-accent",
  );
}

function Field({
  label, error, children,
}: {
  label: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}