import { describe, expect, it } from "vitest";
import type {
  MediaCreateRecordInput,
  MediaRepository,
  StorageAdapter,
} from "../src/application/contracts.js";
import { MediaService } from "../src/application/media-service.js";
import type {
  MediaAsset,
  MediaListInput,
  MediaPage,
  MediaUpdateInput,
} from "../src/domain/models.js";

class MemoryStorage implements StorageAdapter {
  readonly provider = "memory";
  readonly files = new Map<string, Uint8Array>();
  write(input: { key: string; data: Uint8Array }): Promise<void> {
    this.files.set(input.key, input.data);
    return Promise.resolve();
  }
  read(key: string): Promise<Uint8Array> {
    const value = this.files.get(key);
    if (!value) return Promise.reject(new Error("missing"));
    return Promise.resolve(value);
  }
  delete(key: string): Promise<void> {
    this.files.delete(key);
    return Promise.resolve();
  }
  exists(key: string): Promise<boolean> {
    return Promise.resolve(this.files.has(key));
  }
  health(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryRepository implements MediaRepository {
  readonly items = new Map<string, MediaAsset>();
  readonly audits: string[] = [];

  create(input: MediaCreateRecordInput): Promise<MediaAsset> {
    const now = new Date();
    const asset: MediaAsset = {
      id: `asset-${this.items.size + 1}`,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(asset.id, asset);
    return Promise.resolve(asset);
  }
  findById(id: string): Promise<MediaAsset | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }
  list(input: MediaListInput): Promise<MediaPage> {
    const items = [...this.items.values()];
    return Promise.resolve({
      items,
      page: input.page,
      pageSize: input.pageSize,
      total: items.length,
      pageCount: 1,
    });
  }
  update(id: string, input: MediaUpdateInput): Promise<MediaAsset> {
    const current = this.items.get(id);
    if (!current) return Promise.reject(new Error("missing"));
    const updated = { ...current, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(updated);
  }
  delete(id: string): Promise<void> {
    this.items.delete(id);
    return Promise.resolve();
  }
  audit(input: { action: string }): Promise<void> {
    this.audits.push(input.action);
    return Promise.resolve();
  }
}

function png(width = 320, height = 180): Buffer {
  const data = Buffer.alloc(24);
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(data, 0);
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}

describe("MediaService", () => {
  it("uploads, persists and reads an image", async () => {
    const repository = new MemoryRepository();
    const storage = new MemoryStorage();
    const service = new MediaService(repository, storage, {
      maxFileSizeBytes: 1024 * 1024,
      allowedMimeTypes: new Set(["image/png"]),
    });

    const asset = await service.upload(
      {
        originalName: "hero.png",
        declaredMimeType: "image/png",
        data: png(800, 600),
        altText: "Homepage hero",
      },
      { actorUserId: "admin-1", requestId: "req-1" },
    );

    expect(asset).toMatchObject({
      originalName: "hero.png",
      mimeType: "image/png",
      kind: "IMAGE",
      width: 800,
      height: 600,
      altText: "Homepage hero",
      uploadedByUserId: "admin-1",
    });
    expect(storage.files.size).toBe(1);
    expect((await service.content(asset.id)).data.byteLength).toBe(24);
    expect(repository.audits).toContain("media.asset.upload");
  });

  it("rejects MIME spoofing", async () => {
    const service = new MediaService(new MemoryRepository(), new MemoryStorage(), {
      maxFileSizeBytes: 1024 * 1024,
      allowedMimeTypes: new Set(["image/png"]),
    });

    await expect(
      service.upload(
        {
          originalName: "fake.jpg",
          declaredMimeType: "image/jpeg",
          data: png(),
        },
        { actorUserId: "admin-1" },
      ),
    ).rejects.toMatchObject({ code: "MEDIA_MIME_MISMATCH", statusCode: 415 });
  });

  it("rejects alt text on non-image assets", async () => {
    const service = new MediaService(new MemoryRepository(), new MemoryStorage(), {
      maxFileSizeBytes: 1024 * 1024,
      allowedMimeTypes: new Set(["application/pdf"]),
    });

    await expect(
      service.upload(
        {
          originalName: "document.pdf",
          declaredMimeType: "application/pdf",
          data: Buffer.from("%PDF-1.7\n"),
          altText: "not valid",
        },
        { actorUserId: "admin-1" },
      ),
    ).rejects.toMatchObject({ code: "MEDIA_ALT_TEXT_IMAGE_ONLY" });
  });
});
