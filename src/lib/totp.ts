import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const ISSUER = "Portfolio Watcher";
/** ±30s clock-drift tolerance (one step either side of the current 30s window). */
const EPOCH_TOLERANCE_SECONDS = 30;

export function isTotpConfigured(): boolean {
  return !!process.env.TOTP_SECRET_ENCRYPTION_KEY;
}

export function generateTotpSecret(): string {
  return generateSecret();
}

/** Data-URI QR code encoding the otpauth:// URI, ready for an <img src>. */
export async function getTotpQrCode(email: string, secret: string): Promise<string> {
  const uri = generateURI({ issuer: ISSUER, label: email, secret });
  return QRCode.toDataURL(uri);
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS });
  return result.valid;
}

const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const BACKUP_CODE_COUNT = 10;

function randomBackupCode(): string {
  const chars = Array.from({ length: 8 }, () => {
    const i = crypto.randomInt(BACKUP_CODE_ALPHABET.length);
    return BACKUP_CODE_ALPHABET[i];
  }).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Generates a fresh set of plaintext backup codes -- callers must hash each
 * with hashBackupCode() before storing, and show the plaintext to the user
 * exactly once (it's never recoverable after this). */
export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, randomBackupCode);
}

export async function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(code.toUpperCase(), 12);
}

/** Checks `code` against a list of {id, codeHash} candidates (unused backup
 * codes for the user), returning the matching id if found. Callers should
 * mark that id as used (usedAt) so it can't be replayed. */
export async function findMatchingBackupCode(
  code: string,
  candidates: Array<{ id: string; codeHash: string }>
): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  for (const candidate of candidates) {
    if (await bcrypt.compare(normalized, candidate.codeHash)) {
      return candidate.id;
    }
  }
  return null;
}
