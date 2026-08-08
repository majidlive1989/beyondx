import type { BeyondXModule, ModuleManifest } from "@beyondx/core";
import { describe, expect, it } from "vitest";
import {
  PluginRegistry,
  PluginRuntime,
  type PluginDefinition,
  type PluginInstallationRecord,
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

function createModule(name: string): BeyondXModule {
  const manifest: ModuleManifest = {
    name,
    displayName: name,
    version: "1.0.0",
    description: `${name} module`,
    dependencies: ["@beyondx/module-foundation"],
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

function createPlugin(
  id: string,
  dependencies: string[] = [],
): PluginDefinition {
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
      adminNavigation: [],
    },
    createModule: () => createModule(packageName),
  };
}

describe("PluginRuntime", () => {
  it("does not load an available plugin until it is installed and enabled", async () => {
    const registry = new PluginRegistry();
    registry.register(createPlugin("catalog"));
    const runtime = new PluginRuntime(registry, new MemoryPluginStore());

    expect(
      await runtime.resolveEnabledModules(["@beyondx/module-foundation"]),
    ).toEqual([]);
    expect((await runtime.listStates())[0]).toMatchObject({
      id: "catalog",
      installed: false,
      enabled: false,
      active: false,
    });
  });

  it("marks enable and disable changes as restart-required until startup state changes", async () => {
    const registry = new PluginRegistry();
    registry.register(createPlugin("catalog"));
    const runtime = new PluginRuntime(registry, new MemoryPluginStore());

    await runtime.install("catalog");
    const enabled = await runtime.enable("catalog");
    expect(enabled).toMatchObject({ enabled: true, active: false, restartRequired: true });

    const modules = await runtime.resolveEnabledModules(["@beyondx/module-foundation"]);
    expect(modules.map((module) => module.manifest.name)).toEqual(["@beyondx/plugin-catalog"]);
    expect((await runtime.listStates())[0]).toMatchObject({
      enabled: true,
      active: true,
      restartRequired: false,
    });

    const disabled = await runtime.disable("catalog");
    expect(disabled).toMatchObject({ enabled: false, active: true, restartRequired: true });
  });

  it("enforces plugin dependencies", async () => {
    const registry = new PluginRegistry();
    registry.register(createPlugin("catalog"));
    registry.register(createPlugin("commerce", ["catalog"]));
    const runtime = new PluginRuntime(registry, new MemoryPluginStore());

    await expect(runtime.install("commerce")).rejects.toMatchObject({
      code: "PLUGIN_MISSING_DEPENDENCY",
    });
  });
});
