import crypto from "crypto";

/**
 * Set SECRET_BOX_KEY in your .env.local (any strong string).
 * We derive a 32-byte key via SHA-256.
 */
function keyBuf() {
  const seed = process.env.SECRET_BOX_KEY || "dev-secret-change-me";
  return crypto.createHash("sha256").update(seed).digest(); // 32 bytes
}

/** AES-256-GCM: returns base64(iv | tag | ciphertext) */
export function seal(plain: string): string {
  const key = keyBuf();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt base64(iv | tag | ciphertext); returns null on failure */
export function open(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const key = keyBuf();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** mask e.g. abcdef → ****ef */
export function mask(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 4) return "****";
  return "****" + v.slice(-4);
}
