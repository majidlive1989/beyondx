import {
  ExtensionRegistry,
  HealthRegistry,
  HttpRouteRegistry,
  PermissionRegistry,
  ServiceContainer,
  type EventBus,
  type ModuleContext,
} from "@beyondx/core";
import { createCapturingLogger } from "@beyondx/testing";
import { describe, expect, it, vi } from "vitest";
import { DISCUSSION_SERVICE, DiscussionModule } from "../src/module.js";

function eventBusMock(): EventBus {
  return { publish: () => Promise.resolve(), subscribe: () => () => undefined };
}

describe("DiscussionModule", () => {
  it("registers discussion service, public/admin routes, permissions and health", async () => {
    const services = new ServiceContainer();
    const routes = new HttpRouteRegistry();
    const permissions = new PermissionRegistry();
    const health = new HealthRegistry();
    const { logger } = createCapturingLogger();
    const module = new DiscussionModule({
      database: { discussionEntry: { count: vi.fn().mockResolvedValue(0) } } as never,
    });
    const context: ModuleContext = {
      services,
      routes,
      permissions,
      health,
      events: eventBusMock(),
      extensions: new ExtensionRegistry(),
      logger,
    };

    await module.register(context);
    expect(services.has(DISCUSSION_SERVICE)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/discussions" && route.public)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/admin/discussions")).toBe(true);
    expect(permissions.has("discussion.entries.moderate")).toBe(true);
    expect((await health.runAll()).find((check) => check.id === "module.discussion")?.status).toBe("healthy");
  });
});
