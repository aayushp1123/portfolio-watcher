import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

/**
 * Whether brokerage linking is enabled. False whenever PLAID_CLIENT_ID or
 * PLAID_SECRET is unset — the Connect Brokerage UI must show a disabled,
 * explained state rather than attempting a call that would just fail.
 */
export function isPlaidConfigured(): boolean {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function getPlaidClient(): PlaidApi {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured");
  }
  const env = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(configuration);
}
