import {
  ExtensionRegistry,
  HealthRegistry,
  HttpRouteRegistry,
  PermissionRegistry,
  ServiceContainer,
  type PlatformEvent,
} from "@beyondx/core";
import { TypedEventBus } from "@beyondx/events";
import { createCapturingLogger } from "@beyondx/testing";
import { describe, expect, it, vi } from "vitest";
import {
  FoundationModule,
  PLATFORM_INFO_SERVICE,
  type GetPlatformInfoService,
} from "../src/index.js";

interface FoundationEvents {
  "platform.foundation.booted": { module: string; version: string };
}

type FoundationBootedEvent = Required<
  PlatformEvent<FoundationEvents["platform.foundation.booted"]>
>;

describe("FoundationModule", () => {
  it("registers real platform contributions and emits its boot event", async () => {
    const services = new ServiceContainer();
    const events = new TypedEventBus<FoundationEvents>();
    const eventHandler = vi.fn<(event: FoundationBootedEvent) => void>();
    events.subscribe("platform.foundation.booted", eventHandler);
    const { logger } = createCapturingLogger();
    const context = {
      services,
      events,
      health: new HealthRegistry(),
      routes: new HttpRouteRegistry(),
      permissions: new PermissionRegistry(),
      extensions: new ExtensionRegistry(),
      logger,
    };
    const module = new FoundationModule();

    await module.register(context);
    await module.boot(context);

    const info = services
      .resolve<GetPlatformInfoService>(PLATFORM_INFO_SERVICE)
      .execute();
    expect(info.name).toBe("BeyondX");
    expect(context.routes.list()).toHaveLength(1);
    expect(context.permissions.has("platform.status.read")).toBe(true);
    expect(eventHandler).toHaveBeenCalledOnce();
  });
});
