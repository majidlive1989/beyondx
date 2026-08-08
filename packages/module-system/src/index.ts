import {
  AppError,
  Kernel,
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
} from "@beyondx/core";

export class ModuleRegistry {
  readonly #modules = new Map<string, BeyondXModule>();

  register(module: BeyondXModule): void {
    validateManifest(module.manifest);
    if (this.#modules.has(module.manifest.name)) {
      throw new AppError({
        code: "MODULE_DUPLICATE",
        message: `Module is already registered: ${module.manifest.name}`,
      });
    }
    this.#modules.set(module.manifest.name, module);
  }

  list(): ModuleManifest[] {
    return [...this.#modules.values()].map((module) => module.manifest);
  }

  resolveLoadOrder(): BeyondXModule[] {
    const ordered: BeyondXModule[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (name: string, trail: string[]): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new AppError({
          code: "MODULE_CIRCULAR_DEPENDENCY",
          message: `Circular module dependency: ${[...trail, name].join(" -> ")}`,
        });
      }
      const module = this.#modules.get(name);
      if (!module) {
        throw new AppError({
          code: "MODULE_MISSING_DEPENDENCY",
          message: `Required module is not registered: ${name}`,
        });
      }
      visiting.add(name);
      for (const dependency of module.manifest.dependencies) {
        visit(dependency, [...trail, name]);
      }
      visiting.delete(name);
      visited.add(name);
      ordered.push(module);
    };

    for (const name of this.#modules.keys()) visit(name, []);
    return ordered;
  }

  async createKernel(
    context: ModuleContext,
    options: { bootNames?: ReadonlySet<string> } = {},
  ): Promise<Kernel> {
    const kernel = new Kernel(context);
    for (const module of this.resolveLoadOrder()) await kernel.register(module);
    await kernel.boot(options.bootNames);
    return kernel;
  }
}

export function validateManifest(manifest: ModuleManifest): void {
  if (!manifest.name.startsWith("@beyondx/")) {
    throw new AppError({
      code: "MODULE_INVALID_MANIFEST",
      message: "Module name must use the @beyondx namespace",
    });
  }
  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    throw new AppError({
      code: "MODULE_INVALID_MANIFEST",
      message: `Invalid semantic version: ${manifest.version}`,
    });
  }
  for (const field of ["displayName", "description"] as const) {
    if (!manifest[field].trim()) {
      throw new AppError({
        code: "MODULE_INVALID_MANIFEST",
        message: `Manifest field is required: ${field}`,
      });
    }
  }
  const duplicateDependencies = manifest.dependencies.filter(
    (name, index, values) => values.indexOf(name) !== index,
  );
  if (duplicateDependencies.length > 0) {
    throw new AppError({
      code: "MODULE_INVALID_MANIFEST",
      message: `Duplicate module dependencies: ${duplicateDependencies.join(", ")}`,
    });
  }
}

export interface PluginPermissionDefinition {
  id: string;
  description: string;
}

export interface PluginAdminNavigationItem {
  group: string;
  href: string;
  label: string;
  permission?: string;
  exact?: boolean;
}

export interface PluginManifest {
  id: string;
  packageName: string;
  displayName: string;
  version: string;
  description: string;
  requiredModules: string[];
  pluginDependencies: string[];
  permissions: PluginPermissionDefinition[];
  capabilities: string[];
  adminNavigation: PluginAdminNavigationItem[];
}

export interface PluginDefinition {
  manifest: PluginManifest;
  createModule(): BeyondXModule;
}

export interface PluginInstallationRecord {
  packageName: string;
  version: string;
  enabled: boolean;
  installedAt: Date;
  updatedAt: Date;
}

export interface PluginStateStore {
  list(): Promise<PluginInstallationRecord[]>;
  find(packageName: string): Promise<PluginInstallationRecord | null>;
  install(packageName: string, version: string): Promise<PluginInstallationRecord>;
  setEnabled(packageName: string, enabled: boolean): Promise<PluginInstallationRecord>;
  uninstall(packageName: string): Promise<void>;
}

export interface PluginRuntimeState {
  id: string;
  packageName: string;
  displayName: string;
  version: string;
  description: string;
  installed: boolean;
  enabled: boolean;
  active: boolean;
  restartRequired: boolean;
  requiredModules: string[];
  pluginDependencies: string[];
  capabilities: string[];
  adminNavigation: PluginAdminNavigationItem[];
}

export class PluginRegistry {
  readonly #definitions = new Map<string, PluginDefinition>();
  readonly #packageNames = new Map<string, string>();

  register(definition: PluginDefinition): void {
    validatePluginManifest(definition.manifest);
    const { id, packageName } = definition.manifest;
    if (this.#definitions.has(id) || this.#packageNames.has(packageName)) {
      throw new AppError({
        code: "PLUGIN_DUPLICATE",
        message: `Plugin is already registered: ${id}`,
      });
    }
    this.#definitions.set(id, definition);
    this.#packageNames.set(packageName, id);
  }

  list(): PluginDefinition[] {
    return [...this.#definitions.values()].sort((left, right) =>
      left.manifest.displayName.localeCompare(right.manifest.displayName),
    );
  }

  get(id: string): PluginDefinition {
    const definition = this.#definitions.get(id);
    if (!definition) {
      throw new AppError({
        code: "PLUGIN_NOT_FOUND",
        message: `Plugin is not available: ${id}`,
        statusCode: 404,
      });
    }
    return definition;
  }

  getByPackageName(packageName: string): PluginDefinition | undefined {
    const id = this.#packageNames.get(packageName);
    return id ? this.#definitions.get(id) : undefined;
  }
}

export interface PluginLifecycleController {
  activate(packageName: string): Promise<void>;
  deactivate(packageName: string): Promise<void>;
}

export class PluginRuntime {
  readonly #activePackages = new Set<string>();
  #lifecycle: PluginLifecycleController | null = null;

  constructor(
    readonly registry: PluginRegistry,
    private readonly store: PluginStateStore,
  ) {}

  attachLifecycle(controller: PluginLifecycleController): void {
    this.#lifecycle = controller;
  }

  isActivePackage(packageName: string): boolean {
    return this.#activePackages.has(packageName);
  }

  setActivePackages(packageNames: Iterable<string>): void {
    this.#activePackages.clear();
    for (const packageName of packageNames) this.#activePackages.add(packageName);
  }

  async enabledPackageNames(): Promise<string[]> {
    const installations = await this.store.list();
    return installations
      .filter((installation) => installation.enabled)
      .map((installation) => installation.packageName);
  }

  resolveAvailableModules(availableModules: readonly string[]): BeyondXModule[] {
    const availableModuleSet = new Set(availableModules);
    const definitions = this.registry.list();

    for (const definition of definitions) {
      for (const requiredModule of definition.manifest.requiredModules) {
        if (!availableModuleSet.has(requiredModule)) {
          throw new AppError({
            code: "PLUGIN_MISSING_MODULE_DEPENDENCY",
            message: `${definition.manifest.displayName} requires module ${requiredModule}`,
            details: { plugin: definition.manifest.id, requiredModule },
          });
        }
      }
    }

    return resolvePluginLoadOrder(definitions).map((definition) => definition.createModule());
  }

  async resolveEnabledModules(availableModules: readonly string[]): Promise<BeyondXModule[]> {
    const installations = await this.store.list();
    const installedByPackage = new Map(
      installations.map((installation) => [installation.packageName, installation]),
    );
    const enabledDefinitions = this.registry.list().filter(
      (definition) => installedByPackage.get(definition.manifest.packageName)?.enabled === true,
    );

    const availableModuleSet = new Set(availableModules);
    for (const definition of enabledDefinitions) {
      for (const requiredModule of definition.manifest.requiredModules) {
        if (!availableModuleSet.has(requiredModule)) {
          throw new AppError({
            code: "PLUGIN_MISSING_MODULE_DEPENDENCY",
            message: `${definition.manifest.displayName} requires module ${requiredModule}`,
            details: { plugin: definition.manifest.id, requiredModule },
          });
        }
      }
    }

    return resolvePluginLoadOrder(enabledDefinitions).map((definition) => definition.createModule());
  }

  async listStates(): Promise<PluginRuntimeState[]> {
    const installations = await this.store.list();
    const installedByPackage = new Map(
      installations.map((installation) => [installation.packageName, installation]),
    );

    return this.registry.list().map((definition) => {
      const { manifest } = definition;
      const installation = installedByPackage.get(manifest.packageName);
      const installed = installation !== undefined;
      const enabled = installation?.enabled === true;
      const active = this.#activePackages.has(manifest.packageName);
      return {
        id: manifest.id,
        packageName: manifest.packageName,
        displayName: manifest.displayName,
        version: manifest.version,
        description: manifest.description,
        installed,
        enabled,
        active,
        restartRequired: false,
        requiredModules: [...manifest.requiredModules],
        pluginDependencies: [...manifest.pluginDependencies],
        capabilities: [...manifest.capabilities],
        adminNavigation: active ? manifest.adminNavigation.map((item) => ({ ...item })) : [],
      };
    });
  }

  async install(id: string): Promise<PluginRuntimeState> {
    const definition = this.registry.get(id);
    await this.assertPluginDependenciesInstalled(definition);
    await this.store.install(definition.manifest.packageName, definition.manifest.version);
    return this.requireState(id);
  }

  async enable(id: string): Promise<PluginRuntimeState> {
    const definition = this.registry.get(id);
    const installation = await this.store.find(definition.manifest.packageName);
    if (!installation) {
      throw new AppError({
        code: "PLUGIN_NOT_INSTALLED",
        message: `${definition.manifest.displayName} must be installed before it can be enabled`,
        statusCode: 409,
      });
    }
    await this.assertPluginDependenciesEnabled(definition);
    const lifecycle = this.requireLifecycle();

    await this.store.setEnabled(definition.manifest.packageName, true);
    try {
      await lifecycle.activate(definition.manifest.packageName);
      this.#activePackages.add(definition.manifest.packageName);
    } catch (error) {
      await this.store.setEnabled(definition.manifest.packageName, false).catch(() => undefined);
      this.#activePackages.delete(definition.manifest.packageName);
      throw error;
    }
    return this.requireState(id);
  }

  async disable(id: string): Promise<PluginRuntimeState> {
    const definition = this.registry.get(id);
    await this.assertNoEnabledDependants(definition);
    const installation = await this.store.find(definition.manifest.packageName);
    if (!installation) {
      throw new AppError({
        code: "PLUGIN_NOT_INSTALLED",
        message: `${definition.manifest.displayName} is not installed`,
        statusCode: 409,
      });
    }

    const lifecycle = this.requireLifecycle();
    if (this.#activePackages.has(definition.manifest.packageName)) {
      await lifecycle.deactivate(definition.manifest.packageName);
    }

    try {
      await this.store.setEnabled(definition.manifest.packageName, false);
      this.#activePackages.delete(definition.manifest.packageName);
    } catch (error) {
      await lifecycle.activate(definition.manifest.packageName).catch(() => undefined);
      this.#activePackages.add(definition.manifest.packageName);
      throw error;
    }
    return this.requireState(id);
  }

  async uninstall(id: string): Promise<PluginRuntimeState> {
    const definition = this.registry.get(id);
    await this.assertNoEnabledDependants(definition);
    const installation = await this.store.find(definition.manifest.packageName);
    if (installation?.enabled === true || this.#activePackages.has(definition.manifest.packageName)) {
      throw new AppError({
        code: "PLUGIN_DISABLE_BEFORE_UNINSTALL",
        message: `${definition.manifest.displayName} must be disabled before it can be uninstalled`,
        statusCode: 409,
      });
    }
    await this.store.uninstall(definition.manifest.packageName);
    return this.requireState(id);
  }

  private requireLifecycle(): PluginLifecycleController {
    if (!this.#lifecycle) {
      throw new AppError({
        code: "PLUGIN_LIFECYCLE_NOT_READY",
        message: "Plugin lifecycle controller is not ready",
        statusCode: 503,
      });
    }
    return this.#lifecycle;
  }

  private async requireState(id: string): Promise<PluginRuntimeState> {
    const state = (await this.listStates()).find((item) => item.id === id);
    if (!state) {
      throw new AppError({
        code: "PLUGIN_NOT_FOUND",
        message: `Plugin is not available: ${id}`,
        statusCode: 404,
      });
    }
    return state;
  }

  private async assertPluginDependenciesInstalled(definition: PluginDefinition): Promise<void> {
    const states = await this.listStates();
    const byId = new Map(states.map((state) => [state.id, state]));
    for (const dependencyId of definition.manifest.pluginDependencies) {
      if (byId.get(dependencyId)?.installed !== true) {
        throw new AppError({
          code: "PLUGIN_MISSING_DEPENDENCY",
          message: `${definition.manifest.displayName} requires plugin ${dependencyId}`,
          statusCode: 409,
          details: { plugin: definition.manifest.id, dependency: dependencyId },
        });
      }
    }
  }

  private async assertPluginDependenciesEnabled(definition: PluginDefinition): Promise<void> {
    const states = await this.listStates();
    const byId = new Map(states.map((state) => [state.id, state]));
    for (const dependencyId of definition.manifest.pluginDependencies) {
      if (byId.get(dependencyId)?.active !== true) {
        throw new AppError({
          code: "PLUGIN_DEPENDENCY_DISABLED",
          message: `${definition.manifest.displayName} requires active plugin ${dependencyId}`,
          statusCode: 409,
          details: { plugin: definition.manifest.id, dependency: dependencyId },
        });
      }
    }
  }

  private async assertNoEnabledDependants(definition: PluginDefinition): Promise<void> {
    const states = await this.listStates();
    const dependant = states.find(
      (state) => state.active && state.pluginDependencies.includes(definition.manifest.id),
    );
    if (dependant) {
      throw new AppError({
        code: "PLUGIN_REQUIRED_BY_ENABLED_PLUGIN",
        message: `${definition.manifest.displayName} is required by active plugin ${dependant.displayName}`,
        statusCode: 409,
        details: { plugin: definition.manifest.id, dependant: dependant.id },
      });
    }
  }
}

export function validatePluginManifest(manifest: PluginManifest): void {
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
    throw new AppError({
      code: "PLUGIN_INVALID_MANIFEST",
      message: `Invalid plugin id: ${manifest.id}`,
    });
  }
  if (!manifest.packageName.startsWith("@beyondx/plugin-")) {
    throw new AppError({
      code: "PLUGIN_INVALID_MANIFEST",
      message: "Plugin package name must use the @beyondx/plugin-* namespace",
    });
  }
  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    throw new AppError({
      code: "PLUGIN_INVALID_MANIFEST",
      message: `Invalid plugin semantic version: ${manifest.version}`,
    });
  }
  if (!manifest.displayName.trim() || !manifest.description.trim()) {
    throw new AppError({
      code: "PLUGIN_INVALID_MANIFEST",
      message: "Plugin displayName and description are required",
    });
  }
  const duplicateDependencies = manifest.pluginDependencies.filter(
    (id, index, values) => values.indexOf(id) !== index,
  );
  if (duplicateDependencies.length > 0) {
    throw new AppError({
      code: "PLUGIN_INVALID_MANIFEST",
      message: `Duplicate plugin dependencies: ${duplicateDependencies.join(", ")}`,
    });
  }
}

function resolvePluginLoadOrder(definitions: PluginDefinition[]): PluginDefinition[] {
  const byId = new Map(definitions.map((definition) => [definition.manifest.id, definition]));
  const ordered: PluginDefinition[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string, trail: string[]): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new AppError({
        code: "PLUGIN_CIRCULAR_DEPENDENCY",
        message: `Circular plugin dependency: ${[...trail, id].join(" -> ")}`,
      });
    }
    const definition = byId.get(id);
    if (!definition) {
      throw new AppError({
        code: "PLUGIN_MISSING_DEPENDENCY",
        message: `Required enabled plugin is unavailable: ${id}`,
      });
    }
    visiting.add(id);
    for (const dependencyId of definition.manifest.pluginDependencies) {
      visit(dependencyId, [...trail, id]);
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(definition);
  };

  for (const definition of definitions) visit(definition.manifest.id, []);
  return ordered;
}
