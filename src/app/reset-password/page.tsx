"use client";

import { Suspense, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-crit-600">
        This reset link is missing its token. Request a new one from the{" "}
        <Link href="/forgot-password" className="font-semibold text-teal-600 hover:underline">
          forgot password
        </Link>{" "}
        page.
      </p>
    );
  }

  if (success) {
    return <p className="text-sm text-good-600">Password updated — redirecting you to log in…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="password"
        label="New password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <Input
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        required
        minLength={8}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
      />
      {error && <p className="text-sm text-crit-600">{error}</p>}
      <Button type="submit" disabled={loading} className="mt-1 w-full">
        {loading ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
          <h2 className="mb-5 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Set a new password
          </h2>
          <Suspense fallback={<p className="text-sm text-ink-500">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
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
