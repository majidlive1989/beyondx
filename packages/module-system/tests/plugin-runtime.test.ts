import type { BeyondXModule, ModuleManifest } from "@beyondx/core";
import { describe, expect, it, vi } from "vitest";
import {
  PluginRegistry,
  PluginRuntime,
  type PluginDefinition,
  type PluginInstallationRecord,
  type PluginLifecycleController,
  type PluginStateStore,
} from "../src/index.js";

class MemoryPluginStore implements PluginStateStore {
  readonly #items = new Map<string, PluginInstallationRecord>();

  list(): Promise<PluginInstallationRecord[]> {
    return Promise.resolve([...this.#items.values()]);
  }

  find(packageName: string): Promise<PluginInstallationRecord | null> {
    return Promise.resolve(this.#items.get(packageName) ?? null);
  }

  install(packageName: string, version: string): Promise<PluginInstallationRecord> {
    const now = new Date();
    const current = this.#items.get(packageName);
    const record: PluginInstallationRecord = current
      ? { ...current, version, updatedAt: now }
      : { packageName, version, enabled: false, installedAt: now, updatedAt: now };
    this.#items.set(packageName, record);
    return Promise.resolve(record);
  }

  setEnabled(packageName: string, enabled: boolean): Promise<PluginInstallationRecord> {
    const current = this.#items.get(packageName);
    if (!current) return Promise.reject(new Error("not installed"));
    const record = { ...current, enabled, updatedAt: new Date() };
    this.#items.set(packageName, record);
    return Promise.resolve(record);
  }

  uninstall(packageName: string): Promise<void> {
    this.#items.delete(packageName);
    return Promise.resolve();
  }
}

function createModule(name: string, dependencies = ["@beyondx/module-foundation"]): BeyondXModule {
  const manifest: ModuleManifest = {
    name,
    displayName: name,
    version: "1.0.0",
    description: `${name} module`,
    dependencies,
    optionalDependencies: [],
    permissions: [],
    capabilities: [],
  };
  return {
    manifest,
    register: () => Promise.resolve(),
    boot: () => Promise.resolve(),
  };
}

function createPlugin(id: string, dependencies: string[] = []): PluginDefinition {
  const packageName = `@beyondx/plugin-${id}`;
  return {
    manifest: {
      id,
      packageName,
      displayName: id,
      version: "1.0.0",
      description: `${id} plugin`,
      requiredModules: ["@beyondx/module-foundation"],
      pluginDependencies: dependencies,
      permissions: [],
      capabilities: [],
      adminNavigation: [{ group: id, href: `/${id}`, label: id }],
    },
    createModule: () =>
      createModule(packageName, [
        "@beyondx/module-foundation",
        ...dependencies.map((dependency) => `@beyondx/plugin-${dependency}`),
      ]),
  };
}

function attachLifecycle(runtime: PluginRuntime) {
  const activate = vi.fn<(packageName: string) => Promise<void>>().mockResolvedValue(undefined);
  const deactivate = vi.fn<(packageName: string) => Promise<void>>().mockResolvedValue(undefined);
  const lifecycle: PluginLifecycleController = { activate, deactivate };
  runtime.attachLifecycle(lifecycle);
  return { activate, deactivate };
}

describe("PluginRuntime", () => {
  it("does not activate an available plugin until it is installed and enabled", async () => {
    const registry = new PluginRegistry();
    registry.register(createPlugin("catalog"));
    const runtime = new PluginRuntime(registry, new MemoryPluginStore());

    expect(await runtime.resolveEnabledModules(["@beyondx/module-foundation"])).toEqual([]);
    expect((await runtime.listStates())[0]).toMatchObject({
      id: "catalog",
      installed: false,
      enabled: false,
      active: false,
      restartRequired: false,
    });
  });

  it("hot-enables and hot-disables a plugin without restart-required state", async () => {
    const registry = new PluginRegistry();
    registry.register(createPlugin("catalog"));
    const runtime = new PluginRuntime(registry, new MemoryPluginStore());
    const lifecycle = attachLifecycle(runtime);

    await runtime.install("catalog");
    const enabled = await runtime.enable("catalog");
    expect(lifecycle.activate).toHaveBeenCalledWith("@beyondx/plugin-catalog");
    expect(enabled).toMatchObject({
      enabled: true,
      active: true,
      restartRequired: false,
    });
    expect(enabled.adminNavigation).toHaveLength(1);

    const disabled = await runtime.disable("catalog");
    expect(lifecycle.deactivate).toHaveBeenCalledWith("@beyondx/plugin-catalog");
    expect(disabled).toMatchObject({
      enabled: false,
      active: false,
      restartRequired: false,
    });
    expect(disabled.adminNavigation).toEqual([]);
  });

  it("enforces plugin installation and active dependency ordering", async () => {
    const registry = new PluginRegistry();
    registry.register(createPlugin("catalog"));
    registry.register(createPlugin("commerce", ["catalog"]));
    const runtime = new PluginRuntime(registry, new MemoryPluginStore());
    attachLifecycle(runtime);

    await expect(runtime.install("commerce")).rejects.toMatchObject({
      code: "PLUGIN_MISSING_DEPENDENCY",
    });

    await runtime.install("catalog");
    await runtime.install("commerce");
    await expect(runtime.enable("commerce")).rejects.toMatchObject({
      code: "PLUGIN_DEPENDENCY_DISABLED",
    });

    await runtime.enable("catalog");
    await runtime.enable("commerce");
    await expect(runtime.disable("catalog")).rejects.toMatchObject({
      code: "PLUGIN_REQUIRED_BY_ENABLED_PLUGIN",
    });
  });

  it("rolls back enabled persistence when hot activation fails", async () => {
    const registry = new PluginRegistry();
    registry.register(createPlugin("catalog"));
    const store = new MemoryPluginStore();
    const runtime = new PluginRuntime(registry, store);
    runtime.attachLifecycle({
      activate: () => Promise.reject(new Error("boot failed")),
      deactivate: () => Promise.resolve(),
    });

    await runtime.install("catalog");
    await expect(runtime.enable("catalog")).rejects.toThrow("boot failed");
    expect(await store.find("@beyondx/plugin-catalog")).toMatchObject({ enabled: false });
    expect((await runtime.listStates())[0]).toMatchObject({ active: false, enabled: false });
  });
});
