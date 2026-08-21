/** Standardisierte asynchrone Grenze für externe Provideraufrufe. */
export function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expiration = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([operation, expiration]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}
