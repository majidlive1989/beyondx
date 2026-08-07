import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import { AppError } from "@beyondx/core";
import { registerGlobalErrorHandler } from "./error-handler.js";
import { registerModuleRoutes } from "./module-routes.js";
import type { ApplicationDependencies, BeyondXFastifyInstance } from "./types.js";

function toAbsoluteRoute(route: string): `/${string}` {
  if (!route.startsWith("/")) {
    throw new Error(`Route must start with "/": ${route}`);
  }

  return route as `/${string}`;
}

export async function createApp(
  dependencies: ApplicationDependencies,
): Promise<BeyondXFastifyInstance> {
  const { config, logger, health, routes, authenticator } = dependencies;
  const app: BeyondXFastifyInstance = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    requestIdHeader: "x-request-id",
    disableRequestLogging: false,
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    keyGenerator: (request) => request.ip,
  });

  if (config.OPENAPI_ENABLED) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "BeyondX API",
          description: "API-first modular digital product platform",
          version: "0.2.0",
        },
        servers: [{ url: config.APP_URL }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        tags: [
          { name: "System", description: "Platform health and readiness" },
          { name: "Platform", description: "Platform metadata" },
          { name: "Identity", description: "Authentication and personal identity" },
          { name: "Identity Admin", description: "Users, roles, permissions, sessions and audit" },
        ],
      },
    });
  }

  registerGlobalErrorHandler(app);

  app.addHook("onRequest", async (request) => {
    const authorization = request.headers.authorization;
    if (!authorization) return;
    const [scheme, token, extra] = authorization.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
      throw new AppError({
        code: "IDENTITY_INVALID_AUTHORIZATION_HEADER",
        message: "Authorization header must use the Bearer scheme",
        statusCode: 401,
      });
    }
    try {
      request.principal = await authenticator.authenticateAccessToken(token);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        code: "IDENTITY_INVALID_ACCESS_TOKEN",
        message: "Access token is invalid",
        statusCode: 401,
        cause: error,
      });
    }
  });

  app.addHook("onSend", (request, reply, payload, done) => {
    reply.header("x-request-id", request.id);
    done(null, payload);
  });

  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Liveness check",
        response: {
          200: {
            type: "object",
            required: ["status", "platform", "uptimeSeconds", "timestamp", "requestId"],
            properties: {
              status: { type: "string" },
              platform: { type: "string" },
              uptimeSeconds: { type: "number" },
              timestamp: { type: "string", format: "date-time" },
              requestId: { type: "string" },
            },
          },
        },
      },
    },
    (request) => ({
      status: "ok",
      platform: config.APP_NAME,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      requestId: request.id,
    }),
  );

  app.get(
    "/ready",
    {
      schema: {
        tags: ["System"],
        summary: "Readiness check",
      },
    },
    async (request, reply) => {
      const checks = await health.runAll();
      const unavailable = checks.some(
        (check) => check.critical && check.status === "unhealthy",
      );
      const degraded = checks.some((check) => check.status === "degraded");
      const status = unavailable ? "unavailable" : degraded ? "degraded" : "ready";

      return reply.status(unavailable ? 503 : 200).send({
        status,
        checks,
        timestamp: new Date().toISOString(),
        requestId: request.id,
      });
    },
  );

  registerModuleRoutes(app, routes);

  if (config.OPENAPI_ENABLED) {
    app.get(
      config.OPENAPI_ROUTE,
      { schema: { hide: true } },
      (_request, reply) => reply.type("application/json").send(app.swagger()),
    );
    await app.register(scalar, {
      routePrefix: toAbsoluteRoute(config.DOCS_ROUTE),
      configuration: {
        url: config.OPENAPI_ROUTE,
        pageTitle: "BeyondX API Reference",
      },
    });
  }

  await app.ready();
  return app;
}
