/**
 * Simple in-memory job lock / last-run guard (D-03, OPTIMIZATION_PLAN.md).
 *
 * Two scheduling mechanisms are live in parallel: in-process cron (`cron/*`,
 * setInterval) and external Heartbeat HTTP triggers (`scheduled/*`). Until a
 * decision is made about the external Heartbeat service (see plan row D-03),
 * both stay wired — this guard makes the duplicated jobs idempotent so the
 * same work does not run twice on the same instance.
 *
 * In-memory is sufficient here: the double-fire happens between the in-process
 * cron and the HTTP endpoint of the *same* process. There is no jobs/locks
 * table in the schema; add a DB-backed variant if the app ever runs
 * multi-instance.
 */

const lastStartedAt = new Map<string, number>();
const running = new Set<string>();

export interface JobRunResult<T> {
  ran: boolean;
  /** Set when ran === false. */
  reason?: "running" | "recent";
  /** Set when ran === true. */
  result?: T;
}

/**
 * Run `fn` unless the job is currently running or was started less than
 * `minIntervalMinutes` ago. The last-run timestamp is set at start (a failed
 * run still counts as recent, preventing tight retry loops).
 */
export async function runIfNotRecent<T>(
  jobName: string,
  minIntervalMinutes: number,
  fn: () => Promise<T>
): Promise<JobRunResult<T>> {
  if (running.has(jobName)) {
    console.log(`[jobLock] '${jobName}' is already running — skipping`);
    return { ran: false, reason: "running" };
  }
  const last = lastStartedAt.get(jobName);
  const now = Date.now();
  if (last !== undefined && now - last < minIntervalMinutes * 60_000) {
    const agoMin = Math.round((now - last) / 60_000);
    console.log(`[jobLock] '${jobName}' ran ${agoMin}min ago (< ${minIntervalMinutes}min) — skipping`);
    return { ran: false, reason: "recent" };
  }
  running.add(jobName);
  lastStartedAt.set(jobName, now);
  try {
    const result = await fn();
    return { ran: true, result };
  } finally {
    running.delete(jobName);
  }
}
