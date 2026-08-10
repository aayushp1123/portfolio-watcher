"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/Button";

export function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    fetch("/api/plaid/link-token")
      .then((r) => r.json())
      .then((data) => {
        if (data.linkToken) setLinkToken(data.linkToken);
        else setError(data.error ?? "Could not start Plaid Link");
      })
      .catch(() => setError("Could not start Plaid Link"));
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string | null) => {
      if (!publicToken) return;
      setExchanging(true);
      setError(null);
      const res = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not connect that account");
        setExchanging(false);
        return;
      }
      onConnected();
    },
    [onConnected]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={() => open()}
        disabled={!ready || !linkToken || exchanging}
      >
        {exchanging ? "Connecting…" : "Connect a Brokerage Account (Sandbox)"}
      </Button>
      {error && <p className="text-sm text-crit-600">{error}</p>}
      <p className="text-xs text-ink-500">
        This opens Plaid&apos;s Sandbox — pick any test institution and log in
        with username <code className="rounded bg-paper-50 px-1">user_good</code> /
        password <code className="rounded bg-paper-50 px-1">pass_good</code>.
        No real account is ever touched.
      </p>
    </div>
  );
}
