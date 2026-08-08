import type {
  DataField,
  DataFieldType,
  DataRecord,
  DataRecordStatus,
  DataSchema,
  DataSchemaKind,
  EntityExtension,
  Page,
} from "../domain/models.js";

export interface DataSchemaCreateInput {
  key: string;
  displayName: string;
  pluralName: string;
  description?: string | null;
  kind: DataSchemaKind;
  publicRead: boolean;
}

export interface DataSchemaUpdateInput {
  displayName?: string;
  pluralName?: string;
  description?: string | null;
  publicRead?: boolean;
}

export interface DataFieldCreateInput {
  key: string;
  label: string;
  type: DataFieldType;
  required: boolean;
  repeatable: boolean;
  position: number;
  validation?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  relationTargetSchemaId?: string | null;
}

export interface DataFieldUpdateInput {
  label?: string;
  required?: boolean;
  repeatable?: boolean;
  position?: number;
  validation?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  relationTargetSchemaId?: string | null;
}

export interface DataRecordListInput {
  page: number;
  pageSize: number;
  status?: DataRecordStatus;
}

export interface DataRecordCreateInput {
  status: DataRecordStatus;
  values: Record<string, unknown>;
}

export interface DataRecordUpdateInput {
  status?: DataRecordStatus;
  values?: Record<string, unknown>;
}

export interface SchemaActionContext {
  actorUserId: string | null;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SchemaAuditInput extends SchemaActionContext {
  action: string;
  targetType: string;
  targetId: string | null;
  metadata?: Record<string, unknown>;
}

export interface SchemaRepository {
  listSchemas(): Promise<DataSchema[]>;
  getSchema(id: string): Promise<DataSchema | null>;
  getSchemaByKey(key: string): Promise<DataSchema | null>;
  createSchema(input: DataSchemaCreateInput & { system: boolean }): Promise<DataSchema>;
  updateSchema(id: string, input: DataSchemaUpdateInput): Promise<DataSchema>;
  deleteSchema(id: string): Promise<void>;
  countRecords(schemaId: string): Promise<number>;
  countExtensions(schemaId: string): Promise<number>;

  getField(id: string): Promise<DataField | null>;
  createField(schemaId: string, input: DataFieldCreateInput): Promise<DataField>;
  updateField(id: string, input: DataFieldUpdateInput): Promise<DataField>;
  deleteField(id: string): Promise<void>;
  removeFieldValues(schemaId: string, fieldKey: string): Promise<void>;

  listRecords(schemaId: string, input: DataRecordListInput): Promise<Page<DataRecord>>;
  getRecord(id: string): Promise<DataRecord | null>;
  createRecord(schema: DataSchema, input: DataRecordCreateInput, actorUserId: string | null): Promise<DataRecord>;
  updateRecord(id: string, input: DataRecordUpdateInput, actorUserId: string | null): Promise<DataRecord>;
  deleteRecord(id: string): Promise<void>;
  recordsExist(schemaId: string, ids: readonly string[]): Promise<boolean>;
  mediaExist(ids: readonly string[]): Promise<boolean>;
  recordValueExists(schemaId: string, fieldKey: string, value: string, excludeRecordId?: string): Promise<boolean>;

  getExtension(schemaId: string, targetType: string, targetId: string): Promise<EntityExtension | null>;
  listExtensions(schemaId: string, targetType: string, targetIds: readonly string[]): Promise<EntityExtension[]>;
  upsertExtension(schema: DataSchema, targetType: string, targetId: string, values: Record<string, unknown>): Promise<EntityExtension>;
  deleteExtension(schemaId: string, targetType: string, targetId: string): Promise<void>;

  audit(input: SchemaAuditInput): Promise<void>;
}
