import { webcrypto } from "node:crypto";

export interface EncryptedPayload {
  encrypted: true;
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return webcrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

export async function encryptJson(value: unknown, passphrase: string): Promise<EncryptedPayload> {
  if (!passphrase) {
    throw new Error("PAGE_ACCESS_PASSPHRASE is required when BRIEF_ENCRYPTION_ENABLED=true");
  }
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const iterations = 250_000;
  const key = await deriveKey(passphrase, salt, iterations);
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded));
  return {
    encrypted: true,
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export function publicPreview<T extends { date: string; one_liner: string; is_low_signal_day: boolean; encryption_enabled: boolean }>(brief: T) {
  return {
    date: brief.date,
    one_liner: brief.one_liner,
    is_low_signal_day: brief.is_low_signal_day,
    encryption_enabled: brief.encryption_enabled,
  };
}
