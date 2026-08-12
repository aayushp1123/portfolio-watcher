"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, deleting]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Something went wrong — your account was not deleted. Try again.");
      setDeleting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ animation: "modal-backdrop-in 180ms ease-out" }}
      onClick={() => !deleting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Delete account confirmation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line bg-paper-0 p-6 text-center shadow-2xl"
        style={{ animation: "modal-panel-in 220ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "var(--crit-100)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              style={{ stroke: "var(--crit-600)" }}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
          Delete your account?
        </h2>
        <p className="mt-2 text-sm text-ink-700">
          This permanently deletes your account and everything in it — holdings connections, reports, watchlist,
          goals, and exit rules. This can&apos;t be undone.
        </p>

        {error && <p className="mt-3 text-sm text-crit-600">{error}</p>}

        <div className="mt-5 flex justify-center gap-3">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete Account"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-10 flex justify-center pb-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-[family-name:var(--font-heading)] text-sm text-ink-500 underline decoration-line underline-offset-4 hover:text-crit-600"
      >
        Delete your account
      </button>
      <DeleteAccountModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
