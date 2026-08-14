"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

const ERROR_MESSAGES: Record<string, string> = {
  "2FA_INVALID": "That code didn't match. Check your authenticator app and try again.",
  "2FA_LOCKED": "Too many failed codes — try again in 15 minutes.",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      totpCode: needsCode ? totpCode : undefined,
      remember: String(remember),
      redirect: false,
    });

    if (result?.error === "2FA_REQUIRED") {
      setNeedsCode(true);
      setLoading(false);
      return;
    }

    if (result?.error) {
      setError(ERROR_MESSAGES[result.error] ?? "Incorrect email or password.");
      if (result.error !== "2FA_INVALID" && result.error !== "2FA_LOCKED") {
        setNeedsCode(false);
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function handleBack() {
    setNeedsCode(false);
    setTotpCode("");
    setError(null);
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
          <h2 className="mb-5 font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
            Log in
          </h2>
          {needsCode ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-ink-700">Enter the 6-digit code from your authenticator app.</p>
              <Input
                id="totpCode"
                label="Two-factor code"
                inputMode="numeric"
                required
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 9))}
                placeholder="123456 or a backup code"
                maxLength={9}
              />
              {error && <p className="text-sm text-crit-600">{error}</p>}
              <Button type="submit" disabled={loading || !totpCode} className="mt-1 w-full">
                {loading ? "Verifying…" : "Verify"}
              </Button>
              <button
                type="button"
                onClick={handleBack}
                className="text-center text-sm text-ink-500 hover:text-teal-600 hover:underline"
              >
                Back
              </button>
            </form>
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
              <Input
                id="password"
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-teal-600"
                />
                Remember me for 30 days
              </label>
              {error && <p className="text-sm text-crit-600">{error}</p>}
              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? "Logging in…" : "Log in"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="text-ink-500 hover:text-teal-600 hover:underline">
              Forgot password?
            </Link>
          </p>
        </Card>

        <p className="mt-5 text-center text-sm text-ink-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-teal-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
