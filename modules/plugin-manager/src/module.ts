import {
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
  type ServiceToken,
} from "@beyondx/core";
import type { PrismaClient } from "@beyondx/database";
import type { PluginRuntime } from "@beyondx/module-system";
import { createPluginManagerRoutes } from "./api/routes.js";
import { PluginManagerService } from "./application/plugin-manager-service.js";
import { PLUGIN_MANAGER_PERMISSIONS } from "./domain/permissions.js";

export const PLUGIN_MANAGER_SERVICE: ServiceToken<PluginManagerService> = Object.freeze({
  key: "plugins.manager.service",
});

export const PLUGIN_MANAGER_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/module-plugin-manager",
  displayName: "Plugin Manager",
  version: "0.5.0",
  description: "Install, enable and disable BeyondX plugins with hot lifecycle",
  dependencies: ["@beyondx/module-foundation", "@beyondx/module-identity"],
  optionalDependencies: [],
  permissions: PLUGIN_MANAGER_PERMISSIONS.map((permission) => permission.id),
  capabilities: ["plugins.registry", "plugins.lifecycle", "plugins.hot-lifecycle", "plugins.admin-navigation"],
});

export class PluginManagerModule implements BeyondXModule {
  readonly manifest = PLUGIN_MANAGER_MANIFEST;

  constructor(
    private readonly options: { database: PrismaClient; runtime: PluginRuntime },
  ) {}

  register(context: ModuleContext): Promise<void> {
    const service = new PluginManagerService(this.options.database, this.options.runtime);
    context.services.registerValue(PLUGIN_MANAGER_SERVICE, service);
    for (const permission of PLUGIN_MANAGER_PERMISSIONS) {
      context.permissions.register({ ...permission, module: this.manifest.name });
    }
    for (const route of createPluginManagerRoutes(service)) {
      context.routes.register(this.manifest.name, route);
    }
    return Promise.resolve();
  }

  boot(context: ModuleContext): Promise<void> {
    context.logger.info({ module: this.manifest.name }, "Plugin manager booted");
    return Promise.resolve();
  }
}
