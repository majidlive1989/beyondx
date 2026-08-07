import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@beyondx/core";
import type { StorageAdapter, StorageWriteInput } from "../application/contracts.js";

export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = "local";
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async write(input: StorageWriteInput): Promise<void> {
    const target = this.resolveKey(input.key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.data, { flag: "wx" }).catch((error: unknown) => {
      throw new AppError({
        code: "MEDIA_STORAGE_WRITE_FAILED",
        message: "Unable to persist uploaded media",
        statusCode: 500,
        cause: error,
      });
    });
  }

  async read(key: string): Promise<Uint8Array> {
    const target = this.resolveKey(key);
    try {
      return await readFile(target);
    } catch (error) {
      throw new AppError({
        code: "MEDIA_STORAGE_READ_FAILED",
        message: "Media file could not be read from storage",
        statusCode: 500,
        cause: error,
      });
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    await rm(target, { force: true }).catch((error: unknown) => {
      throw new AppError({
        code: "MEDIA_STORAGE_DELETE_FAILED",
        message: "Media file could not be deleted from storage",
        statusCode: 500,
        cause: error,
      });
    });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root);
  }

  private resolveKey(key: string): string {
    if (!/^[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/.test(key)) {
      throw new AppError({
        code: "MEDIA_STORAGE_KEY_INVALID",
        message: "Storage key is invalid",
        statusCode: 500,
      });
    }
    const target = path.resolve(this.root, key);
    const relative = path.relative(this.root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError({
        code: "MEDIA_STORAGE_KEY_INVALID",
        message: "Storage key escapes the configured media root",
        statusCode: 500,
      });
    }
    return target;
  }
}
