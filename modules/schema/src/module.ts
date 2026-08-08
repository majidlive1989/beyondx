import {
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
  type ServiceToken,
} from "@beyondx/core";
import type { PrismaClient } from "@beyondx/database";
import { createSchemaRoutes } from "./api/routes.js";
import { SchemaService } from "./application/schema-service.js";
import { SCHEMA_PERMISSIONS } from "./domain/permissions.js";
import { PrismaSchemaRepository } from "./infrastructure/prisma-schema-repository.js";

export const SCHEMA_SERVICE: ServiceToken<SchemaService> = Object.freeze({ key: "schema.service" });

export interface SchemaModuleOptions { database: PrismaClient; }

export const SCHEMA_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/module-schema",
  displayName: "Schema Engine",
  version: "0.4.0",
  description: "Strapi-style data model builder, generated CRUD and system entity extensions",
  dependencies: ["@beyondx/module-foundation", "@beyondx/module-identity", "@beyondx/module-media"],
  optionalDependencies: [],
  permissions: SCHEMA_PERMISSIONS.map((permission) => permission.id),
  capabilities: ["schema.builder", "schema.dynamic-records", "schema.generated-api", "schema.system-extensions"],
});

export class SchemaModule implements BeyondXModule {
  readonly manifest = SCHEMA_MANIFEST;
  constructor(private readonly options: SchemaModuleOptions) {}

  register(context: ModuleContext): Promise<void> {
    const service = new SchemaService(new PrismaSchemaRepository(this.options.database));
    context.services.registerValue(SCHEMA_SERVICE, service);
    for (const permission of SCHEMA_PERMISSIONS) context.permissions.register({ ...permission, module: this.manifest.name });
    for (const route of createSchemaRoutes(service)) context.routes.register(this.manifest.name, route);
    context.health.register({
      id: "module.schema",
      critical: false,
      check: async () => ({
        status: "healthy",
        message: "Dynamic schema engine is available",
        metadata: {
          schemaCount: await this.options.database.dataSchema.count(),
          recordCount: await this.options.database.dataRecord.count(),
        },
      }),
    });
    return Promise.resolve();
  }

  async boot(context: ModuleContext): Promise<void> {
    await context.events.publish({ name: "schema.module.booted", version: 1, payload: { module: this.manifest.name, version: this.manifest.version } });
    context.logger.info({ module: this.manifest.name }, "Schema engine booted");
  }

  async shutdown(context: ModuleContext): Promise<void> {
    await context.events.publish({ name: "schema.module.stopping", version: 1, payload: { module: this.manifest.name } });
    context.logger.info({ module: this.manifest.name }, "Schema engine stopped");
  }
}
