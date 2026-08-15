import { AppError } from "@beyondx/core";
import type {
  DataFieldCreateInput,
  DataFieldUpdateInput,
  DataRecordCreateInput,
  DataRecordListInput,
  DataRecordUpdateInput,
  DataSchemaCreateInput,
  DataSchemaUpdateInput,
  SchemaActionContext,
  SchemaRepository,
} from "./contracts.js";
import type {
  DataField,
  DataRecord,
  DataSchema,
  EntityExtension,
  Page,
} from "../domain/models.js";

interface DynamicZoneItem {
  component: string;
  data: Record<string, unknown>;
}

export class SchemaService {
  constructor(private readonly repository: SchemaRepository) {}

  listSchemas(): Promise<DataSchema[]> {
    return this.repository.listSchemas();
  }

  async getSchema(id: string): Promise<DataSchema> {
    const schema = await this.repository.getSchema(id);
    if (!schema) throw notFound("SCHEMA_NOT_FOUND", "Schema was not found");
    return schema;
  }

  async getSchemaByKey(key: string): Promise<DataSchema> {
    const schema = await this.repository.getSchemaByKey(normalizeKey(key));
    if (!schema) throw notFound("SCHEMA_NOT_FOUND", "Schema was not found");
    return schema;
  }

  async ensureSystemExtensionSchema(input: {
    key: string;
    displayName: string;
    pluralName: string;
    description?: string | null;
  }): Promise<DataSchema> {
    const key = normalizeKey(input.key);
    const existing = await this.repository.getSchemaByKey(key);
    if (existing) {
      if (!existing.system || existing.kind !== "SYSTEM_EXTENSION") {
        throw conflict("SCHEMA_SYSTEM_KEY_CONFLICT", `Schema key ${key} is already used by a custom schema`);
      }
      return existing;
    }
    return this.repository.createSchema({
      key,
      displayName: input.displayName,
      pluralName: input.pluralName,
      ...(input.description === undefined ? {} : { description: input.description }),
      kind: "SYSTEM_EXTENSION",
      publicRead: false,
      system: true,
    });
  }

  async createSchema(input: DataSchemaCreateInput, audit: SchemaActionContext): Promise<DataSchema> {
    if (input.kind === "SYSTEM_EXTENSION") {
      throw new AppError({
        code: "SCHEMA_SYSTEM_KIND_RESERVED",
        message: "System extension schemas are reserved for platform modules",
        statusCode: 400,
      });
    }
    const normalized = {
      ...input,
      key: normalizeKey(input.key),
      publicRead: input.kind === "COMPONENT" ? false : input.publicRead,
      system: false,
    };
    const existing = await this.repository.getSchemaByKey(normalized.key);
    if (existing) throw conflict("SCHEMA_KEY_ALREADY_EXISTS", "Schema key is already in use");
    const created = await this.repository.createSchema(normalized);
    await this.repository.audit({
      ...audit,
      action: "schema.created",
      targetType: "DataSchema",
      targetId: created.id,
      metadata: { key: created.key, kind: created.kind },
    });
    return created;
  }

  async updateSchema(id: string, input: DataSchemaUpdateInput, audit: SchemaActionContext): Promise<DataSchema> {
    const current = await this.getSchema(id);
    const normalizedInput = current.kind === "COMPONENT" && input.publicRead === true
      ? { ...input, publicRead: false }
      : input;
    const updated = await this.repository.updateSchema(id, normalizedInput);
    await this.repository.audit({
      ...audit,
      action: "schema.updated",
      targetType: "DataSchema",
      targetId: id,
      metadata: { key: updated.key },
    });
    return updated;
  }

  async deleteSchema(id: string, audit: SchemaActionContext): Promise<void> {
    const schema = await this.getSchema(id);
    if (schema.system) throw conflict("SCHEMA_SYSTEM_IMMUTABLE", "System schemas cannot be deleted");

    const schemas = await this.repository.listSchemas();
    const usedBy = schemas.find((candidate) => candidate.fields.some((field) => {
      if (field.type === "RELATION" && field.relationTargetSchemaId === schema.id) return true;
      if (field.type === "COMPONENT") return componentSchemaId(field.settings) === schema.id;
      if (field.type === "DYNAMIC_ZONE") return dynamicZoneSchemaIds(field.settings).includes(schema.id);
      return false;
    }));
    if (usedBy) {
      throw conflict("SCHEMA_REFERENCED", `${schema.displayName} is referenced by ${usedBy.displayName}`);
    }

    const [recordCount, extensionCount] = await Promise.all([
      this.repository.countRecords(id),
      this.repository.countExtensions(id),
    ]);
    if (recordCount > 0 || extensionCount > 0) {
      throw conflict("SCHEMA_IN_USE", "Delete schema records before deleting the schema");
    }
    await this.repository.deleteSchema(id);
    await this.repository.audit({
      ...audit,
      action: "schema.deleted",
      targetType: "DataSchema",
      targetId: id,
      metadata: { key: schema.key },
    });
  }

  async createField(schemaId: string, input: DataFieldCreateInput, audit: SchemaActionContext): Promise<DataSchema> {
    const schema = await this.getSchema(schemaId);
    const normalizedInput: DataFieldCreateInput = { ...input, key: normalizeFieldKey(input.key) };
    await this.validateFieldDefinition(normalizedInput, schema);
    if (schema.fields.some((field) => field.key === normalizedInput.key)) {
      throw conflict("SCHEMA_FIELD_KEY_ALREADY_EXISTS", "Field key already exists on this schema");
    }
    const field = await this.repository.createField(schemaId, normalizedInput);
    await this.repository.audit({
      ...audit,
      action: "schema.field.created",
      targetType: "DataField",
      targetId: field.id,
      metadata: { schemaKey: schema.key, fieldKey: field.key, fieldType: field.type },
    });
    return this.getSchema(schemaId);
  }

  async updateField(fieldId: string, input: DataFieldUpdateInput, audit: SchemaActionContext): Promise<DataSchema> {
    const field = await this.repository.getField(fieldId);
    if (!field) throw notFound("SCHEMA_FIELD_NOT_FOUND", "Schema field was not found");
    const schema = await this.getSchema(field.schemaId);
    const definition: DataFieldCreateInput = {
      key: field.key,
      label: input.label ?? field.label,
      type: field.type,
      required: input.required ?? field.required,
      repeatable: input.repeatable ?? field.repeatable,
      position: input.position ?? field.position,
      validation: input.validation === undefined ? field.validation : input.validation,
      settings: input.settings === undefined ? field.settings : input.settings,
      relationTargetSchemaId: input.relationTargetSchemaId === undefined
        ? field.relationTargetSchemaId
        : input.relationTargetSchemaId,
    };
    await this.validateFieldDefinition(definition, schema);
    const updated = await this.repository.updateField(fieldId, input);
    await this.repository.audit({
      ...audit,
      action: "schema.field.updated",
      targetType: "DataField",
      targetId: fieldId,
      metadata: { schemaKey: schema.key, fieldKey: updated.key },
    });
    return this.getSchema(field.schemaId);
  }

  async deleteField(fieldId: string, audit: SchemaActionContext): Promise<DataSchema> {
    const field = await this.repository.getField(fieldId);
    if (!field) throw notFound("SCHEMA_FIELD_NOT_FOUND", "Schema field was not found");
    const schema = await this.getSchema(field.schemaId);
    if (schema.kind === "COMPONENT") {
      const schemas = await this.repository.listSchemas();
      const byId = new Map(schemas.map((item) => [item.id, item]));
      for (const candidate of schemas) {
        if (candidate.kind === "COMPONENT" || !schemaReferencesComponent(candidate, schema.id, byId)) continue;
        const used = candidate.kind === "SYSTEM_EXTENSION"
          ? await this.repository.countExtensions(candidate.id)
          : await this.repository.countRecords(candidate.id);
        if (used > 0) {
          throw conflict(
            "SCHEMA_COMPONENT_FIELD_IN_USE",
            `Cannot delete ${field.label} while ${schema.displayName} is used by stored ${candidate.displayName} data`,
          );
        }
      }
    }
    await this.repository.removeFieldValues(schema.id, field.key);
    await this.repository.deleteField(fieldId);
    await this.repository.audit({
      ...audit,
      action: "schema.field.deleted",
      targetType: "DataField",
      targetId: fieldId,
      metadata: { schemaKey: schema.key, fieldKey: field.key },
    });
    return this.getSchema(field.schemaId);
  }

  async listRecords(schemaKey: string, input: DataRecordListInput, publicOnly = false): Promise<Page<DataRecord>> {
    const schema = await this.getSchemaByKey(schemaKey);
    assertStandaloneRecordsSupported(schema);
    if (publicOnly && !schema.publicRead) throw notFound("SCHEMA_NOT_PUBLIC", "Schema is not publicly readable");
    return this.repository.listRecords(schema.id, input);
  }

  async getRecord(schemaKey: string, id: string, publicOnly = false): Promise<DataRecord> {
    const schema = await this.getSchemaByKey(schemaKey);
    assertStandaloneRecordsSupported(schema);
    if (publicOnly && !schema.publicRead) throw notFound("SCHEMA_NOT_PUBLIC", "Schema is not publicly readable");
    const record = await this.repository.getRecord(id);
    if (!record || record.schemaId !== schema.id || (publicOnly && record.status !== "ACTIVE")) {
      throw notFound("SCHEMA_RECORD_NOT_FOUND", "Record was not found");
    }
    return record;
  }

  async getRecordByStringValue(
    schemaKey: string,
    fieldKey: string,
    value: string,
    publicOnly = false,
  ): Promise<DataRecord> {
    const schema = await this.getSchemaByKey(schemaKey);
    assertStandaloneRecordsSupported(schema);
    if (publicOnly && !schema.publicRead) throw notFound("SCHEMA_NOT_PUBLIC", "Schema is not publicly readable");

    const field = schema.fields.find((candidate) => candidate.key === fieldKey);
    if (!field || !["TEXT", "LONG_TEXT", "RICH_TEXT", "UID", "ENUM"].includes(field.type)) {
      throw new AppError({
        code: "SCHEMA_LOOKUP_FIELD_INVALID",
        message: "Lookup field must be a string-compatible schema field",
        statusCode: 400,
        details: { schemaKey: schema.key, fieldKey },
      });
    }

    const record = await this.repository.findRecordByStringValue(
      schema.id,
      fieldKey,
      value,
      publicOnly ? "ACTIVE" : undefined,
    );
    if (!record || record.schemaId !== schema.id) {
      throw notFound("SCHEMA_RECORD_NOT_FOUND", "Record was not found");
    }
    return record;
  }

  async createRecord(
    schemaKey: string,
    input: DataRecordCreateInput,
    actorUserId: string | null,
    audit: SchemaActionContext,
  ): Promise<DataRecord> {
    const schema = await this.getSchemaByKey(schemaKey);
    assertStandaloneRecordsSupported(schema);
    if (schema.kind === "SINGLE" && (await this.repository.countRecords(schema.id)) > 0) {
      throw conflict("SCHEMA_SINGLE_ALREADY_EXISTS", "Single schema already has a record");
    }
    const values = await this.prepareRecordValues(schema, input.values);
    const created = await this.repository.createRecord(schema, { ...input, values }, actorUserId);
    await this.repository.audit({
      ...audit,
      action: "schema.record.created",
      targetType: "DataRecord",
      targetId: created.id,
      metadata: { schemaKey: schema.key },
    });
    return created;
  }

  async updateRecord(
    schemaKey: string,
    id: string,
    input: DataRecordUpdateInput,
    actorUserId: string | null,
    audit: SchemaActionContext,
  ): Promise<DataRecord> {
    const schema = await this.getSchemaByKey(schemaKey);
    const current = await this.getRecord(schemaKey, id);
    const values = input.values === undefined
      ? undefined
      : await this.prepareRecordValues(schema, { ...current.values, ...input.values }, id);
    const updated = await this.repository.updateRecord(id, {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(values === undefined ? {} : { values }),
    }, actorUserId);
    await this.repository.audit({
      ...audit,
      action: "schema.record.updated",
      targetType: "DataRecord",
      targetId: id,
      metadata: { schemaKey: schema.key },
    });
    return updated;
  }

  async deleteRecord(schemaKey: string, id: string, audit: SchemaActionContext): Promise<void> {
    await this.getRecord(schemaKey, id);
    await this.repository.deleteRecord(id);
    await this.repository.audit({
      ...audit,
      action: "schema.record.deleted",
      targetType: "DataRecord",
      targetId: id,
      metadata: { schemaKey: normalizeKey(schemaKey) },
    });
  }

  async getExtension(schemaKey: string, targetType: string, targetId: string): Promise<EntityExtension | null> {
    const schema = await this.getSchemaByKey(schemaKey);
    if (schema.kind !== "SYSTEM_EXTENSION") {
      throw new AppError({ code: "SCHEMA_EXTENSION_REQUIRED", message: "Schema is not a system extension", statusCode: 400 });
    }
    return this.repository.getExtension(schema.id, targetType, targetId);
  }

  async getExtensionValues(schemaKey: string, targetType: string, targetId: string): Promise<Record<string, unknown>> {
    return (await this.getExtension(schemaKey, targetType, targetId))?.values ?? {};
  }

  async listExtensionValues(
    schemaKey: string,
    targetType: string,
    targetIds: readonly string[],
  ): Promise<Map<string, Record<string, unknown>>> {
    const schema = await this.getSchemaByKey(schemaKey);
    if (schema.kind !== "SYSTEM_EXTENSION") {
      throw new AppError({ code: "SCHEMA_EXTENSION_REQUIRED", message: "Schema is not a system extension", statusCode: 400 });
    }
    const extensions = await this.repository.listExtensions(schema.id, targetType, targetIds);
    return new Map(extensions.map((extension) => [extension.targetId, extension.values]));
  }

  async deleteExtension(schemaKey: string, targetType: string, targetId: string): Promise<void> {
    const schema = await this.getSchemaByKey(schemaKey);
    if (schema.kind !== "SYSTEM_EXTENSION") return;
    await this.repository.deleteExtension(schema.id, targetType, targetId);
  }

  async validateExtensionValues(schemaKey: string, values: Record<string, unknown>): Promise<Record<string, unknown>> {
    const schema = await this.getSchemaByKey(schemaKey);
    if (schema.kind !== "SYSTEM_EXTENSION") {
      throw new AppError({ code: "SCHEMA_EXTENSION_REQUIRED", message: "Schema is not a system extension", statusCode: 400 });
    }
    return this.validateValues(schema, values, true);
  }

  async upsertExtension(
    schemaKey: string,
    targetType: string,
    targetId: string,
    values: Record<string, unknown>,
    audit: SchemaActionContext,
  ): Promise<EntityExtension> {
    const schema = await this.getSchemaByKey(schemaKey);
    if (schema.kind !== "SYSTEM_EXTENSION") {
      throw new AppError({ code: "SCHEMA_EXTENSION_REQUIRED", message: "Schema is not a system extension", statusCode: 400 });
    }
    const normalized = await this.validateValues(schema, values, true);
    const extension = await this.repository.upsertExtension(schema, targetType, targetId, normalized);
    await this.repository.audit({
      ...audit,
      action: "schema.extension.updated",
      targetType,
      targetId,
      metadata: { schemaKey: schema.key },
    });
    return extension;
  }

  private async validateFieldDefinition(input: DataFieldCreateInput, schema: DataSchema): Promise<void> {
    if (input.type === "RELATION") {
      if (!input.relationTargetSchemaId) {
        throw new AppError({ code: "SCHEMA_RELATION_TARGET_REQUIRED", message: "Relation fields require a target schema", statusCode: 400 });
      }
      const target = await this.getSchema(input.relationTargetSchemaId);
      if (target.kind === "COMPONENT" || target.kind === "SYSTEM_EXTENSION") {
        throw new AppError({
          code: "SCHEMA_RELATION_TARGET_INVALID",
          message: "Relations can target collection or single types only",
          statusCode: 400,
        });
      }
    } else if (input.relationTargetSchemaId) {
      throw new AppError({
        code: "SCHEMA_RELATION_TARGET_INVALID",
        message: "Only relation fields can define a relation target",
        statusCode: 400,
      });
    }

    if (input.type === "ENUM") {
      const options = enumOptions(input.settings?.options);
      if (!options || options.length === 0) {
        throw new AppError({ code: "SCHEMA_ENUM_OPTIONS_REQUIRED", message: "Enum fields require non-empty string options", statusCode: 400 });
      }
      if (new Set(options).size !== options.length) {
        throw new AppError({ code: "SCHEMA_ENUM_OPTIONS_DUPLICATE", message: "Enum options must be unique", statusCode: 400 });
      }
    }

    if (input.type === "UID") {
      if (input.repeatable) {
        throw new AppError({ code: "SCHEMA_UID_REPEATABLE_UNSUPPORTED", message: "UID fields cannot be repeatable", statusCode: 400 });
      }
      const targetField = uidTargetField(input.settings);
      if (targetField && targetField !== input.key) {
        const target = schema.fields.find((field) => field.key === targetField);
        if (!target || !["TEXT", "LONG_TEXT", "RICH_TEXT", "UID"].includes(target.type)) {
          throw new AppError({
            code: "SCHEMA_UID_TARGET_INVALID",
            message: "UID targetField must reference an existing text field",
            statusCode: 400,
          });
        }
      }
    }

    if (input.type === "COMPONENT") {
      const targetId = componentSchemaId(input.settings);
      if (!targetId) {
        throw new AppError({ code: "SCHEMA_COMPONENT_TARGET_REQUIRED", message: "Component fields require a component schema", statusCode: 400 });
      }
      const target = await this.getSchema(targetId);
      if (target.kind !== "COMPONENT") {
        throw new AppError({ code: "SCHEMA_COMPONENT_TARGET_INVALID", message: "Component field target must be a component schema", statusCode: 400 });
      }
      await this.assertNoComponentCycle(schema.id, [target.id]);
    }

    if (input.type === "DYNAMIC_ZONE") {
      const targetIds = dynamicZoneSchemaIds(input.settings);
      if (targetIds.length === 0) {
        throw new AppError({ code: "SCHEMA_DYNAMIC_ZONE_COMPONENTS_REQUIRED", message: "Dynamic zones require at least one component", statusCode: 400 });
      }
      for (const targetId of targetIds) {
        const target = await this.getSchema(targetId);
        if (target.kind !== "COMPONENT") {
          throw new AppError({ code: "SCHEMA_DYNAMIC_ZONE_TARGET_INVALID", message: "Dynamic zones can contain component schemas only", statusCode: 400 });
        }
      }
      await this.assertNoComponentCycle(schema.id, targetIds);
    }

    validateRuleShape(input);
  }

  private async assertNoComponentCycle(schemaId: string, targetIds: readonly string[]): Promise<void> {
    const schemas = await this.repository.listSchemas();
    const byId = new Map(schemas.map((item) => [item.id, item]));
    const reaches = (startId: string, wantedId: string, visited = new Set<string>()): boolean => {
      if (startId === wantedId) return true;
      if (visited.has(startId)) return false;
      visited.add(startId);
      const current = byId.get(startId);
      if (!current) return false;
      const next = current.fields.flatMap((field) => {
        if (field.type === "COMPONENT") {
          const target = componentSchemaId(field.settings);
          return target ? [target] : [];
        }
        if (field.type === "DYNAMIC_ZONE") return dynamicZoneSchemaIds(field.settings);
        return [];
      });
      return next.some((nextId) => reaches(nextId, wantedId, visited));
    };

    if (targetIds.some((targetId) => reaches(targetId, schemaId))) {
      throw conflict("SCHEMA_COMPONENT_CYCLE", "Component nesting cannot create a circular dependency");
    }
  }

  private async prepareRecordValues(
    schema: DataSchema,
    input: Record<string, unknown>,
    excludeRecordId?: string,
  ): Promise<Record<string, unknown>> {
    const values = { ...input };
    for (const field of schema.fields) {
      if (field.type !== "UID") continue;
      const current = values[field.key];
      const targetField = uidTargetField(field.settings);
      if (isEmpty(current) && targetField) {
        const source = values[targetField];
        if (typeof source === "string" && source.trim()) values[field.key] = slugify(source);
      } else if (typeof current === "string") {
        values[field.key] = slugify(current);
      }
    }

    const validated = await this.validateValues(schema, values, true);
    for (const field of schema.fields) {
      if (field.type !== "UID") continue;
      const value = validated[field.key];
      if (typeof value !== "string" || !value) continue;
      const exists = await this.repository.recordValueExists(schema.id, field.key, value, excludeRecordId);
      if (exists) {
        throw conflict("SCHEMA_UID_NOT_UNIQUE", `${field.label} must be unique`);
      }
    }
    return validated;
  }

  private async validateValues(
    schema: DataSchema,
    values: Record<string, unknown>,
    requireRequired: boolean,
  ): Promise<Record<string, unknown>> {
    const fieldMap = new Map(schema.fields.map((field) => [field.key, field]));
    for (const key of Object.keys(values)) {
      if (!fieldMap.has(key)) {
        throw new AppError({ code: "SCHEMA_UNKNOWN_FIELD", message: `Unknown field: ${key}`, statusCode: 400 });
      }
    }
    for (const field of schema.fields) {
      const value = values[field.key];
      if (requireRequired && field.required && isEmpty(value)) {
        throw new AppError({
          code: "SCHEMA_REQUIRED_FIELD",
          message: `${field.label} is required`,
          statusCode: 400,
          details: { field: field.key },
        });
      }
      if (value === undefined || value === null || value === "") continue;
      await this.validateFieldValue(field, value);
    }
    return values;
  }

  private async validateFieldValue(field: DataField, value: unknown): Promise<void> {
    if (field.type === "DYNAMIC_ZONE") {
      if (!Array.isArray(value)) throw invalidType(field, "dynamic zone array");
      validateArrayRules(field, value);
      const allowedIds = dynamicZoneSchemaIds(field.settings);
      for (const raw of value) {
        const item = asDynamicZoneItem(raw, field);
        const component = await this.getSchemaByKey(item.component);
        if (component.kind !== "COMPONENT" || !allowedIds.includes(component.id)) {
          throw new AppError({
            code: "SCHEMA_DYNAMIC_ZONE_COMPONENT_INVALID",
            message: `${component.displayName} is not allowed in ${field.label}`,
            statusCode: 400,
          });
        }
        await this.validateValues(component, item.data, true);
      }
      return;
    }

    const values = field.repeatable ? value : [value];
    if (field.repeatable && !Array.isArray(value)) throw invalidType(field, "array");
    const list = Array.isArray(values) ? values : [values];
    if (field.repeatable) validateArrayRules(field, list);

    for (const item of list) {
      switch (field.type) {
        case "TEXT":
        case "LONG_TEXT":
        case "RICH_TEXT":
          if (typeof item !== "string") throw invalidType(field, "string");
          validateStringRules(field, item);
          break;
        case "UID":
          if (typeof item !== "string" || !/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u.test(item)) {
            throw invalidType(field, "URL-safe UID");
          }
          validateStringRules(field, item);
          break;
        case "NUMBER":
          if (typeof item !== "number" || !Number.isFinite(item)) throw invalidType(field, "number");
          validateNumberRules(field, item);
          break;
        case "BOOLEAN":
          if (typeof item !== "boolean") throw invalidType(field, "boolean");
          break;
        case "DATE":
          if (typeof item !== "string" || Number.isNaN(Date.parse(item))) throw invalidType(field, "ISO date string");
          break;
        case "ENUM": {
          if (typeof item !== "string") throw invalidType(field, "enum string");
          const options = enumOptions(field.settings?.options);
          if (!options?.includes(item)) {
            throw new AppError({ code: "SCHEMA_ENUM_VALUE_INVALID", message: `${field.label} contains an invalid option`, statusCode: 400 });
          }
          break;
        }
        case "MEDIA":
          if (typeof item !== "string") throw invalidType(field, "media asset id");
          if (!(await this.repository.mediaExist([item]))) {
            throw notFound("SCHEMA_MEDIA_NOT_FOUND", `Media asset for ${field.label} was not found`);
          }
          break;
        case "RELATION":
          if (typeof item !== "string") throw invalidType(field, "record id");
          if (!field.relationTargetSchemaId || !(await this.repository.recordsExist(field.relationTargetSchemaId, [item]))) {
            throw notFound("SCHEMA_RELATION_NOT_FOUND", `Related record for ${field.label} was not found`);
          }
          break;
        case "COMPONENT": {
          const targetId = componentSchemaId(field.settings);
          if (!targetId) throw invalidType(field, "configured component");
          const component = await this.getSchema(targetId);
          if (component.kind !== "COMPONENT") throw invalidType(field, "component object");
          const data = asRecord(item);
          if (!data) throw invalidType(field, "component object");
          await this.validateValues(component, data, true);
          break;
        }
        case "JSON":
          break;
      }
    }
  }
}

function schemaReferencesComponent(
  schema: DataSchema,
  targetComponentId: string,
  byId: Map<string, DataSchema>,
  visited = new Set<string>(),
): boolean {
  if (visited.has(schema.id)) return false;
  visited.add(schema.id);
  for (const field of schema.fields) {
    const targetIds = field.type === "COMPONENT"
      ? (componentSchemaId(field.settings) ? [componentSchemaId(field.settings) as string] : [])
      : field.type === "DYNAMIC_ZONE"
        ? dynamicZoneSchemaIds(field.settings)
        : [];
    for (const targetId of targetIds) {
      if (targetId === targetComponentId) return true;
      const nested = byId.get(targetId);
      if (nested && schemaReferencesComponent(nested, targetComponentId, byId, visited)) return true;
    }
  }
  return false;
}

function assertStandaloneRecordsSupported(schema: DataSchema): void {
  if (schema.kind === "SYSTEM_EXTENSION" || schema.kind === "COMPONENT") {
    throw new AppError({
      code: "SCHEMA_RECORDS_NOT_SUPPORTED",
      message: `${schema.kind === "COMPONENT" ? "Component" : "System extension"} schemas do not expose standalone records`,
      statusCode: 400,
    });
  }
}

function enumOptions(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string" && item.trim() !== "")) return null;
  return value.map((item) => item.trim());
}

function componentSchemaId(settings: Record<string, unknown> | null | undefined): string | null {
  const value = settings?.componentSchemaId;
  return typeof value === "string" && value.trim() ? value : null;
}

function dynamicZoneSchemaIds(settings: Record<string, unknown> | null | undefined): string[] {
  const value = settings?.componentSchemaIds;
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim() !== ""))];
}

function uidTargetField(settings: Record<string, unknown> | null | undefined): string | null {
  const value = settings?.targetField;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validateRuleShape(input: DataFieldCreateInput): void {
  const validation = input.validation;
  if (!validation) return;
  const numericKeys = ["min", "max", "minLength", "maxLength", "minItems", "maxItems"] as const;
  for (const key of numericKeys) {
    const value = validation[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new AppError({ code: "SCHEMA_VALIDATION_RULE_INVALID", message: `${key} must be a finite number`, statusCode: 400 });
    }
  }
  if (validation.pattern !== undefined && typeof validation.pattern !== "string") {
    throw new AppError({ code: "SCHEMA_VALIDATION_RULE_INVALID", message: "pattern must be a string", statusCode: 400 });
  }
}

function validateStringRules(field: DataField, value: string): void {
  const minLength = numericRule(field, "minLength");
  const maxLength = numericRule(field, "maxLength");
  if (minLength !== null && value.length < minLength) throw validationError(field, `must contain at least ${minLength} characters`);
  if (maxLength !== null && value.length > maxLength) throw validationError(field, `must contain at most ${maxLength} characters`);
  const pattern = field.validation?.pattern;
  if (typeof pattern === "string" && pattern) {
    let expression: RegExp;
    try {
      expression = new RegExp(pattern);
    } catch {
      throw new AppError({ code: "SCHEMA_VALIDATION_RULE_INVALID", message: `Invalid regex configured for ${field.label}`, statusCode: 500 });
    }
    if (!expression.test(value)) throw validationError(field, "does not match the configured pattern");
  }
}

function validateNumberRules(field: DataField, value: number): void {
  const min = numericRule(field, "min");
  const max = numericRule(field, "max");
  if (min !== null && value < min) throw validationError(field, `must be at least ${min}`);
  if (max !== null && value > max) throw validationError(field, `must be at most ${max}`);
}

function validateArrayRules(field: DataField, value: readonly unknown[]): void {
  const minItems = numericRule(field, "minItems");
  const maxItems = numericRule(field, "maxItems");
  if (minItems !== null && value.length < minItems) throw validationError(field, `must contain at least ${minItems} items`);
  if (maxItems !== null && value.length > maxItems) throw validationError(field, `must contain at most ${maxItems} items`);
}

function numericRule(field: DataField, key: string): number | null {
  const value = field.validation?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asDynamicZoneItem(value: unknown, field: DataField): DynamicZoneItem {
  const item = asRecord(value);
  if (!item || typeof item.component !== "string") throw invalidType(field, "dynamic zone items with component and data");
  const data = asRecord(item.data);
  if (!data) throw invalidType(field, "dynamic zone items with component and data");
  return { component: item.component, data };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9.-]{1,79}$/.test(normalized)) {
    throw new AppError({
      code: "SCHEMA_KEY_INVALID",
      message: "Schema key must start with a letter and contain only lowercase letters, numbers, dots or hyphens",
      statusCode: 400,
    });
  }
  return normalized;
}

function normalizeFieldKey(value: string): string {
  const normalized = value.trim();
  if (!/^[a-z][A-Za-z0-9_]{0,63}$/.test(normalized)) {
    throw new AppError({
      code: "SCHEMA_FIELD_KEY_INVALID",
      message: "Field key must be camelCase-compatible and start with a lowercase letter",
      statusCode: 400,
    });
  }
  return normalized;
}

function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    throw new AppError({ code: "SCHEMA_UID_INVALID", message: "Unable to generate a UID from the configured source field", statusCode: 400 });
  }
  return normalized;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function invalidType(field: DataField, expected: string): AppError {
  return new AppError({
    code: "SCHEMA_FIELD_TYPE_INVALID",
    message: `${field.label} must be ${expected}`,
    statusCode: 400,
    details: { field: field.key, expected },
  });
}

function validationError(field: DataField, message: string): AppError {
  return new AppError({
    code: "SCHEMA_FIELD_VALIDATION_FAILED",
    message: `${field.label} ${message}`,
    statusCode: 400,
    details: { field: field.key },
  });
}

function notFound(code: string, message: string): AppError {
  return new AppError({ code, message, statusCode: 404 });
}

function conflict(code: string, message: string): AppError {
  return new AppError({ code, message, statusCode: 409 });
}
