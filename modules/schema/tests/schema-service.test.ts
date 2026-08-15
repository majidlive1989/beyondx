import { describe, expect, it, vi } from "vitest";
import type { SchemaRepository } from "../src/application/contracts.js";
import { SchemaService } from "../src/application/schema-service.js";
import type { DataSchema } from "../src/domain/models.js";

const now = new Date("2026-08-07T00:00:00.000Z");

function schema(overrides: Partial<DataSchema> = {}): DataSchema {
  return {
    id: "schema-1",
    key: "catalog.product",
    displayName: "Product custom fields",
    pluralName: "Product custom fields",
    description: null,
    kind: "SYSTEM_EXTENSION",
    publicRead: false,
    system: true,
    fields: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(stubs: Partial<SchemaRepository>): SchemaRepository {
  return stubs as unknown as SchemaRepository;
}

describe("SchemaService", () => {
  it("creates custom collection schemas but reserves system extensions", async () => {
    const createSchema = vi.fn().mockResolvedValue(schema({ id: "faq", key: "faq", displayName: "FAQ", pluralName: "FAQs", kind: "COLLECTION", system: false }));
    const service = new SchemaService(repository({ getSchemaByKey: () => Promise.resolve(null), createSchema, audit: () => Promise.resolve() }));

    const created = await service.createSchema({ key: "FAQ", displayName: "FAQ", pluralName: "FAQs", kind: "COLLECTION", publicRead: true }, { actorUserId: "admin" });
    expect(created.key).toBe("faq");
    expect(createSchema).toHaveBeenCalledTimes(1);

    await expect(service.createSchema({ key: "system.test", displayName: "System", pluralName: "Systems", kind: "SYSTEM_EXTENSION", publicRead: false }, { actorUserId: "admin" })).rejects.toMatchObject({ code: "SCHEMA_SYSTEM_KIND_RESERVED" });
  });

  it("validates required system-extension fields before saving", async () => {
    const productSchema = schema({ fields: [{
      id: "field-1",
      schemaId: "schema-1",
      key: "batteryCapacity",
      label: "Battery capacity",
      type: "NUMBER",
      required: true,
      repeatable: false,
      position: 0,
      validation: null,
      settings: null,
      relationTargetSchemaId: null,
      createdAt: now,
      updatedAt: now,
    }] });
    const service = new SchemaService(repository({ getSchemaByKey: () => Promise.resolve(productSchema) }));

    await expect(service.upsertExtension("catalog.product", "Product", "product-1", {}, { actorUserId: "admin" })).rejects.toMatchObject({ code: "SCHEMA_REQUIRED_FIELD" });
  });
  it("reads an active public record by a string field", async () => {
    const pageSchema = schema({
      id: "site-page-schema",
      key: "site-page",
      displayName: "Page",
      pluralName: "Pages",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
      fields: [{
        id: "slug-field",
        schemaId: "site-page-schema",
        key: "slug",
        label: "Slug",
        type: "UID",
        required: true,
        repeatable: false,
        position: 10,
        validation: null,
        settings: { targetField: "title" },
        relationTargetSchemaId: null,
        createdAt: now,
        updatedAt: now,
      }],
    });
    const record = {
      id: "page-1",
      schemaId: pageSchema.id,
      schemaKey: pageSchema.key,
      status: "ACTIVE" as const,
      values: { slug: "about", title: "About" },
      createdById: null,
      updatedById: null,
      createdAt: now,
      updatedAt: now,
    };
    const findRecordByStringValue = vi.fn().mockResolvedValue(record);
    const service = new SchemaService(repository({
      getSchemaByKey: () => Promise.resolve(pageSchema),
      findRecordByStringValue,
    }));

    await expect(service.getRecordByStringValue("site-page", "slug", "about", true)).resolves.toEqual(record);
    expect(findRecordByStringValue).toHaveBeenCalledWith(pageSchema.id, "slug", "about", "ACTIVE");
  });

});

describe("SchemaService platform-builder fields", () => {
  it("generates a unique UID from a configured text field", async () => {
    const collection = schema({
      id: "article-schema",
      key: "article",
      displayName: "Article",
      pluralName: "Articles",
      kind: "COLLECTION",
      system: false,
      fields: [
        {
          id: "title-field",
          schemaId: "article-schema",
          key: "title",
          label: "Title",
          type: "TEXT",
          required: true,
          repeatable: false,
          position: 0,
          validation: null,
          settings: null,
          relationTargetSchemaId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "slug-field",
          schemaId: "article-schema",
          key: "slug",
          label: "Slug",
          type: "UID",
          required: true,
          repeatable: false,
          position: 1,
          validation: null,
          settings: { targetField: "title" },
          relationTargetSchemaId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    const createRecord = vi.fn().mockResolvedValue({
      id: "record-1",
      schemaId: collection.id,
      schemaKey: collection.key,
      status: "DRAFT",
      values: { title: "Hello BeyondX Platform", slug: "hello-beyondx-platform" },
      createdById: "admin",
      updatedById: "admin",
      createdAt: now,
      updatedAt: now,
    });
    const service = new SchemaService(repository({
      getSchemaByKey: () => Promise.resolve(collection),
      countRecords: () => Promise.resolve(0),
      recordValueExists: () => Promise.resolve(false),
      createRecord,
      audit: () => Promise.resolve(),
    }));

    const created = await service.createRecord(
      "article",
      { status: "DRAFT", values: { title: "Hello BeyondX Platform" } },
      "admin",
      { actorUserId: "admin" },
    );

    expect(created.values.slug).toBe("hello-beyondx-platform");
    expect(createRecord).toHaveBeenCalledWith(
      collection,
      expect.objectContaining({ values: { title: "Hello BeyondX Platform", slug: "hello-beyondx-platform" } }),
      "admin",
    );
  });

  it("validates nested reusable component values", async () => {
    const component = schema({
      id: "seo-component",
      key: "component.seo",
      displayName: "SEO",
      pluralName: "SEO",
      kind: "COMPONENT",
      system: false,
      fields: [{
        id: "meta-title",
        schemaId: "seo-component",
        key: "metaTitle",
        label: "Meta title",
        type: "TEXT",
        required: true,
        repeatable: false,
        position: 0,
        validation: null,
        settings: null,
        relationTargetSchemaId: null,
        createdAt: now,
        updatedAt: now,
      }],
    });
    const page = schema({
      id: "page-schema",
      key: "page",
      displayName: "Page",
      pluralName: "Pages",
      kind: "COLLECTION",
      system: false,
      fields: [{
        id: "seo-field",
        schemaId: "page-schema",
        key: "seo",
        label: "SEO",
        type: "COMPONENT",
        required: true,
        repeatable: false,
        position: 0,
        validation: null,
        settings: { componentSchemaId: component.id },
        relationTargetSchemaId: null,
        createdAt: now,
        updatedAt: now,
      }],
    });
    const service = new SchemaService(repository({
      getSchemaByKey: (key) => Promise.resolve(key === page.key ? page : component),
      getSchema: (id) => Promise.resolve(id === component.id ? component : page),
      countRecords: () => Promise.resolve(0),
    }));

    await expect(service.createRecord(
      "page",
      { status: "DRAFT", values: { seo: {} } },
      "admin",
      { actorUserId: "admin" },
    )).rejects.toMatchObject({ code: "SCHEMA_REQUIRED_FIELD" });
  });
});
