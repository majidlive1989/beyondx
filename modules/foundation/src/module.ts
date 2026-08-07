import {
  PLATFORM_EXTENSION_POINTS,
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
} from "@beyondx/core";
import {
  GetPlatformInfoService,
  PLATFORM_INFO_SERVICE,
} from "./application/get-platform-info.js";
import { createPlatformRoute } from "./api/platform-route.js";
import { PLATFORM_IDENTITY } from "./domain/platform-identity.js";
import { checkFoundationHealth } from "./infrastructure/foundation-health.js";

export const FOUNDATION_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/module-foundation",
  displayName: "BeyondX Foundation",
  version: "0.1.0",
  description: "Core platform identity and status capability",
  dependencies: [],
  optionalDependencies: [],
  permissions: ["platform.status.read"],
  capabilities: ["platform.identity", "platform.status"],
});

export class FoundationModule implements BeyondXModule {
  readonly manifest = FOUNDATION_MANIFEST;

  register(context: ModuleContext): Promise<void> {
    context.services.registerValue(
      PLATFORM_INFO_SERVICE,
      new GetPlatformInfoService(PLATFORM_IDENTITY),
    );
    context.permissions.register({
      id: "platform.status.read",
      description: "Read detailed platform status",
      module: this.manifest.name,
    });
    context.routes.register(this.manifest.name, createPlatformRoute(context.services));
    context.health.register({
      id: "module.foundation",
      critical: true,
      check: checkFoundationHealth,
    });
    context.extensions.register(
      PLATFORM_EXTENSION_POINTS.moduleConfiguration,
      this.manifest.name,
      {
        key: "platform.identity",
        mutable: false,
        value: PLATFORM_IDENTITY,
      },
    );
    return Promise.resolve();
  }

  async boot(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "platform.foundation.booted",
      version: 1,
      payload: { module: this.manifest.name, version: this.manifest.version },
    });
    context.logger.info({ module: this.manifest.name }, "Foundation module booted");
  }

  async shutdown(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "platform.foundation.stopping",
      version: 1,
      payload: { module: this.manifest.name },
    });
    context.logger.info({ module: this.manifest.name }, "Foundation module stopped");
  }
}
