import { AppError } from "./errors.js";

export interface ExtensionContribution<TValue = unknown> {
  point: string;
  owner: string;
  value: TValue;
}

export class ExtensionRegistry {
  readonly #contributions = new Map<string, ExtensionContribution[]>();

  register<TValue>(point: string, owner: string, value: TValue): void {
    if (!point.trim()) {
      throw new AppError({ code: "CORE_INVALID_EXTENSION_POINT", message: "Extension point is required" });
    }
    const contributions = this.#contributions.get(point) ?? [];
    contributions.push({ point, owner, value });
    this.#contributions.set(point, contributions);
  }

  list<TValue>(point: string): Array<ExtensionContribution<TValue>> {
    return [...(this.#contributions.get(point) ?? [])] as Array<ExtensionContribution<TValue>>;
  }
}

export const PLATFORM_EXTENSION_POINTS = Object.freeze({
  moduleConfiguration: "platform.module-configuration",
  databaseModels: "platform.database-models",
  repositories: "platform.repositories",
});
