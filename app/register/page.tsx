"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().min(2, "Full name required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    terms: z.boolean().refine((v) => v === true, "You must accept the terms"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        password: data.password,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setServerError(json.error ?? "Registration failed");
      return;
    }

    // Auto sign in
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError("Account created — please sign in.");
      router.push("/login");
      return;
    }

    router.push("/");
  }

  return (
    <div className="grain flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 font-display text-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <span className="font-medium">
              Agnora<span className="text-accent">.</span>
            </span>
          </div>
          <p className="text-sm text-muted">Kenya's verified car marketplace</p>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-8 shadow-xl shadow-black/5 dark:shadow-black/30">
          <h1 className="font-display text-2xl font-medium mb-1">Create account</h1>
          <p className="text-sm text-muted mb-7">Free. No credit card needed.</p>

          {serverError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
              <X className="h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Full name" error={errors.name?.message}>
              <input
                {...register("name")}
                placeholder="Jane Mwangi"
                autoComplete="name"
                className={inputCls(!!errors.name)}
              />
            </Field>

            <Field label="Email address" error={errors.email?.message}>
              <input
                {...register("email")}
                type="email"
                placeholder="you@email.co.ke"
                autoComplete="email"
                className={inputCls(!!errors.email)}
              />
            </Field>

            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPw ? "text" : "password"}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  className={cn(inputCls(!!errors.password), "pr-11")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Field label="Confirm password" error={errors.confirmPassword?.message}>
              <input
                {...register("confirmPassword")}
                type="password"
                placeholder="Repeat password"
                autoComplete="new-password"
                className={inputCls(!!errors.confirmPassword)}
              />
            </Field>

            <Field error={errors.terms?.message}>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  {...register("terms")}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer"
                />
                <span className="text-xs text-muted leading-relaxed">
                  I agree to Agnora's{" "}
                  <Link href="#" className="underline hover:text-foreground">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </Field>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 mt-2"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>

            <div className="relative my-2 flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted uppercase tracking-wider">or</span>
              <div className="flex-1 border-t border-border" />
            </div>

            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full h-12 rounded-full border border-border bg-surface-2 text-sm font-medium hover:bg-surface transition-colors flex items-center justify-center gap-2.5"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:text-accent transition-colors"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-muted">
          Are you a dealer?{" "}
          <Link
            href="/dealer/register"
            className="font-medium text-foreground hover:text-accent transition-colors"
          >
            Apply for dealer access
          </Link>
        </p>
      </div>
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "w-full h-11 rounded-xl border bg-surface-2 px-4 text-sm outline-none transition-colors placeholder:text-muted",
    hasError ? "border-red-500" : "border-border focus:border-accent",
  );
}

function Field({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          {label}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
