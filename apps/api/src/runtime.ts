import { loadConfig } from "@beyondx/config";
import {
  ACCESS_TOKEN_AUTHENTICATOR,
  ExtensionRegistry,
  HealthRegistry,
  HttpRouteRegistry,
  PermissionRegistry,
  ServiceContainer,
} from "@beyondx/core";
import {
  checkDatabaseConnection,
  disconnectDatabase,
  getDatabaseClient,
} from "@beyondx/database";
import { TypedEventBus } from "@beyondx/events";
import { createLogger } from "@beyondx/logger";
import { ModuleRegistry, PluginRegistry, PluginRuntime } from "@beyondx/module-system";
import { FoundationModule } from "@beyondx/module-foundation";
import { IdentityModule } from "@beyondx/module-identity";
import { ContentModule } from "@beyondx/module-content";
import { MediaModule } from "@beyondx/module-media";
import { SchemaModule } from "@beyondx/module-schema";
import { PluginManagerModule } from "@beyondx/module-plugin-manager";
import { createCatalogPlugin } from "@beyondx/plugin-catalog";
import { PrismaPluginStateStore } from "./plugin-state-store.js";
import { Redis } from "ioredis";
import type { ApplicationDependencies } from "./types.js";

export async function createRuntimeDependencies(): Promise<ApplicationDependencies> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    service: "@beyondx/api",
    environment: config.NODE_ENV,
  });
  const health = new HealthRegistry();
  const routes = new HttpRouteRegistry();
  const services = new ServiceContainer();
  const permissions = new PermissionRegistry();
  const extensions = new ExtensionRegistry();
  const events = new TypedEventBus();
  const database = getDatabaseClient();
  const redis = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  health.register({
    id: "postgresql",
    critical: true,
    timeoutMs: 2_000,
    check: async () => ({
      status: "healthy",
      message: "PostgreSQL is reachable",
      metadata: { latencyMs: await checkDatabaseConnection(database) },
    }),
  });
  health.register({
    id: "redis",
    critical: true,
    timeoutMs: 2_000,
    check: async () => {
      if (redis.status === "wait") await redis.connect();
      const started = performance.now();
      const response = await redis.ping();
      return {
        status: response === "PONG" ? "healthy" : "degraded",
        message:
          response === "PONG"
            ? "Redis is reachable"
            : "Redis returned an unexpected response",
        metadata: {
          latencyMs: Math.round((performance.now() - started) * 100) / 100,
        },
      };
    },
  });

  const pluginRegistry = new PluginRegistry();
  pluginRegistry.register(createCatalogPlugin(database));
  const pluginRuntime = new PluginRuntime(
    pluginRegistry,
    new PrismaPluginStateStore(database),
  );

  const registry = new ModuleRegistry();
  registry.register(new FoundationModule());
  registry.register(
    new IdentityModule({
      database,
      passwordSaltRounds: config.PASSWORD_SALT_ROUNDS,
      jwtAccessSecret: config.JWT_ACCESS_SECRET,
      jwtRefreshSecret: config.JWT_REFRESH_SECRET,
      jwtAccessExpiresIn: config.JWT_ACCESS_EXPIRES_IN,
      jwtRefreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
      emailVerificationExpiresIn: config.EMAIL_VERIFICATION_EXPIRES_IN,
      passwordResetExpiresIn: config.PASSWORD_RESET_EXPIRES_IN,
      adminUrl: config.ADMIN_URL,
      refreshCookieName: config.REFRESH_COOKIE_NAME,
      refreshCookieSecure: config.REFRESH_COOKIE_SECURE,
      loginMaxAttempts: config.LOGIN_MAX_ATTEMPTS,
      loginLockMinutes: config.LOGIN_LOCK_MINUTES,
      smtp: {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        from: config.SMTP_FROM,
      },
    }),
  );
  registry.register(new ContentModule({ database }));
  registry.register(
    new MediaModule({
      database,
      storageDriver: config.MEDIA_STORAGE_DRIVER,
      localRoot: config.MEDIA_LOCAL_ROOT,
      maxFileSizeBytes: config.MEDIA_MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: config.MEDIA_ALLOWED_MIME_TYPES,
    }),
  );
  registry.register(new SchemaModule({ database }));
  registry.register(new PluginManagerModule({ database, runtime: pluginRuntime }));

  const pluginModules = await pluginRuntime.resolveEnabledModules(
    registry.list().map((manifest) => manifest.name),
  );
  for (const pluginModule of pluginModules) registry.register(pluginModule);

  const kernel = await registry.createKernel({
    services,
    events,
    health,
    routes,
    permissions,
    extensions,
    logger,
  });
  await kernel.boot();

  return {
    config,
    logger,
    health,
    routes,
    authenticator: services.resolve(ACCESS_TOKEN_AUTHENTICATOR),
    modules: () => kernel.listModules(),
    close: async () => {
      await kernel.shutdown();
      if (redis.status !== "end") redis.disconnect();
      await disconnectDatabase();
    },
  };
}
