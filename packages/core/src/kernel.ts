import { AppError } from "./errors.js";
import type { BeyondXModule, ModuleContext, ModuleRuntimeStatus } from "./module.js";

export class Kernel {
  readonly #modules: BeyondXModule[] = [];
  readonly #statuses = new Map<string, ModuleRuntimeStatus>();

  constructor(private readonly context: ModuleContext) {}

  async register(module: BeyondXModule): Promise<void> {
    if (this.#statuses.has(module.manifest.name)) {
      throw new AppError({
        code: "MODULE_DUPLICATE",
        message: `Module is already registered in the kernel: ${module.manifest.name}`,
      });
    }

    await module.register(this.context);
    this.#modules.push(module);
    this.#statuses.set(module.manifest.name, {
      name: module.manifest.name,
      version: module.manifest.version,
      state: "registered",
    });
  }

  async boot(): Promise<void> {
    for (const module of this.#modules) {
      this.#statuses.set(module.manifest.name, {
        name: module.manifest.name,
        version: module.manifest.version,
        state: "booting",
      });

      try {
        await module.boot(this.context);
        this.#statuses.set(module.manifest.name, {
          name: module.manifest.name,
          version: module.manifest.version,
          state: "active",
        });
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error("Unknown module boot failure");
        this.#statuses.set(module.manifest.name, {
          name: module.manifest.name,
          version: module.manifest.version,
          state: "failed",
          error: normalizedError.message,
        });
        throw normalizedError;
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const module of [...this.#modules].reverse()) {
      this.#statuses.set(module.manifest.name, {
        name: module.manifest.name,
        version: module.manifest.version,
        state: "stopping",
      });
      await module.shutdown?.(this.context);
      this.#statuses.set(module.manifest.name, {
        name: module.manifest.name,
        version: module.manifest.version,
        state: "stopped",
      });
    }
  }

  listModules(): ModuleRuntimeStatus[] {
    return [...this.#statuses.values()];
  }
}
