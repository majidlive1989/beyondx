import { describe, expect, it } from "vitest";
import { PLUGIN_MANAGER_MANIFEST } from "../src/module.js";


describe("PluginManagerModule", () => {
  it("is a core module that exposes plugin lifecycle permissions", () => {
    expect(PLUGIN_MANAGER_MANIFEST).toMatchObject({
      name: "@beyondx/module-plugin-manager",
      version: "0.5.0",
    });
    expect(PLUGIN_MANAGER_MANIFEST.permissions).toEqual(["plugins.read", "plugins.manage"]);
  });
});
