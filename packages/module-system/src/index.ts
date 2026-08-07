import { AppError, Kernel, type BeyondXModule, type ModuleContext, type ModuleManifest } from "@beyondx/core";

export class ModuleRegistry {
  readonly #modules = new Map<string, BeyondXModule>();
  register(module: BeyondXModule): void {
    validateManifest(module.manifest);
    if (this.#modules.has(module.manifest.name)) throw new AppError({ code: "MODULE_DUPLICATE", message: `Module is already registered: ${module.manifest.name}` });
    this.#modules.set(module.manifest.name, module);
  }
  list(): ModuleManifest[] { return [...this.#modules.values()].map((module) => module.manifest); }
  resolveLoadOrder(): BeyondXModule[] {
    const ordered: BeyondXModule[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (name: string, trail: string[]): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) throw new AppError({ code: "MODULE_CIRCULAR_DEPENDENCY", message: `Circular module dependency: ${[...trail, name].join(" -> ")}` });
      const module = this.#modules.get(name);
      if (!module) throw new AppError({ code: "MODULE_MISSING_DEPENDENCY", message: `Required module is not registered: ${name}` });
      visiting.add(name);
      for (const dependency of module.manifest.dependencies) visit(dependency, [...trail, name]);
      visiting.delete(name); visited.add(name); ordered.push(module);
    };
    for (const name of this.#modules.keys()) visit(name, []);
    return ordered;
  }
  async createKernel(context: ModuleContext): Promise<Kernel> {
    const kernel = new Kernel(context);
    for (const module of this.resolveLoadOrder()) await kernel.register(module);
    return kernel;
  }
}

export function validateManifest(manifest: ModuleManifest): void {
  if (!manifest.name.startsWith("@beyondx/")) throw new AppError({ code: "MODULE_INVALID_MANIFEST", message: "Module name must use the @beyondx namespace" });
  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) throw new AppError({ code: "MODULE_INVALID_MANIFEST", message: `Invalid semantic version: ${manifest.version}` });
  for (const field of ["displayName", "description"] as const) if (!manifest[field].trim()) throw new AppError({ code: "MODULE_INVALID_MANIFEST", message: `Manifest field is required: ${field}` });
  const duplicateDependencies = manifest.dependencies.filter((name, index, values) => values.indexOf(name) !== index);
  if (duplicateDependencies.length > 0) throw new AppError({ code: "MODULE_INVALID_MANIFEST", message: `Duplicate module dependencies: ${duplicateDependencies.join(", ")}` });
}
