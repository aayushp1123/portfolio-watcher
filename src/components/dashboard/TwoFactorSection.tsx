"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

function useModalBehavior(open: boolean, onClose: () => void, canClose: boolean) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && canClose) onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, canClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);
}

function ModalShell({
  open,
  onClose,
  canClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  canClose: boolean;
  label: string;
  children: React.ReactNode;
}) {
  useModalBehavior(open, onClose, canClose);
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        animation: "modal-backdrop-in 180ms ease-out",
        background: "radial-gradient(125% 125% at 50% 10%, #000 40%, #1f6f78 100%)",
      }}
      onClick={() => canClose && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line bg-paper-0 p-6 shadow-2xl"
        style={{ animation: "modal-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function BackupCodesView({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied -- codes are still visible to copy manually
    }
  }

  return (
    <div className="text-center">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">Save your backup codes</h2>
      <p className="mt-2 text-sm text-ink-700">
        Each code works once, in place of your authenticator app, if you lose access to it. This is the only time
        they&apos;ll be shown.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-line bg-paper-50 p-4 font-mono text-sm text-ink-900">
        {codes.map((code) => (
          <span key={code}>{code}</span>
        ))}
      </div>
      <div className="mt-5 flex justify-center gap-3">
        <Button variant="secondary" onClick={copyAll}>
          {copied ? "Copied!" : "Copy all"}
        </Button>
        <Button variant="primary" onClick={onDone}>
          I&apos;ve saved these codes
        </Button>
      </div>
    </div>
  );
}

function SetupModal({ open, onClose, onEnabled }: { open: boolean; onClose: () => void; onEnabled: () => void }) {
  const [step, setStep] = useState<"loading" | "scan" | "backupCodes" | "error">("loading");
  const [secret, setSecret] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep("loading");
    setCode("");
    setError(null);
    fetch("/api/auth/2fa/setup", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Setup failed");
        return res.json();
      })
      .then((data) => {
        setSecret(data.secret);
        setQrCode(data.qrCode);
        setStep("scan");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Couldn't start setup.");
        setStep("error");
      });
  }, [open]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That code didn't match.");
      setBackupCodes(data.backupCodes);
      setStep("backupCodes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    onEnabled();
    onClose();
  }

  const canClose = step !== "backupCodes";

  return (
    <ModalShell open={open} onClose={onClose} canClose={canClose} label="Enable two-factor authentication">
      {step === "loading" && <p className="text-center text-sm text-ink-500">Setting up…</p>}

      {step === "error" && (
        <div className="text-center">
          <p className="text-sm text-crit-600">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      )}

      {step === "scan" && (
        <form onSubmit={handleConfirm}>
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900 text-center">
            Scan this QR code
          </h2>
          <p className="mt-2 text-center text-sm text-ink-700">
            Using Google Authenticator, Authy, or any TOTP app. Then enter the 6-digit code it shows.
          </p>
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCode} alt="Two-factor authentication QR code" className="mx-auto mt-4 h-40 w-40" />
          )}
          <p className="mt-3 break-all rounded-lg border border-line bg-paper-50 px-3 py-2 text-center font-mono text-xs text-ink-700">
            {secret}
          </p>
          <div className="mt-4">
            <Input
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              autoFocus
            />
          </div>
          {error && <p className="mt-2 text-sm text-crit-600">{error}</p>}
          <div className="mt-5 flex justify-center gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? "Confirming…" : "Confirm"}
            </Button>
          </div>
        </form>
      )}

      {step === "backupCodes" && <BackupCodesView codes={backupCodes} onDone={handleDone} />}
    </ModalShell>
  );
}

function PasswordConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  variant = "primary",
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "primary" | "danger";
  onConfirmed: (password: string) => Promise<{ error?: string }>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await onConfirmed(password);
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  return (
    <ModalShell open={open} onClose={onClose} canClose={!submitting} label={title}>
      <form onSubmit={handleSubmit} className="text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">{title}</h2>
        <p className="mt-2 text-sm text-ink-700">{description}</p>
        <div className="mt-4 text-left">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="mt-2 text-sm text-crit-600">{error}</p>}
        <div className="mt-5 flex justify-center gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant={variant} disabled={submitting || !password}>
            {submitting ? "Working…" : confirmLabel}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

export function TwoFactorSection({
  initialEnabled,
  totpConfigured,
}: {
  initialEnabled: boolean;
  totpConfigured: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  async function handleDisable(password: string) {
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Something went wrong." };
    setEnabled(false);
    setDisableOpen(false);
    return {};
  }

  async function handleRegenerate(password: string) {
    const res = await fetch("/api/auth/2fa/backup-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Something went wrong." };
    setRegenerateOpen(false);
    setNewCodes(data.backupCodes);
    return {};
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-base font-bold text-ink-900">
            Two-Factor Authentication
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {enabled
              ? "Enabled — an authenticator app code is required at sign-in."
              : "Add an authenticator-app code as a second step at sign-in."}
          </p>
        </div>
        {enabled ? (
          <span className="whitespace-nowrap rounded-full border border-good-100 bg-good-100 px-3 py-1 text-xs font-semibold text-good-800">
            Enabled
          </span>
        ) : null}
      </div>

      {!totpConfigured ? (
        <p className="mt-3 text-sm text-ink-500">Not configured on this server.</p>
      ) : enabled ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setRegenerateOpen(true)}>
            Regenerate backup codes
          </Button>
          <Button variant="danger" onClick={() => setDisableOpen(true)}>
            Disable
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <Button onClick={() => setSetupOpen(true)}>Enable Two-Factor Authentication</Button>
        </div>
      )}

      <SetupModal open={setupOpen} onClose={() => setSetupOpen(false)} onEnabled={() => setEnabled(true)} />

      <PasswordConfirmModal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="Disable two-factor authentication?"
        description="Your account will only require a password to sign in."
        confirmLabel="Disable"
        variant="danger"
        onConfirmed={handleDisable}
      />

      <PasswordConfirmModal
        open={regenerateOpen}
        onClose={() => setRegenerateOpen(false)}
        title="Regenerate backup codes?"
        description="Your current backup codes will stop working."
        confirmLabel="Regenerate"
        onConfirmed={handleRegenerate}
      />

      <ModalShell
        open={newCodes !== null}
        onClose={() => setNewCodes(null)}
        canClose
        label="New backup codes"
      >
        {newCodes && <BackupCodesView codes={newCodes} onDone={() => setNewCodes(null)} />}
      </ModalShell>
    </Card>
  );
}
