export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  id: string;
  status: HealthStatus;
  critical: boolean;
  message: string;
  durationMs: number;
  checkedAt: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckDefinition {
  id: string;
  critical?: boolean;
  timeoutMs?: number;
  check: () => Promise<
    Omit<HealthCheckResult, "id" | "critical" | "durationMs" | "checkedAt">
  >;
}

export class HealthRegistry {
  readonly #checks = new Map<string, HealthCheckDefinition>();

  register(definition: HealthCheckDefinition): void {
    if (this.#checks.has(definition.id)) {
      throw new Error(`Health check already registered: ${definition.id}`);
    }
    this.#checks.set(definition.id, definition);
  }

  list(): string[] {
    return [...this.#checks.keys()].sort();
  }

  runAll(): Promise<HealthCheckResult[]> {
    return Promise.all([...this.#checks.values()].map((definition) => this.run(definition)));
  }

  private async run(definition: HealthCheckDefinition): Promise<HealthCheckResult> {
    const started = performance.now();
    const checkedAt = new Date().toISOString();
    const timeoutMs = definition.timeoutMs ?? 2_000;
    let timeout: NodeJS.Timeout | undefined;

    try {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });
      const result = await Promise.race([definition.check(), timeoutPromise]);
      return {
        ...result,
        id: definition.id,
        critical: definition.critical ?? true,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        checkedAt,
      };
    } catch (error) {
      return {
        id: definition.id,
        critical: definition.critical ?? true,
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Unknown health-check failure",
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        checkedAt,
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
