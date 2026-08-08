import type { HttpRequestContext, HttpRouteDefinition } from "@beyondx/core";
import { parseInput } from "@beyondx/validation";
import { z } from "zod";
import type { PluginManagerService, PluginMutationContext } from "../application/plugin-manager-service.js";

const pluginParams = z.object({ id: z.string().regex(/^[a-z][a-z0-9-]*$/) });

function mutationContext(context: HttpRequestContext): PluginMutationContext {
  const userAgentHeader = context.headers["user-agent"];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
  return {
    actorUserId: context.principal?.subject ?? "unknown",
    requestId: context.requestId,
    ipAddress: context.ip,
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}

export function createPluginManagerRoutes(service: PluginManagerService): HttpRouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/v1/runtime/plugins",
      summary: "List active plugin contributions for the authenticated admin shell",
      tags: ["Plugins"],
      public: false,
      permission: "identity.profile.read",
      handler: async () => ({
        body: {
          items: (await service.list()).filter((plugin) => plugin.active),
        },
      }),
    },
    {
      method: "GET",
      path: "/api/v1/admin/plugins",
      summary: "List available and installed plugins",
      tags: ["Plugins Admin"],
      public: false,
      permission: "plugins.read",
      handler: async () => ({ body: { items: await service.list() } }),
    },
    ...(["install", "enable", "disable", "uninstall"] as const).map(
      (action): HttpRouteDefinition => ({
        method: "POST",
        path: `/api/v1/admin/plugins/:id/${action}`,
        summary: `${action[0]?.toUpperCase() ?? ""}${action.slice(1)} a plugin`,
        tags: ["Plugins Admin"],
        public: false,
        permission: "plugins.manage",
        handler: async (context) => {
          const { id } = parseInput(pluginParams, context.params);
          const actor = mutationContext(context);
          const state = await service[action](id, actor);
          return { body: { plugin: state } };
        },
      }),
    ),
  ];
}
