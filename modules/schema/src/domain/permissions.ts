export const SCHEMA_PERMISSIONS = Object.freeze([
  { id: "schema.builder.read", description: "Read dynamic schemas and field definitions" },
  { id: "schema.builder.manage", description: "Create and modify dynamic schemas and fields" },
  { id: "schema.records.read", description: "Read dynamic records" },
  { id: "schema.records.create", description: "Create dynamic records" },
  { id: "schema.records.update", description: "Update dynamic records and system extensions" },
  { id: "schema.records.delete", description: "Delete dynamic records" },
] as const);

export type SchemaPermission = (typeof SCHEMA_PERMISSIONS)[number]["id"];
