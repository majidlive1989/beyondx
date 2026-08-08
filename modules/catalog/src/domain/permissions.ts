export const CATALOG_PERMISSIONS = Object.freeze([
  { id: "catalog.products.read", description: "Read catalog products and variants" },
  { id: "catalog.products.create", description: "Create catalog products" },
  { id: "catalog.products.update", description: "Update catalog products and publication status" },
  { id: "catalog.products.delete", description: "Delete catalog products" },
  { id: "catalog.variants.manage", description: "Create, update and delete product variants and SKUs" },
  { id: "catalog.categories.manage", description: "Manage catalog categories" },
  { id: "catalog.brands.manage", description: "Manage catalog brands" },
  { id: "catalog.attributes.manage", description: "Manage catalog attributes and values" },
] as const);

export type CatalogPermission = (typeof CATALOG_PERMISSIONS)[number]["id"];
