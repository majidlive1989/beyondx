import type { PrismaClient } from "@beyondx/database";
import { CatalogModule, CATALOG_PERMISSIONS } from "@beyondx/module-catalog";
import type { PluginDefinition, PluginManifest } from "@beyondx/module-system";

export const CATALOG_PLUGIN_MANIFEST: PluginManifest = Object.freeze({
  id: "catalog",
  packageName: "@beyondx/plugin-catalog",
  displayName: "Catalog",
  version: "1.0.0",
  description: "Products, variants, categories, brands, attributes and media-enabled product catalog",
  requiredModules: [
    "@beyondx/module-foundation",
    "@beyondx/module-identity",
    "@beyondx/module-media",
    "@beyondx/module-schema",
  ],
  pluginDependencies: [],
  permissions: CATALOG_PERMISSIONS.map((permission) => ({ ...permission })),
  capabilities: [
    "catalog.products",
    "catalog.variants",
    "catalog.sku",
    "catalog.categories",
    "catalog.brands",
    "catalog.attributes",
    "catalog.media",
    "catalog.dynamic-fields",
  ],
  adminNavigation: [
    {
      group: "Catalog",
      href: "/catalog",
      label: "Products",
      permission: "catalog.products.read",
      exact: true,
    },
    {
      group: "Catalog",
      href: "/catalog/taxonomy",
      label: "Catalog setup",
      permission: "catalog.products.read",
    },
  ],
});

export function createCatalogPlugin(database: PrismaClient): PluginDefinition {
  return {
    manifest: CATALOG_PLUGIN_MANIFEST,
    createModule: () => new CatalogModule({ database }),
  };
}
