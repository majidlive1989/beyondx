import { describe, expect, it } from "vitest";
import { CATALOG_PLUGIN_MANIFEST, createCatalogPlugin } from "../src/index.js";

describe("Catalog plugin", () => {
  it("declares Catalog as an optional first-party plugin", () => {
    expect(CATALOG_PLUGIN_MANIFEST).toMatchObject({
      id: "catalog",
      packageName: "@beyondx/plugin-catalog",
      version: "1.0.0",
      pluginDependencies: [],
    });
    expect(CATALOG_PLUGIN_MANIFEST.adminNavigation.map((item) => item.href)).toEqual([
      "/catalog",
      "/catalog/taxonomy",
    ]);
  });

  it("creates the catalog feature module only through the plugin factory", () => {
    const plugin = createCatalogPlugin({} as never);
    expect(plugin.createModule().manifest.name).toBe("@beyondx/plugin-catalog");
  });
});
