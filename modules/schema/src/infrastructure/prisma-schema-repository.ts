import { Prisma, type PrismaClient } from "@beyondx/database";
import type {
  DataFieldCreateInput,
  DataFieldUpdateInput,
  DataRecordCreateInput,
  DataRecordListInput,
  DataRecordUpdateInput,
  DataSchemaCreateInput,
  DataSchemaUpdateInput,
  SchemaAuditInput,
  SchemaRepository,
} from "../application/contracts.js";
import type {
  DataField,
  DataRecord,
  DataRecordStatus,
  DataSchema,
  EntityExtension,
  Page,
} from "../domain/models.js";

const schemaInclude = {
  fields: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
};

export class PrismaSchemaRepository implements SchemaRepository {
  constructor(private readonly database: PrismaClient) {}

  async listSchemas(): Promise<DataSchema[]> {
    const rows = await this.database.dataSchema.findMany({ include: schemaInclude, orderBy: [{ system: "desc" }, { displayName: "asc" }] });
    return rows.map(mapSchema);
  }

  async getSchema(id: string): Promise<DataSchema | null> {
    const row = await this.database.dataSchema.findUnique({ where: { id }, include: schemaInclude });
    return row ? mapSchema(row) : null;
  }

  async getSchemaByKey(key: string): Promise<DataSchema | null> {
    const row = await this.database.dataSchema.findUnique({ where: { key }, include: schemaInclude });
    return row ? mapSchema(row) : null;
  }

  async createSchema(input: DataSchemaCreateInput & { system: boolean }): Promise<DataSchema> {
    const row = await this.database.dataSchema.create({
      data: {
        key: input.key,
        displayName: input.displayName,
        pluralName: input.pluralName,
        ...(input.description === undefined ? {} : { description: input.description }),
        kind: input.kind,
        publicRead: input.publicRead,
        system: input.system,
      },
      include: schemaInclude,
    });
    return mapSchema(row);
  }

  async updateSchema(id: string, input: DataSchemaUpdateInput): Promise<DataSchema> {
    const row = await this.database.dataSchema.update({
      where: { id },
      data: {
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
        ...(input.pluralName === undefined ? {} : { pluralName: input.pluralName }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.publicRead === undefined ? {} : { publicRead: input.publicRead }),
      },
      include: schemaInclude,
    });
    return mapSchema(row);
  }

  async deleteSchema(id: string): Promise<void> {
    await this.database.dataSchema.delete({ where: { id } });
  }

  countRecords(schemaId: string): Promise<number> {
    return this.database.dataRecord.count({ where: { schemaId } });
  }

  countExtensions(schemaId: string): Promise<number> {
    return this.database.entityExtension.count({ where: { schemaId } });
  }

  async getField(id: string): Promise<DataField | null> {
    const row = await this.database.dataField.findUnique({ where: { id } });
    return row ? mapField(row) : null;
  }

  async createField(schemaId: string, input: DataFieldCreateInput): Promise<DataField> {
    const row = await this.database.dataField.create({
      data: {
        schemaId,
        key: input.key,
        label: input.label,
        type: input.type,
        required: input.required,
        repeatable: input.repeatable,
        position: input.position,
        ...(input.validation === undefined ? {} : { validation: toJsonInput(input.validation) }),
        ...(input.settings === undefined ? {} : { settings: toJsonInput(input.settings) }),
        ...(input.relationTargetSchemaId === undefined ? {} : { relationTargetSchemaId: input.relationTargetSchemaId }),
      },
    });
    return mapField(row);
  }

  async updateField(id: string, input: DataFieldUpdateInput): Promise<DataField> {
    const row = await this.database.dataField.update({
      where: { id },
      data: {
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.required === undefined ? {} : { required: input.required }),
        ...(input.repeatable === undefined ? {} : { repeatable: input.repeatable }),
        ...(input.position === undefined ? {} : { position: input.position }),
        ...(input.validation === undefined ? {} : { validation: toJsonInput(input.validation) }),
        ...(input.settings === undefined ? {} : { settings: toJsonInput(input.settings) }),
        ...(input.relationTargetSchemaId === undefined ? {} : { relationTargetSchemaId: input.relationTargetSchemaId }),
      },
    });
    return mapField(row);
  }

  async deleteField(id: string): Promise<void> {
    await this.database.dataField.delete({ where: { id } });
  }

  async removeFieldValues(schemaId: string, fieldKey: string): Promise<void> {
    await this.database.$transaction([
      this.database.$executeRaw(Prisma.sql`
        UPDATE "data_records"
        SET "values" = "values" - ${fieldKey}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "schemaId" = ${schemaId}
      `),
      this.database.$executeRaw(Prisma.sql`
        UPDATE "entity_extensions"
        SET "values" = "values" - ${fieldKey}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "schemaId" = ${schemaId}
      `),
    ]);
  }

  async listRecords(schemaId: string, input: DataRecordListInput): Promise<Page<DataRecord>> {
    const where: Prisma.DataRecordWhereInput = {
      schemaId,
      ...(input.status === undefined ? {} : { status: input.status }),
    };
    const [rows, total] = await this.database.$transaction([
      this.database.dataRecord.findMany({
        where,
        include: { schema: { select: { key: true } } },
        orderBy: { updatedAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.dataRecord.count({ where }),
    ]);
    return {
      items: rows.map(mapRecord),
      page: input.page,
      pageSize: input.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  }

  async getRecord(id: string): Promise<DataRecord | null> {
    const row = await this.database.dataRecord.findUnique({ where: { id }, include: { schema: { select: { key: true } } } });
    return row ? mapRecord(row) : null;
  }

  async createRecord(schema: DataSchema, input: DataRecordCreateInput, actorUserId: string | null): Promise<DataRecord> {
    const row = await this.database.dataRecord.create({
      data: {
        schemaId: schema.id,
        status: input.status,
        values: input.values as Prisma.InputJsonValue,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
      include: { schema: { select: { key: true } } },
    });
    return mapRecord(row);
  }

  async updateRecord(id: string, input: DataRecordUpdateInput, actorUserId: string | null): Promise<DataRecord> {
    const row = await this.database.dataRecord.update({
      where: { id },
      data: {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.values === undefined ? {} : { values: input.values as Prisma.InputJsonValue }),
        updatedById: actorUserId,
      },
      include: { schema: { select: { key: true } } },
    });
    return mapRecord(row);
  }

  async deleteRecord(id: string): Promise<void> {
    await this.database.dataRecord.delete({ where: { id } });
  }

  async recordsExist(schemaId: string, ids: readonly string[]): Promise<boolean> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return true;
    const count = await this.database.dataRecord.count({ where: { schemaId, id: { in: unique } } });
    return count === unique.length;
  }

  async mediaExist(ids: readonly string[]): Promise<boolean> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return true;
    const count = await this.database.mediaAsset.count({ where: { id: { in: unique } } });
    return count === unique.length;
  }

  async recordValueExists(schemaId: string, fieldKey: string, value: string, excludeRecordId?: string): Promise<boolean> {
    const rows = excludeRecordId === undefined
      ? await this.database.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
          SELECT EXISTS (
            SELECT 1 FROM "data_records"
            WHERE "schemaId" = ${schemaId}
              AND "values" ->> ${fieldKey} = ${value}
          ) AS "exists"
        `)
      : await this.database.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
          SELECT EXISTS (
            SELECT 1 FROM "data_records"
            WHERE "schemaId" = ${schemaId}
              AND "id" <> ${excludeRecordId}
              AND "values" ->> ${fieldKey} = ${value}
          ) AS "exists"
        `);
    return rows[0]?.exists ?? false;
  }

  async findRecordByStringValue(
    schemaId: string,
    fieldKey: string,
    value: string,
    status?: DataRecordStatus,
  ): Promise<DataRecord | null> {
    const rows = status === undefined
      ? await this.database.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id"
          FROM "data_records"
          WHERE "schemaId" = ${schemaId}
            AND "values" ->> ${fieldKey} = ${value}
          ORDER BY "updatedAt" DESC
          LIMIT 1
        `)
      : await this.database.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id"
          FROM "data_records"
          WHERE "schemaId" = ${schemaId}
            AND "status"::text = ${status}
            AND "values" ->> ${fieldKey} = ${value}
          ORDER BY "updatedAt" DESC
          LIMIT 1
        `);
    const id = rows[0]?.id;
    return id ? this.getRecord(id) : null;
  }

  async getExtension(schemaId: string, targetType: string, targetId: string): Promise<EntityExtension | null> {
    const row = await this.database.entityExtension.findUnique({
      where: { schemaId_targetType_targetId: { schemaId, targetType, targetId } },
      include: { schema: { select: { key: true } } },
    });
    return row ? mapExtension(row) : null;
  }

  async listExtensions(schemaId: string, targetType: string, targetIds: readonly string[]): Promise<EntityExtension[]> {
    if (targetIds.length === 0) return [];
    const rows = await this.database.entityExtension.findMany({
      where: { schemaId, targetType, targetId: { in: [...new Set(targetIds)] } },
      include: { schema: { select: { key: true } } },
    });
    return rows.map(mapExtension);
  }

  async upsertExtension(schema: DataSchema, targetType: string, targetId: string, values: Record<string, unknown>): Promise<EntityExtension> {
    const row = await this.database.entityExtension.upsert({
      where: { schemaId_targetType_targetId: { schemaId: schema.id, targetType, targetId } },
      update: { values: values as Prisma.InputJsonValue },
      create: { schemaId: schema.id, targetType, targetId, values: values as Prisma.InputJsonValue },
      include: { schema: { select: { key: true } } },
    });
    return mapExtension(row);
  }

  async deleteExtension(schemaId: string, targetType: string, targetId: string): Promise<void> {
    await this.database.entityExtension.deleteMany({ where: { schemaId, targetType, targetId } });
  }

  async audit(input: SchemaAuditInput): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: toJsonInput(input.metadata ?? null),
      },
    });
  }
}

function mapSchema(row: {
  id: string;
  key: string;
  displayName: string;
  pluralName: string;
  description: string | null;
  kind: "COLLECTION" | "SINGLE" | "COMPONENT" | "SYSTEM_EXTENSION";
  publicRead: boolean;
  system: boolean;
  fields: Array<{
    id: string;
    schemaId: string;
    key: string;
    label: string;
    type: "TEXT" | "LONG_TEXT" | "RICH_TEXT" | "UID" | "NUMBER" | "BOOLEAN" | "DATE" | "JSON" | "ENUM" | "MEDIA" | "RELATION" | "COMPONENT" | "DYNAMIC_ZONE";
    required: boolean;
    repeatable: boolean;
    position: number;
    validation: Prisma.JsonValue | null;
    settings: Prisma.JsonValue | null;
    relationTargetSchemaId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}): DataSchema {
  return { ...row, fields: row.fields.map(mapField) };
}

function mapField(row: {
  id: string;
  schemaId: string;
  key: string;
  label: string;
  type: "TEXT" | "LONG_TEXT" | "RICH_TEXT" | "UID" | "NUMBER" | "BOOLEAN" | "DATE" | "JSON" | "ENUM" | "MEDIA" | "RELATION" | "COMPONENT" | "DYNAMIC_ZONE";
  required: boolean;
  repeatable: boolean;
  position: number;
  validation: Prisma.JsonValue | null;
  settings: Prisma.JsonValue | null;
  relationTargetSchemaId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DataField {
  return {
    ...row,
    validation: asRecord(row.validation),
    settings: asRecord(row.settings),
  };
}

function mapRecord(row: {
  id: string;
  schemaId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  values: Prisma.JsonValue;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  schema: { key: string };
}): DataRecord {
  return {
    id: row.id,
    schemaId: row.schemaId,
    schemaKey: row.schema.key,
    status: row.status,
    values: asRequiredRecord(row.values),
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapExtension(row: {
  id: string;
  schemaId: string;
  targetType: string;
  targetId: string;
  values: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  schema: { key: string };
}): EntityExtension {
  return {
    id: row.id,
    schemaId: row.schemaId,
    schemaKey: row.schema.key,
    targetType: row.targetType,
    targetId: row.targetId,
    values: asRequiredRecord(row.values),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (value === null || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asRequiredRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return asRecord(value) ?? {};
}

function toJsonInput(value: Record<string, unknown> | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
