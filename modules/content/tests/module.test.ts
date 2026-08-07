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
import { CONTENT_SERVICE, ContentModule } from "../src/module.js";

function eventBusMock(): EventBus {
  return {
    publish: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };
}

describe("ContentModule", () => {
  it("registers CMS services, routes, permissions and health", async () => {
    const services = new ServiceContainer();
    const routes = new HttpRouteRegistry();
    const permissions = new PermissionRegistry();
    const health = new HealthRegistry();
    const module = new ContentModule({
      database: { contentType: { count: vi.fn().mockResolvedValue(0) } } as never,
    });
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

    expect(services.has(CONTENT_SERVICE)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/admin/content-types")).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/content/:apiId/:slug" && route.public)).toBe(true);
    expect(permissions.has("content.entries.publish")).toBe(true);
    expect((await health.runAll()).find((check) => check.id === "module.content")?.status).toBe("healthy");
  });
});
