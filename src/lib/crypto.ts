import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const DEFAULT_KEY_ENV_VAR = "PLAID_TOKEN_ENCRYPTION_KEY";

function getKey(envVar: string): Buffer {
  const hex = process.env[envVar];
  if (!hex || hex.length !== 64) {
    throw new Error(`${envVar} must be a 32-byte hex string (64 chars)`);
  }
  return Buffer.from(hex, "hex");
}

/** Encrypts a string (e.g. a Plaid access token, or a TOTP secret) for storage.
 * Format: iv:authTag:ciphertext, all hex. Different secret types should use a
 * dedicated key (envVar) rather than sharing one, e.g. TOTP_SECRET_ENCRYPTION_KEY. */
export function encrypt(plaintext: string, envVar: string = DEFAULT_KEY_ENV_VAR): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(envVar), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decrypt(payload: string, envVar: string = DEFAULT_KEY_ENV_VAR): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(envVar), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
