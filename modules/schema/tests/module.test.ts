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
import { SchemaModule, SCHEMA_SERVICE } from "../src/module.js";

function eventBusMock(): EventBus {
  return { publish: () => Promise.resolve(), subscribe: () => () => undefined };
}

describe("SchemaModule", () => {
  it("registers builder routes, permissions and health", async () => {
    const services = new ServiceContainer();
    const routes = new HttpRouteRegistry();
    const permissions = new PermissionRegistry();
    const health = new HealthRegistry();
    const database = {
      dataSchema: { count: vi.fn().mockResolvedValue(2) },
      dataRecord: { count: vi.fn().mockResolvedValue(0) },
    };
    const module = new SchemaModule({ database: database as never });
    const { logger } = createCapturingLogger();

    await module.register({ services, routes, permissions, health, events: eventBusMock(), extensions: new ExtensionRegistry(), logger });

    expect(services.has(SCHEMA_SERVICE)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/admin/schemas")).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/admin/runtime-schemas" && route.permission === "schema.records.read")).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/admin/data/:schemaKey")).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/site/settings" && route.public)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/pages/:slug" && route.public)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/blog/posts/:slug" && route.public)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/blog/categories" && route.public)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/navigation" && route.public)).toBe(true);
    expect(permissions.has("schema.builder.manage")).toBe(true);
    expect((await health.runAll()).find((check) => check.id === "module.schema")?.status).toBe("healthy");
  });
});
