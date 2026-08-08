import {
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
  type ServiceToken,
} from "@beyondx/core";
import type { PrismaClient } from "@beyondx/database";
import { SCHEMA_SERVICE } from "@beyondx/module-schema";
import { createCatalogRoutes } from "./api/routes.js";
import { CatalogService } from "./application/catalog-service.js";
import { CATALOG_PERMISSIONS } from "./domain/permissions.js";
import { PrismaCatalogRepository } from "./infrastructure/prisma-catalog-repository.js";

export const CATALOG_SERVICE: ServiceToken<CatalogService> = Object.freeze({
  key: "catalog.service",
});

export interface CatalogModuleOptions {
  database: PrismaClient;
}

export const CATALOG_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/plugin-catalog",
  displayName: "Catalog Plugin",
  version: "1.0.0",
  description: "Products, variants, taxonomy and schema-driven custom fields",
  dependencies: [
    "@beyondx/module-foundation",
    "@beyondx/module-identity",
    "@beyondx/module-media",
    "@beyondx/module-schema",
  ],
  optionalDependencies: [],
  permissions: CATALOG_PERMISSIONS.map((permission) => permission.id),
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
});

export class CatalogModule implements BeyondXModule {
  readonly manifest = CATALOG_MANIFEST;

  constructor(private readonly options: CatalogModuleOptions) {}

  async register(context: ModuleContext): Promise<void> {
    const schemaService = context.services.resolve(SCHEMA_SERVICE);
    await Promise.all([
      schemaService.ensureSystemExtensionSchema({
        key: "catalog.product",
        displayName: "Product custom fields",
        pluralName: "Product custom fields",
        description: "Schema-driven fields attached to catalog products",
      }),
      schemaService.ensureSystemExtensionSchema({
        key: "catalog.variant",
        displayName: "Variant custom fields",
        pluralName: "Variant custom fields",
        description: "Schema-driven fields attached to catalog variants",
      }),
    ]);
    const service = new CatalogService(
      new PrismaCatalogRepository(this.options.database),
      schemaService,
    );
    context.services.registerValue(CATALOG_SERVICE, service);
    for (const permission of CATALOG_PERMISSIONS) {
      context.permissions.register({ ...permission, module: this.manifest.name });
    }
    for (const route of createCatalogRoutes(service)) {
      context.routes.register(this.manifest.name, route);
    }
    context.health.register({
      id: "module.catalog",
      critical: false,
      check: async () => ({
        status: "healthy",
        message: "Catalog persistence is available",
        metadata: {
          productCount: await this.options.database.product.count(),
          variantCount: await this.options.database.productVariant.count(),
        },
      }),
    });
  }

  async boot(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "catalog.module.booted",
      version: 1,
      payload: { module: this.manifest.name, version: this.manifest.version },
    });
    context.logger.info({ module: this.manifest.name }, "Catalog module booted");
  }

  async shutdown(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "catalog.module.stopping",
      version: 1,
      payload: { module: this.manifest.name },
    });
    context.logger.info({ module: this.manifest.name }, "Catalog module stopped");
  }
}
