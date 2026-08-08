import { AppError } from "./errors.js";
import type { BeyondXModule, ModuleContext, ModuleRuntimeStatus } from "./module.js";

export class Kernel {
  readonly #modules: BeyondXModule[] = [];
  readonly #modulesByName = new Map<string, BeyondXModule>();
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
    this.#modulesByName.set(module.manifest.name, module);
    this.#statuses.set(module.manifest.name, {
      name: module.manifest.name,
      version: module.manifest.version,
      state: "registered",
    });
  }

  async boot(names?: ReadonlySet<string>): Promise<void> {
    for (const module of this.#modules) {
      if (names && !names.has(module.manifest.name)) continue;
      await this.activate(module.manifest.name);
    }
  }

  async activate(name: string): Promise<void> {
    const module = this.requireModule(name);
    const current = this.#statuses.get(name);
    if (current?.state === "active") return;
    if (current?.state === "booting" || current?.state === "stopping") {
      throw new AppError({
        code: "MODULE_LIFECYCLE_BUSY",
        message: `Module lifecycle operation is already in progress: ${name}`,
        statusCode: 409,
      });
    }

    for (const dependency of module.manifest.dependencies) {
      const dependencyState = this.#statuses.get(dependency)?.state;
      if (dependencyState !== "active") {
        throw new AppError({
          code: "MODULE_DEPENDENCY_INACTIVE",
          message: `${name} requires active module ${dependency}`,
          statusCode: 409,
          details: { module: name, dependency, dependencyState },
        });
      }
    }

    this.#statuses.set(name, {
      name,
      version: module.manifest.version,
      state: "booting",
    });

    try {
      await module.boot(this.context);
      this.#statuses.set(name, {
        name,
        version: module.manifest.version,
        state: "active",
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error("Unknown module boot failure");
      this.#statuses.set(name, {
        name,
        version: module.manifest.version,
        state: "failed",
        error: normalizedError.message,
      });
      throw normalizedError;
    }
  }

  async deactivate(name: string): Promise<void> {
    const module = this.requireModule(name);
    const current = this.#statuses.get(name);
    if (current?.state === "registered" || current?.state === "stopped") return;
    if (current?.state !== "active" && current?.state !== "failed") {
      throw new AppError({
        code: "MODULE_LIFECYCLE_BUSY",
        message: `Module cannot be stopped from state ${current?.state ?? "unknown"}: ${name}`,
        statusCode: 409,
      });
    }

    this.#statuses.set(name, {
      name,
      version: module.manifest.version,
      state: "stopping",
    });

    try {
      await module.shutdown?.(this.context);
      this.#statuses.set(name, {
        name,
        version: module.manifest.version,
        state: "stopped",
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error("Unknown module shutdown failure");
      this.#statuses.set(name, {
        name,
        version: module.manifest.version,
        state: "failed",
        error: normalizedError.message,
      });
      throw normalizedError;
    }
  }

  async shutdown(): Promise<void> {
    for (const module of [...this.#modules].reverse()) {
      if (this.#statuses.get(module.manifest.name)?.state !== "active") continue;
      await this.deactivate(module.manifest.name);
    }
  }

  listModules(): ModuleRuntimeStatus[] {
    return [...this.#statuses.values()];
  }

  private requireModule(name: string): BeyondXModule {
    const module = this.#modulesByName.get(name);
    if (!module) {
      throw new AppError({
        code: "MODULE_NOT_REGISTERED",
        message: `Module is not registered in the kernel: ${name}`,
        statusCode: 404,
      });
    }
    return module;
  }
}
