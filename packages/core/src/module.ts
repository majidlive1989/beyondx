import type { EventBus } from "./events.js";
import type { ExtensionRegistry } from "./extensions.js";
import type { HealthRegistry } from "./health.js";
import type { HttpRouteRegistry } from "./http.js";
import type { PermissionRegistry } from "./permissions.js";
import type { ServiceContainer } from "./services.js";

export interface PlatformLogger {
  debug(bindings: Record<string, unknown>, message: string): void;
  info(bindings: Record<string, unknown>, message: string): void;
  warn(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

export interface ModuleManifest {
  name: string;
  displayName: string;
  version: string;
  description: string;
  dependencies: string[];
  optionalDependencies: string[];
  permissions: string[];
  capabilities: string[];
}

export interface ModuleContext {
  services: ServiceContainer;
  events: EventBus;
  health: HealthRegistry;
  routes: HttpRouteRegistry;
  permissions: PermissionRegistry;
  extensions: ExtensionRegistry;
  logger: PlatformLogger;
}

export interface BeyondXModule {
  readonly manifest: ModuleManifest;
  register(context: ModuleContext): Promise<void>;
  boot(context: ModuleContext): Promise<void>;
  shutdown?(context: ModuleContext): Promise<void>;
}

export type ModuleLifecycleState =
  | "registered"
  | "booting"
  | "active"
  | "stopping"
  | "stopped"
  | "failed";

export interface ModuleRuntimeStatus {
  name: string;
  version: string;
  state: ModuleLifecycleState;
  error?: string;
}
