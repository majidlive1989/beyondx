import {
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
  type ServiceToken,
} from "@beyondx/core";
import type { PrismaClient } from "@beyondx/database";
import { createContentRoutes } from "./api/routes.js";
import { ContentService } from "./application/content-service.js";
import { CONTENT_PERMISSIONS } from "./domain/permissions.js";
import { PrismaContentRepository } from "./infrastructure/prisma-content-repository.js";

export const CONTENT_SERVICE: ServiceToken<ContentService> = Object.freeze({ key: "content.service" });

export interface ContentModuleOptions {
  database: PrismaClient;
  scheduleIntervalMs?: number;
}

export const CONTENT_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/module-content",
  displayName: "CMS and Content",
  version: "0.3.0",
  description: "Content types, entries, revisions, localization, SEO, relations and publishing workflows",
  dependencies: ["@beyondx/module-foundation", "@beyondx/module-identity"],
  optionalDependencies: [],
  permissions: CONTENT_PERMISSIONS.map((permission) => permission.id),
  capabilities: [
    "content.types",
    "content.entries",
    "content.revisions",
    "content.localization",
    "content.seo",
    "content.relations",
    "content.scheduling",
  ],
});

export class ContentModule implements BeyondXModule {
  readonly manifest = CONTENT_MANIFEST;
  private service: ContentService | undefined;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly options: ContentModuleOptions) {}

  register(context: ModuleContext): Promise<void> {
    const service = new ContentService(new PrismaContentRepository(this.options.database));
    this.service = service;
    context.services.registerValue(CONTENT_SERVICE, service);
    for (const permission of CONTENT_PERMISSIONS) {
      context.permissions.register({ ...permission, module: this.manifest.name });
    }
    for (const route of createContentRoutes(service)) {
      context.routes.register(this.manifest.name, route);
    }
    context.health.register({
      id: "module.content",
      critical: false,
      check: async () => {
        const contentTypeCount = await this.options.database.contentType.count();
        return {
          status: "healthy",
          message: "Content persistence is available",
          metadata: { contentTypeCount },
        };
      },
    });
    return Promise.resolve();
  }

  async boot(context: ModuleContext): Promise<void> {
    const service = this.requireService();
    const published = await service.processScheduledPublications();
    const intervalMs = Math.max(15_000, this.options.scheduleIntervalMs ?? 60_000);
    this.timer = setInterval(() => {
      void service.processScheduledPublications().then((count) => {
        if (count > 0) context.logger.info({ module: this.manifest.name, count }, "Scheduled content published");
      }).catch((error: unknown) => {
        context.logger.error({ module: this.manifest.name, error: error instanceof Error ? error.message : String(error) }, "Scheduled content publication failed");
      });
    }, intervalMs);
    this.timer.unref();
    await context.events.publish({
      name: "content.module.booted",
      version: 1,
      payload: { module: this.manifest.name, version: this.manifest.version, publishedScheduledEntries: published },
    });
    context.logger.info({ module: this.manifest.name }, "Content module booted");
  }

  async shutdown(context: ModuleContext): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await context.events.publish({ name: "content.module.stopping", version: 1, payload: { module: this.manifest.name } });
    context.logger.info({ module: this.manifest.name }, "Content module stopped");
  }

  private requireService(): ContentService {
    if (!this.service) throw new Error("Content module was not registered before boot");
    return this.service;
  }
}
