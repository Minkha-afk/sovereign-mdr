import crypto from "crypto";

// Simulated KMS: the key-encryption key (KEK) comes from the environment and never enters MongoDB.
export const KEK_ID = "kms://local/kek-v1";

function kek() {
  const hex = process.env.VAULT_KEK;
  if (hex && hex.length === 64) return Buffer.from(hex, "hex");
  return crypto.createHash("sha256").update("dev-only-kek-change-me").digest();
}

export const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

function seal(key, plaintext, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function open(key, { ciphertext, nonce, authTag }, aad) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64"));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]);
}

// Envelope encryption: a fresh per-person data key (DEK), stored only in wrapped form.
export function newWrappedDek() {
  return seal(kek(), crypto.randomBytes(32));
}

export function encryptPayload(wrappedDek, payload, aad) {
  const dek = open(kek(), wrappedDek);
  const plaintext = Buffer.from(JSON.stringify(payload));
  return {
    ...seal(dek, plaintext, aad),
    plaintextSha256: sha256(plaintext),
    byteSize: plaintext.length,
  };
}

export function decryptPayload(wrappedDek, vaultObject, aad) {
  const dek = open(kek(), wrappedDek);
  const plaintext = open(dek, vaultObject, aad);
  if (sha256(plaintext) !== vaultObject.plaintextSha256) throw new Error("Post-decrypt integrity check failed");
  return JSON.parse(plaintext.toString());
}

// HMAC blind index: lets us find a person by national health ID without storing the ID.
export function blindIndex(healthId) {
  const normalised = String(healthId).replace(/[\s-]/g, "");
  return crypto
    .createHmac("sha256", process.env.BLIND_INDEX_PEPPER || "dev-pepper")
    .update(normalised)
    .digest("hex");
}

export const randomRef = () => `SMR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
