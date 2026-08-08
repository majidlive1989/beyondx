import type { PrismaClient } from "@beyondx/database";
import { CommerceModule, COMMERCE_PERMISSIONS } from "@beyondx/module-commerce";
import type { PluginDefinition, PluginManifest } from "@beyondx/module-system";

export const COMMERCE_PLUGIN_MANIFEST: PluginManifest = Object.freeze({
  id: "commerce",
  packageName: "@beyondx/plugin-commerce",
  displayName: "Commerce",
  version: "1.0.0",
  description: "Pricing, inventory, guest carts, checkout and order management",
  requiredModules: ["@beyondx/module-foundation", "@beyondx/module-identity", "@beyondx/module-schema"],
  pluginDependencies: ["catalog"],
  permissions: COMMERCE_PERMISSIONS.map((permission) => ({ ...permission })),
  capabilities: ["commerce.pricing", "commerce.inventory", "commerce.stock-movements", "commerce.guest-cart", "commerce.checkout", "commerce.orders"],
  adminNavigation: [{ group: "Commerce", href: "/commerce", label: "Commerce", permission: "commerce.orders.read", exact: true }],
});

export function createCommercePlugin(database: PrismaClient): PluginDefinition {
  return { manifest: COMMERCE_PLUGIN_MANIFEST, createModule: () => new CommerceModule({ database }) };
}
