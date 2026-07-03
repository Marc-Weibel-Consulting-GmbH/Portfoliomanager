import crypto from "crypto";
import { eq } from "drizzle-orm";
import { appSecrets } from "../../drizzle/schema";
import { getDb } from "../db";

// ---------------------------------------------------------------------------
// Encryption scheme (A-09)
//
// v2 (current): AES-256-GCM (authenticated) with a DEDICATED key from the
//   SECRETS_ENCRYPTION_KEY env var. Accepted formats: 32 bytes encoded as
//   hex (64 chars, e.g. `openssl rand -hex 32`) or base64 (44 chars).
//   Ciphertext format: "v2:<iv b64>:<authTag b64>:<data b64>".
//
// Legacy: AES-256-CBC keyed with SHA-256(JWT_SECRET), format "<iv hex>:<hex>".
//   Kept for DECRYPTING pre-migration rows only. Re-encryption is lazy: when
//   getSecret() successfully decrypts a legacy value and a v2 key is set, the
//   row is re-encrypted with v2 and updated in place.
//
// If SECRETS_ENCRYPTION_KEY is missing (or malformed) we log a warning once
// and keep full legacy behavior (encrypt + decrypt via CBC) so boot never
// breaks on existing deployments.
// ---------------------------------------------------------------------------

const V2_PREFIX = "v2:";
let warnedNoV2Key = false;

function getV2Key(): Buffer | null {
  const raw = (process.env.SECRETS_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    if (!warnedNoV2Key) {
      warnedNoV2Key = true;
      console.warn(
        "[Secrets] SECRETS_ENCRYPTION_KEY is not set — falling back to legacy AES-256-CBC keyed from JWT_SECRET. " +
          "Generate a dedicated key with `openssl rand -hex 32` and set SECRETS_ENCRYPTION_KEY."
      );
    }
    return null;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) {
    return b64;
  }
  if (!warnedNoV2Key) {
    warnedNoV2Key = true;
    console.warn(
      "[Secrets] SECRETS_ENCRYPTION_KEY has an invalid format (expected 32 bytes as hex or base64) — " +
        "falling back to legacy AES-256-CBC encryption."
    );
  }
  return null;
}

// Legacy key derivation: SHA-256(JWT_SECRET) — decrypt path for old rows,
// and encrypt fallback when no SECRETS_ENCRYPTION_KEY is configured.
function getLegacyEncryptionKey(): Buffer {
  const jwtSecret = process.env.JWT_SECRET || "";
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured - cannot encrypt/decrypt secrets");
  }
  return crypto.createHash("sha256").update(jwtSecret).digest();
}

function legacyEncrypt(value: string): string {
  const key = getLegacyEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

function legacyDecrypt(encryptedValue: string): string {
  const key = getLegacyEncryptionKey();
  const parts = encryptedValue.split(":");

  if (parts.length !== 2) {
    throw new Error("Invalid encrypted value format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/** True if the ciphertext predates the v2 (GCM) scheme. */
export function isLegacyCiphertext(encryptedValue: string): boolean {
  return !encryptedValue.startsWith(V2_PREFIX);
}

/**
 * Encrypt a secret value. Uses AES-256-GCM with SECRETS_ENCRYPTION_KEY when
 * configured; otherwise falls back to the legacy CBC scheme (with a warning).
 */
export function encryptSecret(value: string): string {
  const key = getV2Key();
  if (!key) {
    return legacyEncrypt(value);
  }

  const iv = crypto.randomBytes(12); // 96-bit nonce, recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return (
    V2_PREFIX +
    iv.toString("base64") +
    ":" +
    authTag.toString("base64") +
    ":" +
    encrypted.toString("base64")
  );
}

/**
 * Decrypt a secret value. "v2:"-prefixed values use AES-256-GCM with
 * SECRETS_ENCRYPTION_KEY; anything else goes through the legacy CBC path.
 */
export function decryptSecret(encryptedValue: string): string {
  if (isLegacyCiphertext(encryptedValue)) {
    return legacyDecrypt(encryptedValue);
  }

  const key = getV2Key();
  if (!key) {
    throw new Error("SECRETS_ENCRYPTION_KEY is required to decrypt v2 secrets");
  }

  const parts = encryptedValue.slice(V2_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid v2 encrypted value format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const data = Buffer.from(parts[2], "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/**
 * Get a secret from database (with process.env fallback)
 */
export async function getSecret(key: string): Promise<string | undefined> {
  // First try process.env (for platform-managed secrets)
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }
  
  // Then try database (for user-defined secrets)
  const db = await getDb();
  if (!db) {
    console.warn(`[Secrets] Cannot get secret ${key}: database not available`);
    return undefined;
  }
  
  try {
    const result = await db
      .select()
      .from(appSecrets)
      .where(eq(appSecrets.key, key))
      .limit(1);
    
    if (result.length === 0) {
      return undefined;
    }

    const stored = result[0].encryptedValue;
    const value = decryptSecret(stored);

    // Lazy re-encryption (A-09): legacy CBC rows are upgraded to v2 (GCM) on
    // first successful read, provided a SECRETS_ENCRYPTION_KEY is configured.
    if (isLegacyCiphertext(stored) && getV2Key()) {
      try {
        await db
          .update(appSecrets)
          .set({ encryptedValue: encryptSecret(value), updatedAt: new Date() })
          .where(eq(appSecrets.key, key));
        console.log(`[Secrets] Re-encrypted legacy secret ${key} with v2 (AES-256-GCM)`);
      } catch (error) {
        console.error(`[Secrets] Failed to re-encrypt legacy secret ${key}:`, error);
      }
    }

    return value;
  } catch (error) {
    console.error(`[Secrets] Failed to get secret ${key}:`, error);
    return undefined;
  }
}

/**
 * Set a secret in database (encrypted)
 */
export async function setSecret(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  
  const encryptedValue = encryptSecret(value);
  
  // Upsert (insert or update if exists)
  await db
    .insert(appSecrets)
    .values({
      key,
      encryptedValue,
      description: description || null,
    })
    .onDuplicateKeyUpdate({
      set: {
        encryptedValue,
        description: description || null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Delete a secret from database
 */
export async function deleteSecret(key: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  
  await db.delete(appSecrets).where(eq(appSecrets.key, key));
}

/**
 * List all secret keys (without values)
 */
export async function listSecretKeys(): Promise<
  Array<{ key: string; description: string | null; updatedAt: Date }>
> {
  const db = await getDb();
  if (!db) {
    return [];
  }
  
  const results = await db
    .select({
      key: appSecrets.key,
      description: appSecrets.description,
      updatedAt: appSecrets.updatedAt,
    })
    .from(appSecrets);
  
  return results;
}
