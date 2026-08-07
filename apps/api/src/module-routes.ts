import { AppError, type HttpRouteRegistry } from "@beyondx/core";
import type { BeyondXFastifyInstance } from "./types.js";

export function registerModuleRoutes(
  app: BeyondXFastifyInstance,
  routes: HttpRouteRegistry,
): void {
  for (const route of routes.list()) {
    app.route({
      method: route.method,
      url: route.path,
      schema: {
        tags: route.tags,
        summary: route.summary,
        security: route.public ? [] : [{ bearerAuth: [] }],
        ...(route.schema ?? {}),
      },
      handler: async (request, reply) => {
        if (!route.public) {
          if (!request.principal) {
            throw new AppError({
              code: "IDENTITY_AUTHENTICATION_REQUIRED",
              message: "Authentication is required",
              statusCode: 401,
            });
          }
          if (route.permission && !request.principal.permissions.has(route.permission)) {
            throw new AppError({
              code: "IDENTITY_PERMISSION_DENIED",
              message: "You do not have permission to perform this action",
              statusCode: 403,
              details: { permission: route.permission },
            });
          }
        }

        const response = await route.handler({
          requestId: request.id,
          ip: request.ip,
          params: request.params,
          query: request.query,
          body: request.body,
          headers: request.headers,
          ...(request.principal ? { principal: request.principal } : {}),
        });
        for (const [name, value] of Object.entries(response.headers ?? {})) {
          reply.header(name, value);
        }
        return reply.status(response.statusCode ?? 200).send(response.body);
      },
    });
  }
}
