import type { PrismaClient } from "@beyondx/database";
import type {
  PluginInstallationRecord,
  PluginStateStore,
} from "@beyondx/module-system";

function toRecord(row: {
  name: string;
  version: string;
  enabled: boolean;
  installedAt: Date;
  updatedAt: Date;
}): PluginInstallationRecord {
  return {
    packageName: row.name,
    version: row.version,
    enabled: row.enabled,
    installedAt: row.installedAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPluginStateStore implements PluginStateStore {
  constructor(private readonly database: PrismaClient) {}

  async list(): Promise<PluginInstallationRecord[]> {
    const rows = await this.database.moduleInstallation.findMany({
      where: { name: { startsWith: "@beyondx/plugin-" } },
      orderBy: { name: "asc" },
    });
    return rows.map(toRecord);
  }

  async find(packageName: string): Promise<PluginInstallationRecord | null> {
    const row = await this.database.moduleInstallation.findUnique({
      where: { name: packageName },
    });
    return row ? toRecord(row) : null;
  }

  async install(packageName: string, version: string): Promise<PluginInstallationRecord> {
    const row = await this.database.moduleInstallation.upsert({
      where: { name: packageName },
      update: { version },
      create: { name: packageName, version, enabled: false },
    });
    return toRecord(row);
  }

  async setEnabled(
    packageName: string,
    enabled: boolean,
  ): Promise<PluginInstallationRecord> {
    const row = await this.database.moduleInstallation.update({
      where: { name: packageName },
      data: { enabled },
    });
    return toRecord(row);
  }

  async uninstall(packageName: string): Promise<void> {
    await this.database.moduleInstallation.deleteMany({
      where: { name: packageName },
    });
  }
}
