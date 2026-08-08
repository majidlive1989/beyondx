import type { Prisma, PrismaClient } from "@beyondx/database";
import type { PluginRuntime, PluginRuntimeState } from "@beyondx/module-system";

export interface PluginMutationContext {
  actorUserId: string;
  requestId: string;
  ipAddress: string;
  userAgent?: string;
}

export class PluginManagerService {
  constructor(
    private readonly database: PrismaClient,
    private readonly runtime: PluginRuntime,
  ) {}

  list(): Promise<PluginRuntimeState[]> {
    return this.runtime.listStates();
  }

  async install(id: string, context: PluginMutationContext): Promise<PluginRuntimeState> {
    const state = await this.runtime.install(id);
    try {
      await this.provisionPermissions(id);
      await this.audit("plugin.install", id, context, { version: state.version });
      return state;
    } catch (error) {
      await this.runtime.uninstall(id).catch(() => undefined);
      throw error;
    }
  }

  async enable(id: string, context: PluginMutationContext): Promise<PluginRuntimeState> {
    const state = await this.runtime.enable(id);
    await this.audit("plugin.enable", id, context, { hotApplied: true });
    return state;
  }

  async disable(id: string, context: PluginMutationContext): Promise<PluginRuntimeState> {
    const state = await this.runtime.disable(id);
    await this.audit("plugin.disable", id, context, { hotApplied: true });
    return state;
  }

  async uninstall(id: string, context: PluginMutationContext): Promise<PluginRuntimeState> {
    const state = await this.runtime.uninstall(id);
    const definition = this.runtime.registry.get(id);
    await this.database.permission.deleteMany({
      where: { module: definition.manifest.packageName },
    });
    await this.audit("plugin.uninstall", id, context, { dataPreserved: true });
    return state;
  }

  private async provisionPermissions(id: string): Promise<void> {
    const definition = this.runtime.registry.get(id);
    const { manifest } = definition;

    for (const permission of manifest.permissions) {
      await this.database.permission.upsert({
        where: { id: permission.id },
        update: {
          description: permission.description,
          module: manifest.packageName,
        },
        create: {
          id: permission.id,
          description: permission.description,
          module: manifest.packageName,
        },
      });
    }

    if (manifest.permissions.length === 0) return;
    const roles = await this.database.role.findMany({
      where: { name: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
    });
    const permissionIds = manifest.permissions.map((permission) => permission.id);
    await this.database.rolePermission.createMany({
      data: roles.flatMap((role) =>
        permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      ),
      skipDuplicates: true,
    });
  }

  private async audit(
    action: string,
    pluginId: string,
    context: PluginMutationContext,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        action,
        targetType: "plugin",
        targetId: pluginId,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        ...(context.userAgent === undefined ? {} : { userAgent: context.userAgent }),
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
