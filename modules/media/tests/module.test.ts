import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
import { MediaModule, MEDIA_SERVICE } from "../src/module.js";

function eventBusMock(): EventBus {
  return {
    publish: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };
}

describe("MediaModule", () => {
  it("registers media services, routes, permissions and health", async () => {
    const storageRoot = await mkdtemp(path.join(tmpdir(), "beyondx-media-"));
    try {
      const services = new ServiceContainer();
      const routes = new HttpRouteRegistry();
      const permissions = new PermissionRegistry();
      const health = new HealthRegistry();
      const database = {
        mediaAsset: { count: vi.fn().mockResolvedValue(0) },
      };
      const module = new MediaModule({
        database: database as never,
        storageDriver: "local",
        localRoot: storageRoot,
        maxFileSizeBytes: 1024 * 1024,
        allowedMimeTypes: ["image/png"],
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

      expect(services.has(MEDIA_SERVICE)).toBe(true);
      expect(routes.list().some((route) => route.path === "/api/v1/admin/media")).toBe(true);
      expect(routes.list().some((route) => route.path === "/api/v1/media/:id/content" && route.public)).toBe(true);
      expect(routes.list().some((route) => route.path === "/api/v1/admin/media/:id/visibility")).toBe(true);
      expect(permissions.has("media.assets.upload")).toBe(true);
      expect((await health.runAll()).find((check) => check.id === "module.media")?.status).toBe(
        "healthy",
      );
    } finally {
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});
