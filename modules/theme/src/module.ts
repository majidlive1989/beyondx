import type { BeyondXModule, ModuleContext, ModuleManifest } from "@beyondx/core";
import { createThemeRoutes } from "./api/routes.js";

export interface ThemeModuleOptions {
  isPluginActive: (packageName: string) => boolean;
}

export const THEME_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/module-theme",
  displayName: "Theme Delivery Bridge",
  version: "0.6.2",
  description: "Public theme capability discovery and stable headless delivery contract",
  dependencies: ["@beyondx/module-foundation", "@beyondx/module-content", "@beyondx/module-media", "@beyondx/module-schema"],
  optionalDependencies: ["@beyondx/plugin-catalog", "@beyondx/plugin-discussion", "@beyondx/plugin-commerce"],
  permissions: [],
  capabilities: ["theme.delivery", "theme.capability-discovery", "theme.sdk", "theme.public-media", "theme.site-globals"],
});

export class ThemeModule implements BeyondXModule {
  readonly manifest = THEME_MANIFEST;

  constructor(private readonly options: ThemeModuleOptions) {}

  register(context: ModuleContext): Promise<void> {
    for (const route of createThemeRoutes(this.options)) {
      context.routes.register(this.manifest.name, route);
    }
    context.health.register({
      id: "module.theme",
      critical: false,
      check: () => Promise.resolve({ status: "healthy", message: "Theme delivery bridge is available" }),
    });
    return Promise.resolve();
  }

  async boot(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "theme.module.booted",
      version: 1,
      payload: { module: this.manifest.name, version: this.manifest.version },
    });
    context.logger.info({ module: this.manifest.name }, "Theme delivery bridge booted");
  }
}
