import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export function encryptionKey() {
  const value = process.env.RCP_TOKEN_ENCRYPTION_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value))
    throw new Error("RCP_TOKEN_ENCRYPTION_KEY must be a 32-byte hex key.");
  return Buffer.from(value, "hex");
}
export function newSessionId() {
  return randomBytes(32).toString("base64url");
}
export function sessionHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function encryptToken(
  token: string,
  userId: string,
  key = encryptionKey(),
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId));
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptToken(
  value: string,
  userId: string,
  key = encryptionKey(),
) {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra)
    throw new Error("Invalid encrypted credential.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
