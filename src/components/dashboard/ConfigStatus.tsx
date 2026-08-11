import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

export function ConfigStatus({
  aiConfigured,
  plaidConfigured,
}: {
  aiConfigured: boolean;
  plaidConfigured: boolean;
}) {
  return (
    <Card>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-ink-900">
        Setup Status
      </h2>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5">
          <div>
            <p className="font-medium text-ink-900">Brokerage Connection (Plaid)</p>
            <p className="text-sm text-ink-500">
              {plaidConfigured
                ? "Configured — you can connect accounts."
                : "Add PLAID_CLIENT_ID and PLAID_SECRET to .env (free Sandbox signup at dashboard.plaid.com)."}
            </p>
          </div>
          <Pill tone={plaidConfigured ? "good" : "neutral"}>
            {plaidConfigured ? "Configured" : "Not Configured"}
          </Pill>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5">
          <div>
            <p className="font-medium text-ink-900">AI Reports (Gemini)</p>
            <p className="text-sm text-ink-500">
              {aiConfigured
                ? "Configured — report generation and the daily/weekly schedule are active."
                : "Add GEMINI_API_KEY to .env when you're ready (aistudio.google.com/apikey — free tier, no billing required)."}
            </p>
          </div>
          <Pill tone={aiConfigured ? "good" : "neutral"}>
            {aiConfigured ? "Configured" : "Not Configured"}
          </Pill>
        </div>
      </div>
    </Card>
  );
}
