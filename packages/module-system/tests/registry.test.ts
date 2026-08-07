import type { BeyondXModule, ModuleManifest } from "@beyondx/core";
import { describe, expect, it } from "vitest";
import { ModuleRegistry } from "../src/index.js";

function createModule(name: string, dependencies: string[] = []): BeyondXModule {
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

describe("ModuleRegistry", () => {
  it("orders dependencies before dependants", () => {
    const registry = new ModuleRegistry();
    registry.register(createModule("@beyondx/feature", ["@beyondx/foundation"]));
    registry.register(createModule("@beyondx/foundation"));

    expect(registry.resolveLoadOrder().map((item) => item.manifest.name)).toEqual([
      "@beyondx/foundation",
      "@beyondx/feature",
    ]);
  });

  it("detects circular dependencies", () => {
    const registry = new ModuleRegistry();
    registry.register(createModule("@beyondx/a", ["@beyondx/b"]));
    registry.register(createModule("@beyondx/b", ["@beyondx/a"]));

    expect(() => registry.resolveLoadOrder()).toThrow(/Circular/);
  });
});
