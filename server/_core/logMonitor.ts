/**
 * In-memory log monitoring system
 * Captures console.error, console.warn, and uncaught exceptions
 */

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "error" | "warn" | "info";
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

const MAX_LOGS = 500; // Keep last 500 log entries
const logs: LogEntry[] = [];

let logIdCounter = 0;

function generateLogId(): string {
  return `log_${Date.now()}_${logIdCounter++}`;
}

function addLog(entry: Omit<LogEntry, "id" | "timestamp">): void {
  const logEntry: LogEntry = {
    id: generateLogId(),
    timestamp: new Date(),
    ...entry,
  };

  logs.unshift(logEntry); // Add to beginning

  // Keep only last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs.pop();
  }
}

// Capture console.error
const originalError = console.error;
console.error = (...args: any[]) => {
  originalError.apply(console, args);

  const message = args.map(arg => 
    typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(" ");

  const stack = new Error().stack;

  addLog({
    level: "error",
    message,
    stack,
  });
};

// Capture console.warn
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  originalWarn.apply(console, args);

  const message = args.map(arg => 
    typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(" ");

  addLog({
    level: "warn",
    message,
  });
};

// Capture uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  addLog({
    level: "error",
    message: `Uncaught Exception: ${error.message}`,
    stack: error.stack,
    context: {
      name: error.name,
    },
  });
});

// Capture unhandled promise rejections
process.on("unhandledRejection", (reason: any) => {
  const message = reason instanceof Error 
    ? reason.message 
    : String(reason);

  const stack = reason instanceof Error 
    ? reason.stack 
    : undefined;

  addLog({
    level: "error",
    message: `Unhandled Promise Rejection: ${message}`,
    stack,
  });
});

export function getLogs(options?: {
  level?: "error" | "warn" | "info";
  limit?: number;
  since?: Date;
}): LogEntry[] {
  let filtered = logs;

  if (options?.level) {
    filtered = filtered.filter(log => log.level === options.level);
  }

  if (options?.since) {
    filtered = filtered.filter(log => log.timestamp >= options.since);
  }

  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

export function clearLogs(): void {
  logs.length = 0;
  logIdCounter = 0;
}

export function getLogStats(): {
  total: number;
  errors: number;
  warnings: number;
  oldestLog?: Date;
  newestLog?: Date;
} {
  return {
    total: logs.length,
    errors: logs.filter(log => log.level === "error").length,
    warnings: logs.filter(log => log.level === "warn").length,
    oldestLog: logs[logs.length - 1]?.timestamp,
    newestLog: logs[0]?.timestamp,
  };
}

// Log system startup
console.log("[Log Monitor] Initialized - capturing console.error, console.warn, and uncaught exceptions");
