"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
            Personal Portfolio Tracker
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-bold text-ink-900">
            Portfolio Watcher
          </h1>
        </div>

        <Card>
          <h2 className="mb-2 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Forgot your password?
          </h2>
          <p className="mb-5 text-sm text-ink-500">
            Enter your email and we&apos;ll send you a link to reset it.
          </p>

          {message ? (
            <p className="text-sm text-good-600">{message}</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                id="email"
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {error && <p className="text-sm text-crit-600">{error}</p>}
              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-5 text-center text-sm text-ink-500">
          <Link href="/login" className="font-semibold text-teal-600 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
