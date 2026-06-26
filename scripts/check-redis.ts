/**
 * Smoke test for the model cache backend (Upstash Redis or in-memory).
 *
 * Verifies which backend is selected and that set/get/del round-trips work with
 * the configured env (REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 *
 * Usage: pnpm check:redis
 */
import { getModelCache } from "../server/_core/modelCache";

async function main() {
  const mode = process.env.REDIS_URL
    ? "ioredis (REDIS_URL)"
    : process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? "Upstash REST"
      : "in-memory (no Redis env set)";
  console.log(`[check:redis] expected backend: ${mode}`);

  const cache = await getModelCache();
  const key = `modelcache:selftest:${Date.now()}`;
  const payload = Buffer.from("ml-cache-ok-" + "x".repeat(64));

  await cache.set(key, payload, 60);
  const got = await cache.get(key);
  const ok = !!got && got.equals(payload);
  await cache.del(key);
  const afterDel = await cache.get(key);

  console.log(`[check:redis] set/get round-trip: ${ok ? "OK" : "FAILED"}`);
  console.log(`[check:redis] del cleared key:    ${afterDel === null ? "OK" : "FAILED"}`);

  if (!ok || afterDel !== null) {
    console.error("[check:redis] ❌ cache backend not working as expected");
    process.exit(1);
  }
  console.log("[check:redis] ✅ cache backend healthy");
  process.exit(0);
}

main().catch((e) => {
  console.error("[check:redis] error:", e?.message ?? e);
  process.exit(1);
});
