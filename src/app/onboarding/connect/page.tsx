import { Card } from "@/components/ui/Card";
import { ConnectStep } from "@/components/onboarding/ConnectStep";
import { isPlaidConfigured } from "@/lib/plaid";

export default function ConnectOnboardingPage() {
  const plaidConfigured = isPlaidConfigured();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">
        Step 2 of 2
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-ink-900">
        Connect a brokerage account
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        Your reports are built from your own real holdings. In Sandbox mode
        this connects to a free fake test bank — no real account, no cost.
      </p>

      <Card className="mt-6">
        <ConnectStep plaidConfigured={plaidConfigured} />
      </Card>
    </div>
  );
}
