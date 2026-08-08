import { describe, expect, it } from "vitest";
import { COMMERCE_PLUGIN_MANIFEST } from "../src/index.js";

describe("Commerce plugin manifest", () => {
  it("is a first-party plugin that depends on Catalog", () => {
    expect(COMMERCE_PLUGIN_MANIFEST).toMatchObject({
      id: "commerce",
      packageName: "@beyondx/plugin-commerce",
      pluginDependencies: ["catalog"],
    });
    expect(COMMERCE_PLUGIN_MANIFEST.capabilities).toEqual(
      expect.arrayContaining([
        "commerce.pricing",
        "commerce.inventory",
        "commerce.checkout",
        "commerce.orders",
      ]),
    );
  });
});
