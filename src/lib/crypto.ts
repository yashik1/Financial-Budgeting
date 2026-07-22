import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Application-level encryption for secrets at rest (Plaid access tokens,
// SnapTrade user secrets). AES-256-GCM (authenticated encryption).
//
// The key comes from ENCRYPTION_KEY (64 hex chars = 32 bytes). Generate one:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Production note: prefer a managed KMS (AWS KMS, GCP KMS, Vault) that does
// envelope encryption and key rotation. This module keeps the same call sites
// (encryptSecret/decryptSecret) so swapping the backend is localized here.

const ALGO = "aes-256-gcm";

export function isEncryptionConfigured(): boolean {
  const k = process.env.ENCRYPTION_KEY;
  return !!k && /^[0-9a-fA-F]{64}$/.test(k);
}

function key(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || !/^[0-9a-fA-F]{64}$/.test(k)) {
    throw new Error(
      "ENCRYPTION_KEY missing or invalid (need 64 hex chars). Required to store provider credentials.",
    );
  }
  return Buffer.from(k, "hex");
}

/** Returns "iv:authTag:ciphertext", all hex. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed encrypted payload.");
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
