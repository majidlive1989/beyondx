import type { HttpRouteDefinition, ServiceContainer } from "@beyondx/core";
import { PLATFORM_INFO_SERVICE } from "../application/get-platform-info.js";
import type { GetPlatformInfoService } from "../application/get-platform-info.js";

export function createPlatformRoute(services: ServiceContainer): HttpRouteDefinition {
  return {
    method: "GET",
    path: "/api/v1/platform",
    summary: "Platform identity",
    tags: ["Platform"],
    public: true,
    schema: {
      response: {
        200: {
          type: "object",
          required: ["name", "slogan", "version", "apiVersion"],
          properties: {
            name: { type: "string" },
            slogan: { type: "string" },
            version: { type: "string" },
            apiVersion: { type: "string" },
          },
        },
      },
    },
    handler: () =>
      Promise.resolve({
        body: services.resolve<GetPlatformInfoService>(PLATFORM_INFO_SERVICE).execute(),
      }),
  };
}
