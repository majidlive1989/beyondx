import { AppError } from "./errors.js";

export type ServiceToken<T> = string | symbol | { readonly __type?: T; readonly key: string };
type Factory<T> = (container: ServiceContainer) => T;

interface Registration<T> {
  singleton: boolean;
  factory: Factory<T>;
  instance: T | undefined;
  initialized: boolean;
  resolving: boolean;
}

export class ServiceContainer {
  readonly #registrations = new Map<ServiceToken<unknown>, Registration<unknown>>();

  registerValue<T>(token: ServiceToken<T>, value: T): void {
    this.assertNotRegistered(token);
    this.#registrations.set(token, {
      singleton: true,
      factory: () => value,
      instance: value,
      initialized: true,
      resolving: false,
    });
  }

  registerFactory<T>(
    token: ServiceToken<T>,
    factory: Factory<T>,
    options: { singleton?: boolean } = {},
  ): void {
    this.assertNotRegistered(token);
    this.#registrations.set(token, {
      singleton: options.singleton ?? true,
      factory,
      instance: undefined,
      initialized: false,
      resolving: false,
    });
  }

  has<T>(token: ServiceToken<T>): boolean {
    return this.#registrations.has(token);
  }

  resolve<T>(token: ServiceToken<T>): T {
    const registration = this.#registrations.get(token) as Registration<T> | undefined;
    if (!registration) {
      throw new AppError({
        code: "CORE_SERVICE_NOT_FOUND",
        message: `Service is not registered: ${formatServiceToken(token)}`,
      });
    }
    if (registration.initialized) return registration.instance as T;
    if (registration.resolving) {
      throw new AppError({
        code: "CORE_CIRCULAR_SERVICE_DEPENDENCY",
        message: `Circular service dependency: ${formatServiceToken(token)}`,
      });
    }

    registration.resolving = true;
    try {
      const instance = registration.factory(this);
      if (registration.singleton) {
        registration.instance = instance;
        registration.initialized = true;
      }
      return instance;
    } finally {
      registration.resolving = false;
    }
  }

  private assertNotRegistered<T>(token: ServiceToken<T>): void {
    if (this.#registrations.has(token)) {
      throw new AppError({
        code: "CORE_DUPLICATE_SERVICE",
        message: `Service is already registered: ${formatServiceToken(token)}`,
      });
    }
  }
}

function formatServiceToken<T>(token: ServiceToken<T>): string {
  if (typeof token === "string") return token;
  if (typeof token === "symbol") return token.description ?? token.toString();
  return token.key;
}
