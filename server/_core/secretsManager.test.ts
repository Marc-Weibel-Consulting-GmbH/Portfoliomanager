import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { encryptSecret, decryptSecret, isLegacyCiphertext } from "./secretsManager";

const HEX_KEY = "a".repeat(64); // 32 bytes as hex
const BASE64_KEY = Buffer.from("b".repeat(32)).toString("base64"); // 32 bytes as base64

describe("secretsManager encryption (A-09)", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-jwt-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips with a hex SECRETS_ENCRYPTION_KEY (v2/GCM)", () => {
    vi.stubEnv("SECRETS_ENCRYPTION_KEY", HEX_KEY);

    const ciphertext = encryptSecret("my-api-key-123");

    expect(ciphertext.startsWith("v2:")).toBe(true);
    expect(isLegacyCiphertext(ciphertext)).toBe(false);
    expect(decryptSecret(ciphertext)).toBe("my-api-key-123");
  });

  it("round-trips with a base64 SECRETS_ENCRYPTION_KEY (v2/GCM)", () => {
    vi.stubEnv("SECRETS_ENCRYPTION_KEY", BASE64_KEY);

    const ciphertext = encryptSecret("wert-äöü-😀");

    expect(ciphertext.startsWith("v2:")).toBe(true);
    expect(decryptSecret(ciphertext)).toBe("wert-äöü-😀");
  });

  it("produces a fresh IV per encryption (different ciphertexts for same value)", () => {
    vi.stubEnv("SECRETS_ENCRYPTION_KEY", HEX_KEY);

    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered v2 ciphertext (GCM auth)", () => {
    vi.stubEnv("SECRETS_ENCRYPTION_KEY", HEX_KEY);

    const ciphertext = encryptSecret("tamper-me");
    const parts = ciphertext.slice(3).split(":");
    const data = Buffer.from(parts[2], "base64");
    data[0] ^= 0xff;
    const tampered = "v2:" + parts[0] + ":" + parts[1] + ":" + data.toString("base64");

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("falls back to legacy CBC when SECRETS_ENCRYPTION_KEY is missing", () => {
    // no SECRETS_ENCRYPTION_KEY stubbed
    vi.stubEnv("SECRETS_ENCRYPTION_KEY", "");

    const ciphertext = encryptSecret("legacy-value");

    expect(ciphertext.startsWith("v2:")).toBe(false);
    expect(isLegacyCiphertext(ciphertext)).toBe(true);
    expect(decryptSecret(ciphertext)).toBe("legacy-value");
  });

  it("falls back to legacy CBC when SECRETS_ENCRYPTION_KEY has an invalid format", () => {
    vi.stubEnv("SECRETS_ENCRYPTION_KEY", "not-a-valid-key");

    const ciphertext = encryptSecret("fallback");

    expect(isLegacyCiphertext(ciphertext)).toBe(true);
    expect(decryptSecret(ciphertext)).toBe("fallback");
  });

  it("still decrypts pre-migration legacy (CBC) values when the v2 key is set", () => {
    // Simulate a value that was stored before the migration, encrypted with
    // AES-256-CBC keyed from SHA-256(JWT_SECRET).
    const legacyKey = crypto.createHash("sha256").update("test-jwt-secret").digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", legacyKey, iv);
    let encrypted = cipher.update("old-secret", "utf8", "hex");
    encrypted += cipher.final("hex");
    const legacyCiphertext = iv.toString("hex") + ":" + encrypted;

    vi.stubEnv("SECRETS_ENCRYPTION_KEY", HEX_KEY);

    expect(isLegacyCiphertext(legacyCiphertext)).toBe(true);
    expect(decryptSecret(legacyCiphertext)).toBe("old-secret");
  });

  it("throws when decrypting a v2 value without SECRETS_ENCRYPTION_KEY", () => {
    vi.stubEnv("SECRETS_ENCRYPTION_KEY", HEX_KEY);
    const ciphertext = encryptSecret("needs-key");

    vi.stubEnv("SECRETS_ENCRYPTION_KEY", "");
    expect(() => decryptSecret(ciphertext)).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });
});
