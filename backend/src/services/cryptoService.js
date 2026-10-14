import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function encryptField(plaintext) {
  const key = process.env.DATA_ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/i.test(key || ""))
    throw Error("Valid DATA_ENCRYPTION_KEY required");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}
export function decryptField(payload) {
  const [iv, tag, ciphertext] = payload.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.DATA_ENCRYPTION_KEY, "hex"),
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
