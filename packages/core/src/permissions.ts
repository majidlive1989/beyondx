import { AppError } from "./errors.js";

export interface PermissionDefinition {
  id: string;
  description: string;
  module: string;
}

export class PermissionRegistry {
  readonly #permissions = new Map<string, PermissionDefinition>();

  register(definition: PermissionDefinition): void {
    if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(definition.id)) {
      throw new AppError({
        code: "CORE_INVALID_PERMISSION",
        message: `Invalid permission identifier: ${definition.id}`,
      });
    }
    if (this.#permissions.has(definition.id)) {
      throw new AppError({
        code: "CORE_DUPLICATE_PERMISSION",
        message: `Permission is already registered: ${definition.id}`,
      });
    }
    this.#permissions.set(definition.id, Object.freeze({ ...definition }));
  }

  has(permission: string): boolean {
    return this.#permissions.has(permission);
  }

  list(): PermissionDefinition[] {
    return [...this.#permissions.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}
