import {
  ExtensionRegistry,
  HealthRegistry,
  HttpRouteRegistry,
  PermissionRegistry,
  ServiceContainer,
  type EventBus,
} from "@beyondx/core";
import { createCapturingLogger } from "@beyondx/testing";
import { describe, expect, it, vi } from "vitest";
import { SCHEMA_SERVICE, type SchemaService } from "@beyondx/module-schema";
import { CatalogModule, CATALOG_SERVICE } from "../src/module.js";

function eventBusMock(): EventBus {
  return {
    publish: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };
}

describe("CatalogModule", () => {
  it("registers catalog service, routes, permissions and health", async () => {
    const services = new ServiceContainer();
    const ensureSystemExtensionSchema = vi.fn().mockResolvedValue({});
    const schemaService = {
      ensureSystemExtensionSchema,
    } as unknown as SchemaService;
    services.registerValue(SCHEMA_SERVICE, schemaService);
    const routes = new HttpRouteRegistry();
    const permissions = new PermissionRegistry();
    const health = new HealthRegistry();
    const database = {
      product: { count: vi.fn().mockResolvedValue(0) },
      productVariant: { count: vi.fn().mockResolvedValue(0) },
    };
    const module = new CatalogModule({ database: database as never });
    const { logger } = createCapturingLogger();

    await module.register({
      services,
      routes,
      permissions,
      health,
      events: eventBusMock(),
      extensions: new ExtensionRegistry(),
      logger,
    });

    expect(services.has(CATALOG_SERVICE)).toBe(true);
    expect(ensureSystemExtensionSchema).toHaveBeenCalledTimes(2);
    expect(routes.list().some((route) => route.path === "/api/v1/admin/catalog/products")).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/catalog/products")).toBe(true);
    expect(permissions.has("catalog.variants.manage")).toBe(true);
    expect((await health.runAll()).find((check) => check.id === "module.catalog")?.status).toBe("healthy");
  });
});
