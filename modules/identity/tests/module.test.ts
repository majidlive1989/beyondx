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
import { IdentityModule, IDENTITY_SERVICE } from "../src/module.js";

function databaseMock() {
  return {
    user: { count: vi.fn().mockResolvedValue(1) },
  };
}

function eventBusMock(): EventBus {
  return {
    publish: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };
}

describe("IdentityModule", () => {
  it("registers services, routes, permissions and health", async () => {
    const services = new ServiceContainer();
    const routes = new HttpRouteRegistry();
    const permissions = new PermissionRegistry();
    const health = new HealthRegistry();
    const module = new IdentityModule({
      database: databaseMock() as never,
      passwordSaltRounds: 12,
      jwtAccessSecret: "a".repeat(64),
      jwtRefreshSecret: "b".repeat(64),
      jwtAccessExpiresIn: "15m",
      jwtRefreshExpiresIn: "30d",
      emailVerificationExpiresIn: "24h",
      passwordResetExpiresIn: "1h",
      adminUrl: "http://localhost:3000",
      refreshCookieName: "beyondx_refresh",
      refreshCookieSecure: false,
      loginMaxAttempts: 5,
      loginLockMinutes: 15,
      smtp: { host: "localhost", port: 1025, secure: false, from: "test@beyondx.local" },
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
    expect(services.has(IDENTITY_SERVICE)).toBe(true);
    expect(routes.list().some((route) => route.path === "/api/v1/auth/login")).toBe(true);
    expect(permissions.has("identity.users.read")).toBe(true);
    expect((await health.runAll()).find((check) => check.id === "module.identity")?.status).toBe("healthy");
  });
});
