import { AppError } from "./errors.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpPrincipal {
  subject: string;
  permissions: ReadonlySet<string>;
}

export interface HttpRequestContext {
  requestId: string;
  ip: string;
  params: unknown;
  query: unknown;
  body: unknown;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  principal?: HttpPrincipal;
}

export interface HttpRouteResponse {
  statusCode?: number;
  headers?: Record<string, string>;
  body: unknown;
}

export interface HttpRouteDefinition {
  method: HttpMethod;
  path: string;
  summary: string;
  tags: string[];
  public: boolean;
  permission?: string;
  schema?: Record<string, unknown>;
  handler(context: HttpRequestContext): Promise<HttpRouteResponse>;
}

export interface RegisteredHttpRoute extends HttpRouteDefinition {
  owner: string;
}

export class HttpRouteRegistry {
  readonly #routes = new Map<string, RegisteredHttpRoute>();

  register(owner: string, definition: HttpRouteDefinition): void {
    const key = `${definition.method} ${definition.path}`;
    if (!definition.path.startsWith("/")) {
      throw new AppError({
        code: "CORE_INVALID_ROUTE",
        message: `Route path must start with '/': ${definition.path}`,
      });
    }
    if (!definition.public && !definition.permission) {
      throw new AppError({
        code: "CORE_ROUTE_PERMISSION_REQUIRED",
        message: `Protected route requires a permission: ${key}`,
      });
    }
    if (this.#routes.has(key)) {
      throw new AppError({
        code: "CORE_DUPLICATE_ROUTE",
        message: `Route is already registered: ${key}`,
      });
    }
    this.#routes.set(key, { ...definition, owner });
  }

  list(): RegisteredHttpRoute[] {
    return [...this.#routes.values()].sort((left, right) => {
      return `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`);
    });
  }
}
