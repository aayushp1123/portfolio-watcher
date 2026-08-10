"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PlaidConnectButton } from "@/components/onboarding/PlaidConnectButton";

export function ConnectStep({ plaidConfigured }: { plaidConfigured: boolean }) {
  const [connected, setConnected] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      {plaidConfigured ? (
        connected ? (
          <p className="text-sm font-medium text-good-600">
            ✓ Brokerage account connected.
          </p>
        ) : (
          <PlaidConnectButton onConnected={() => setConnected(true)} />
        )
      ) : (
        <div className="flex flex-col gap-2">
          <Button type="button" disabled>
            Connect a Brokerage Account
          </Button>
          <p className="text-xs text-ink-500">
            Not configured yet — add your free Plaid Sandbox key in Settings to
            enable this (sign up free at{" "}
            <span className="font-medium">dashboard.plaid.com</span>). You can
            still finish setup and connect later.
          </p>
        </div>
      )}

      <div className="mt-2 flex gap-3">
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          {connected ? "Go to dashboard" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}
