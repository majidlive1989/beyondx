import { describe, expect, it } from "vitest";
import { DISCUSSION_PLUGIN_MANIFEST, createDiscussionPlugin } from "../src/index.js";

describe("Discussion plugin", () => {
  it("is a first-party optional comments and product review plugin", () => {
    expect(DISCUSSION_PLUGIN_MANIFEST).toMatchObject({
      id: "discussion",
      packageName: "@beyondx/plugin-discussion",
      pluginDependencies: [],
    });
    expect(DISCUSSION_PLUGIN_MANIFEST.capabilities).toContain("discussion.product-reviews");
    expect(DISCUSSION_PLUGIN_MANIFEST.adminNavigation[0]?.href).toBe("/comments");
  });

  it("creates the discussion feature module through the plugin factory", () => {
    expect(createDiscussionPlugin({} as never).createModule().manifest.name).toBe("@beyondx/plugin-discussion");
  });
});
