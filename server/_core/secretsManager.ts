import crypto from "crypto";
import { eq } from "drizzle-orm";
import { appSecrets } from "../../drizzle/schema";
import { getDb } from "../db";

// Use JWT_SECRET as encryption key (must be exactly 32 bytes for AES-256)
function getEncryptionKey(): Buffer {
  const jwtSecret = process.env.JWT_SECRET || "";
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured - cannot encrypt/decrypt secrets");
  }
  // Create a 32-byte key from JWT_SECRET using SHA-256
  return crypto.createHash("sha256").update(jwtSecret).digest();
}

/**
 * Encrypt a secret value using AES-256-CBC
 */
export function encryptSecret(value: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // Initialization vector
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  // Return IV + encrypted data (IV needed for decryption)
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt a secret value using AES-256-CBC
 */
export function decryptSecret(encryptedValue: string): string {
  const key = getEncryptionKey();
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
    
    return decryptSecret(result[0].encryptedValue);
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
