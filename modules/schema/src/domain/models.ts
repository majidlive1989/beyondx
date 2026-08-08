export type DataSchemaKind = "COLLECTION" | "SINGLE" | "COMPONENT" | "SYSTEM_EXTENSION";
export type DataFieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "RICH_TEXT"
  | "UID"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "JSON"
  | "ENUM"
  | "MEDIA"
  | "RELATION"
  | "COMPONENT"
  | "DYNAMIC_ZONE";
export type DataRecordStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface DataField {
  id: string;
  schemaId: string;
  key: string;
  label: string;
  type: DataFieldType;
  required: boolean;
  repeatable: boolean;
  position: number;
  validation: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  relationTargetSchemaId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSchema {
  id: string;
  key: string;
  displayName: string;
  pluralName: string;
  description: string | null;
  kind: DataSchemaKind;
  publicRead: boolean;
  system: boolean;
  fields: DataField[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataRecord {
  id: string;
  schemaId: string;
  schemaKey: string;
  status: DataRecordStatus;
  values: Record<string, unknown>;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityExtension {
  id: string;
  schemaId: string;
  schemaKey: string;
  targetType: string;
  targetId: string;
  values: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}
