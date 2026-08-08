import {
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
  type ServiceToken,
} from "@beyondx/core";
import type { PrismaClient } from "@beyondx/database";
import { SCHEMA_SERVICE } from "@beyondx/module-schema";
import { createCommerceRoutes } from "./api/routes.js";
import { CommerceService } from "./application/commerce-service.js";
import { COMMERCE_PERMISSIONS } from "./domain/permissions.js";

export const COMMERCE_SERVICE: ServiceToken<CommerceService> = Object.freeze({
  key: "commerce.service",
});

export const COMMERCE_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/plugin-commerce",
  displayName: "Commerce Plugin",
  version: "1.0.0",
  description: "Pricing, inventory, carts, checkout and orders",
  dependencies: [
    "@beyondx/module-foundation",
    "@beyondx/module-identity",
    "@beyondx/module-schema",
    "@beyondx/plugin-catalog",
  ],
  optionalDependencies: [],
  permissions: COMMERCE_PERMISSIONS.map((permission) => permission.id),
  capabilities: [
    "commerce.pricing",
    "commerce.inventory",
    "commerce.stock-movements",
    "commerce.guest-cart",
    "commerce.checkout",
    "commerce.orders",
  ],
});

export class CommerceModule implements BeyondXModule {
  readonly manifest = COMMERCE_MANIFEST;

  constructor(private readonly options: { database: PrismaClient }) {}

  register(context: ModuleContext): Promise<void> {
    const service = new CommerceService(this.options.database);
    context.services.registerValue(COMMERCE_SERVICE, service);
    for (const permission of COMMERCE_PERMISSIONS) {
      context.permissions.register({ ...permission, module: this.manifest.name });
    }
    for (const route of createCommerceRoutes(service)) {
      context.routes.register(this.manifest.name, route);
    }
    return Promise.resolve();
  }

  async boot(context: ModuleContext): Promise<void> {
    const schemaService = context.services.resolve(SCHEMA_SERVICE);
    await Promise.all([
      schemaService.ensureSystemExtensionSchema({
        key: "commerce.order",
        displayName: "Order custom fields",
        pluralName: "Order custom fields",
        description: "Schema-driven metadata attached to commerce orders",
      }),
      schemaService.ensureSystemExtensionSchema({
        key: "commerce.cart",
        displayName: "Cart custom fields",
        pluralName: "Cart custom fields",
        description: "Schema-driven metadata attached to commerce carts",
      }),
    ]);
    await context.events.publish({
      name: "commerce.module.booted",
      version: 1,
      payload: { module: this.manifest.name, version: this.manifest.version },
    });
    context.logger.info({ module: this.manifest.name }, "Commerce plugin activated");
  }

  async shutdown(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "commerce.module.stopping",
      version: 1,
      payload: { module: this.manifest.name },
    });
    context.logger.info({ module: this.manifest.name }, "Commerce plugin deactivated");
  }
}
