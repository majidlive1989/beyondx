import { describe, expect, it } from "vitest";
import { ContentService } from "../src/application/content-service.js";
import type { ContentRepository } from "../src/application/contracts.js";
import type { ContentTypeModel } from "../src/domain/models.js";

const contentType: ContentTypeModel = {
  id: "type-1",
  name: "Article",
  apiId: "articles",
  description: null,
  fields: [
    {
      id: "field-1",
      key: "title",
      label: "Title",
      type: "TEXT",
      required: true,
      localized: true,
      position: 0,
      validation: null,
      settings: null,
    },
    {
      id: "field-2",
      key: "related",
      label: "Related",
      type: "RELATION",
      required: false,
      localized: false,
      position: 1,
      validation: null,
      settings: null,
    },
  ],
  createdAt: new Date("2026-08-07T00:00:00.000Z"),
  updatedAt: new Date("2026-08-07T00:00:00.000Z"),
};

function repositoryMock(): ContentRepository {
  return {
    listContentTypes: () => Promise.resolve([contentType]),
    getContentType: () => Promise.resolve(contentType),
    getContentTypeByApiId: () => Promise.resolve(null),
    createContentType: () => Promise.resolve(contentType),
    updateContentType: () => Promise.resolve(contentType),
    deleteContentType: () => Promise.resolve(),
    countEntriesForType: () => Promise.resolve(0),
    entriesExist: () => Promise.resolve(true),
    listEntries: () => Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, pageCount: 0 }),
    getEntry: () => Promise.resolve(null),
    getPublishedEntry: () => Promise.resolve(null),
    listPublishedEntries: () => Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, pageCount: 0 }),
    createEntry: () => Promise.reject(new Error("Not expected in validation test")),
    updateEntry: () => Promise.reject(new Error("Not expected in validation test")),
    setEntryStatus: () => Promise.reject(new Error("Not expected in validation test")),
    deleteEntry: () => Promise.resolve(),
    listRevisions: () => Promise.resolve([]),
    listDueScheduled: () => Promise.resolve([]),
    writeAudit: () => Promise.resolve(),
  };
}

const metadata = { actorId: "user-1", requestId: "req-1" } as const;

describe("ContentService", () => {
  it("rejects duplicate field keys", async () => {
    const service = new ContentService(repositoryMock());
    await expect(service.createContentType({
      name: "Article",
      apiId: "articles",
      fields: [
        { key: "title", label: "Title", type: "TEXT", required: true, localized: false, position: 0, validation: null, settings: null },
        { key: "title", label: "Second title", type: "TEXT", required: false, localized: false, position: 1, validation: null, settings: null },
      ],
    }, metadata)).rejects.toMatchObject({ code: "CONTENT_DUPLICATE_FIELD" });
  });

  it("validates required entry data before persistence", async () => {
    const repository = repositoryMock();
    const service = new ContentService(repository);
    await expect(service.createEntry({
      contentTypeId: contentType.id,
      slug: "hello-world",
      locale: "en",
      data: {},
    }, metadata)).rejects.toMatchObject({ code: "CONTENT_REQUIRED_FIELD" });
  });

  it("rejects relations that do not use relation fields", async () => {
    const service = new ContentService(repositoryMock());
    await expect(service.createEntry({
      contentTypeId: contentType.id,
      slug: "hello-world",
      locale: "en",
      data: { title: "Hello" },
      relations: [{ fieldKey: "title", targetEntryId: "entry-2" }],
    }, metadata)).rejects.toMatchObject({ code: "CONTENT_INVALID_RELATION_FIELD" });
  });

  it("rejects publication schedules in the past", async () => {
    const repository = repositoryMock();
    repository.getEntry = () => Promise.resolve({
      id: "entry-1",
      contentTypeId: contentType.id,
      contentTypeApiId: contentType.apiId,
      slug: "hello-world",
      locale: "en",
      status: "DRAFT",
      data: { title: "Hello" },
      seoTitle: null,
      seoDescription: null,
      seoMetadata: null,
      scheduledPublishAt: null,
      publishedAt: null,
      archivedAt: null,
      currentRevision: 1,
      relations: [],
      createdById: "user-1",
      updatedById: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new ContentService(repository);
    await expect(service.scheduleEntry("entry-1", new Date("2000-01-01T00:00:00.000Z"), metadata))
      .rejects.toMatchObject({ code: "CONTENT_SCHEDULE_IN_PAST" });
  });
});
