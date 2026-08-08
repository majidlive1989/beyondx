import {
  ExtensionRegistry,
  HealthRegistry,
  HttpRouteRegistry,
  PermissionRegistry,
  ServiceContainer,
} from "@beyondx/core";
import { TypedEventBus } from "@beyondx/events";
import { createLogger } from "@beyondx/logger";
import { FoundationModule } from "@beyondx/module-foundation";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { ApplicationDependencies } from "../src/types.js";

interface HealthResponse {
  status: string;
  platform: string;
  requestId: string;
}

interface ReadinessResponse {
  status: string;
}

interface PlatformResponse {
  name: string;
  slogan: string;
}

interface ErrorResponse {
  error: {
    code: string;
    requestId: string;
  };
}

const apps: Awaited<ReturnType<typeof createApp>>[] = [];

async function createDependencies(
  status: "healthy" | "unhealthy" = "healthy",
): Promise<ApplicationDependencies> {
  const health = new HealthRegistry();
  health.register({
    id: "dependency",
    check: () => {
      if (status === "healthy") {
        return Promise.resolve<{ status: "healthy"; message: string }>({
          status: "healthy",
          message: "ready",
        });
      }
      return Promise.reject(new Error("offline"));
    },
  });
  const routes = new HttpRouteRegistry();
  const logger = createLogger({
    level: "silent",
    service: "test",
    environment: "test",
  });
  const module = new FoundationModule();
  await module.register({
    services: new ServiceContainer(),
    events: new TypedEventBus(),
    health,
    routes,
    permissions: new PermissionRegistry(),
    extensions: new ExtensionRegistry(),
    logger,
  });

  return {
    config: {
      NODE_ENV: "test",
      APP_NAME: "BeyondX",
      APP_URL: "http://localhost:4000",
      API_HOST: "127.0.0.1",
      API_PORT: 4000,
      LOG_LEVEL: "silent",
      DATABASE_URL: "postgresql://test",
      REDIS_URL: "redis://localhost:6379",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "30d",
      PASSWORD_SALT_ROUNDS: 12,
      ADMIN_URL: "http://localhost:3000",
      EMAIL_VERIFICATION_EXPIRES_IN: "24h",
      PASSWORD_RESET_EXPIRES_IN: "1h",
      REFRESH_COOKIE_NAME: "beyondx_refresh",
      REFRESH_COOKIE_SECURE: false,
      LOGIN_MAX_ATTEMPTS: 5,
      LOGIN_LOCK_MINUTES: 15,
      ADMIN_EMAIL: "admin@beyondx.local",
      ADMIN_PASSWORD: "ChangeMe123!",
      ADMIN_FIRST_NAME: "BeyondX",
      ADMIN_LAST_NAME: "Admin",
      CORS_ORIGIN: ["http://localhost:3000"],
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      SMTP_FROM: "no-reply@beyondx.local",
      OPENAPI_ENABLED: true,
      OPENAPI_ROUTE: "/openapi.json",
      DOCS_ROUTE: "/docs",
      RATE_LIMIT_MAX: 100,
      RATE_LIMIT_WINDOW: "1 minute",
      SHUTDOWN_TIMEOUT_MS: 10_000,
      MEDIA_STORAGE_DRIVER: "local",
      MEDIA_LOCAL_ROOT: "./storage/media-test",
      MEDIA_MAX_FILE_SIZE_BYTES: 10_485_760,
      MEDIA_ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
    },
    logger,
    health,
    routes,
    authenticator: {
      authenticateAccessToken: (token: string) =>
        token === "valid-token"
          ? Promise.resolve({ subject: "user-1", permissions: new Set(["platform.status.read"]) })
          : Promise.reject(new Error("invalid token")),
    },
    modules: () => [
      {
        name: "@beyondx/module-foundation",
        version: "0.1.0",
        state: "active",
      },
    ],
    isPluginActive: () => true,
    close: () => Promise.resolve(),
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("BeyondX API", () => {
  it("returns liveness metadata and request id", async () => {
    const app = await createApp(await createDependencies());
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "phase0-test" },
    });
    const body = response.json<HealthResponse>();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      platform: "BeyondX",
      requestId: "phase0-test",
    });
    expect(response.headers["x-request-id"]).toBe("phase0-test");
  });

  it("reports unavailable dependencies with HTTP 503", async () => {
    const app = await createApp(await createDependencies("unhealthy"));
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/ready" });
    const body = response.json<ReadinessResponse>();

    expect(response.statusCode).toBe(503);
    expect(body).toMatchObject({ status: "unavailable" });
  });

  it("serves the platform route contributed by a module", async () => {
    const app = await createApp(await createDependencies());
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/platform",
    });
    const body = response.json<PlatformResponse>();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      name: "BeyondX",
      slogan: "Build Any Digital Product",
    });
  });

  it("publishes OpenAPI and Scalar documentation", async () => {
    const app = await createApp(await createDependencies());
    apps.push(app);

    expect(
      (await app.inject({ method: "GET", url: "/openapi.json" })).statusCode,
    ).toBe(200);

    const documentationResponses = await Promise.all([
      app.inject({ method: "GET", url: "/docs" }),
      app.inject({ method: "GET", url: "/docs/" }),
    ]);
    expect(
      documentationResponses.some((response) => response.statusCode === 200),
    ).toBe(true);
  });

  it("uses a consistent not-found error envelope", async () => {
    const app = await createApp(await createDependencies());
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/missing" });
    const body = response.json<ErrorResponse>();

    expect(response.statusCode).toBe(404);
    expect(body).toHaveProperty("error.requestId");
    expect(body).toMatchObject({ error: { code: "HTTP_ROUTE_NOT_FOUND" } });
  });
  it("normalizes invalid bearer tokens into the identity error envelope", async () => {
    const dependencies = await createDependencies();
    dependencies.routes.register("test", {
      method: "GET",
      path: "/api/v1/invalid-token-test",
      summary: "Invalid token test",
      tags: ["Test"],
      public: false,
      permission: "platform.status.read",
      handler: () => Promise.resolve({ body: { ok: true } }),
    });
    const app = await createApp(dependencies);
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/invalid-token-test",
      headers: { authorization: "Bearer invalid-token" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json<ErrorResponse>()).toMatchObject({
      error: { code: "IDENTITY_INVALID_ACCESS_TOKEN" },
    });
  });

  it("ignores stale bearer tokens on public module routes", async () => {
    const dependencies = await createDependencies();
    dependencies.routes.register("test", {
      method: "POST",
      path: "/api/v1/public-auth-test",
      summary: "Public auth test",
      tags: ["Test"],
      public: true,
      handler: () => Promise.resolve({ body: { ok: true } }),
    });
    const app = await createApp(dependencies);
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/public-auth-test",
      headers: { authorization: "Bearer stale-token" },
    });
    expect(response.statusCode).toBe(200);
  });


  it("gates plugin routes immediately when a plugin is inactive", async () => {
    const dependencies = await createDependencies();
    let active = false;
    dependencies.isPluginActive = () => active;
    dependencies.routes.register("@beyondx/plugin-example", {
      method: "GET",
      path: "/api/v1/plugin-hot-test",
      summary: "Hot plugin route test",
      tags: ["Test"],
      public: true,
      handler: () => Promise.resolve({ body: { ok: true } }),
    });
    const app = await createApp(dependencies);
    apps.push(app);

    const inactive = await app.inject({ method: "GET", url: "/api/v1/plugin-hot-test" });
    expect(inactive.statusCode).toBe(404);
    expect(inactive.json<ErrorResponse>()).toMatchObject({
      error: { code: "PLUGIN_ROUTE_INACTIVE" },
    });

    active = true;
    const activated = await app.inject({ method: "GET", url: "/api/v1/plugin-hot-test" });
    expect(activated.statusCode).toBe(200);

    active = false;
    const deactivated = await app.inject({ method: "GET", url: "/api/v1/plugin-hot-test" });
    expect(deactivated.statusCode).toBe(404);
  });

  it("authenticates bearer tokens before protected module routes", async () => {
    const dependencies = await createDependencies();
    dependencies.routes.register("test", {
      method: "GET",
      path: "/api/v1/protected-test",
      summary: "Protected test",
      tags: ["Test"],
      public: false,
      permission: "platform.status.read",
      handler: () => Promise.resolve({ body: { ok: true } }),
    });
    const app = await createApp(dependencies);
    apps.push(app);
    const unauthorized = await app.inject({ method: "GET", url: "/api/v1/protected-test" });
    const authorized = await app.inject({
      method: "GET",
      url: "/api/v1/protected-test",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(authorized.statusCode).toBe(200);
  });

});
