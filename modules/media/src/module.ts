import {
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
  type ServiceToken,
} from "@beyondx/core";
import type { PrismaClient } from "@beyondx/database";
import { MediaService } from "./application/media-service.js";
import { createMediaRoutes } from "./api/routes.js";
import { MEDIA_PERMISSIONS } from "./domain/permissions.js";
import { LocalStorageAdapter } from "./infrastructure/local-storage-adapter.js";
import { PrismaMediaRepository } from "./infrastructure/prisma-media-repository.js";

export const MEDIA_SERVICE: ServiceToken<MediaService> = Object.freeze({
  key: "media.service",
});

export interface MediaModuleOptions {
  database: PrismaClient;
  storageDriver: "local";
  localRoot: string;
  maxFileSizeBytes: number;
  allowedMimeTypes: readonly string[];
}

export const MEDIA_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/module-media",
  displayName: "Media Module",
  version: "0.3.0",
  description: "Media library, secure uploads, pluggable storage and image metadata management",
  dependencies: ["@beyondx/module-foundation", "@beyondx/module-identity"],
  optionalDependencies: [],
  permissions: MEDIA_PERMISSIONS.map((permission) => permission.id),
  capabilities: [
    "media.library",
    "media.upload",
    "media.storage",
    "media.images",
  ],
});

export class MediaModule implements BeyondXModule {
  readonly manifest = MEDIA_MANIFEST;

  constructor(private readonly options: MediaModuleOptions) {}

  register(context: ModuleContext): Promise<void> {
    const storage = this.createStorageAdapter();
    const repository = new PrismaMediaRepository(this.options.database);
    const service = new MediaService(repository, storage, {
      maxFileSizeBytes: this.options.maxFileSizeBytes,
      allowedMimeTypes: new Set(this.options.allowedMimeTypes),
    });

    context.services.registerValue(MEDIA_SERVICE, service);
    for (const permission of MEDIA_PERMISSIONS) {
      context.permissions.register({
        ...permission,
        module: this.manifest.name,
      });
    }
    for (const route of createMediaRoutes(service)) {
      context.routes.register(this.manifest.name, route);
    }
    context.health.register({
      id: "module.media",
      critical: true,
      check: async () => {
        await this.options.database.mediaAsset.count();
        await storage.health();
        return {
          status: "healthy",
          message: "Media persistence and storage are available",
          metadata: { provider: storage.provider },
        };
      },
    });
    return Promise.resolve();
  }

  async boot(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "media.module.booted",
      version: 1,
      payload: { module: this.manifest.name, version: this.manifest.version },
    });
    context.logger.info({ module: this.manifest.name }, "Media module booted");
  }

  async shutdown(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "media.module.stopping",
      version: 1,
      payload: { module: this.manifest.name },
    });
    context.logger.info({ module: this.manifest.name }, "Media module stopped");
  }

  private createStorageAdapter(): LocalStorageAdapter {
    switch (this.options.storageDriver) {
      case "local":
        return new LocalStorageAdapter(this.options.localRoot);
    }
  }
}
