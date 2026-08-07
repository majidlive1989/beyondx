import type { PlatformLogger } from "@beyondx/core";

export interface CapturedLog {
  level: "debug" | "info" | "warn" | "error";
  bindings: Record<string, unknown>;
  message: string;
}

export function createCapturingLogger(): {
  logger: PlatformLogger;
  logs: CapturedLog[];
} {
  const logs: CapturedLog[] = [];
  const write =
    (level: CapturedLog["level"]) =>
    (bindings: Record<string, unknown>, message: string): void => {
      logs.push({ level, bindings, message });
    };

  return {
    logger: {
      debug: write("debug"),
      info: write("info"),
      warn: write("warn"),
      error: write("error"),
    },
    logs,
  };
}

export async function eventually(
  assertion: () => void,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 1_000;
  const intervalMs = options.intervalMs ?? 10;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() <= deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The assertion did not pass before the timeout");
}
