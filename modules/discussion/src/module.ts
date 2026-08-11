import {
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
  type ServiceToken,
} from "@beyondx/core";
import type { PrismaClient } from "@beyondx/database";
import { createDiscussionRoutes } from "./api/routes.js";
import { DiscussionService } from "./application/discussion-service.js";
import { DISCUSSION_PERMISSIONS } from "./domain/permissions.js";

export const DISCUSSION_SERVICE: ServiceToken<DiscussionService> = Object.freeze({
  key: "discussion.service",
});

export const DISCUSSION_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/plugin-discussion",
  displayName: "Comments & Reviews",
  version: "1.0.0",
  description: "Moderated comments, product reviews, ratings and replies",
  dependencies: [
    "@beyondx/module-foundation",
    "@beyondx/module-identity",
    "@beyondx/module-content",
  ],
  optionalDependencies: ["@beyondx/plugin-catalog"],
  permissions: DISCUSSION_PERMISSIONS.map((permission) => permission.id),
  capabilities: [
    "discussion.comments",
    "discussion.product-reviews",
    "discussion.ratings",
    "discussion.replies",
    "discussion.moderation",
  ],
});

export interface DiscussionModuleOptions {
  database: PrismaClient;
}

export class DiscussionModule implements BeyondXModule {
  readonly manifest = DISCUSSION_MANIFEST;

  constructor(private readonly options: DiscussionModuleOptions) {}

  register(context: ModuleContext): Promise<void> {
    const service = new DiscussionService(this.options.database);
    context.services.registerValue(DISCUSSION_SERVICE, service);

    for (const permission of DISCUSSION_PERMISSIONS) {
      context.permissions.register({ ...permission, module: this.manifest.name });
    }

    for (const route of createDiscussionRoutes(service)) {
      context.routes.register(this.manifest.name, route);
    }

    context.health.register({
      id: "module.discussion",
      critical: false,
      check: async () => ({
        status: "healthy",
        message: "Discussion persistence is available",
        metadata: {
          entryCount: await this.options.database.discussionEntry.count(),
        },
      }),
    });

    return Promise.resolve();
  }

  async boot(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "discussion.module.booted",
      version: 1,
      payload: { module: this.manifest.name, version: this.manifest.version },
    });
    context.logger.info({ module: this.manifest.name }, "Discussion plugin activated");
  }

  async shutdown(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "discussion.module.stopping",
      version: 1,
      payload: { module: this.manifest.name },
    });
    context.logger.info({ module: this.manifest.name }, "Discussion plugin deactivated");
  }
}
