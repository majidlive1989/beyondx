import type {
  BeyondXPage,
  CatalogBrand,
  CatalogCategory,
  CatalogProduct,
  ContentEntry,
  DiscussionKind,
  DiscussionSourceType,
  DiscussionEntry,
  DiscussionSubmission,
  DiscussionThread,
  DynamicRecord,
  ThemeDeliveryManifest,
} from "./types.js";

export type BeyondXFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface BeyondXThemeClientOptions {
  baseUrl: string;
  fetch?: BeyondXFetch;
  headers?: HeadersInit;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface ContentListOptions extends PaginationOptions {
  locale?: string;
}

export interface CatalogListOptions extends PaginationOptions {
  search?: string;
  brand?: string;
  category?: string;
}

export interface DiscussionListOptions extends PaginationOptions {
  kind?: DiscussionKind;
}

export class BeyondXApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly details: unknown,
  ) {
    super(message);
    this.name = "BeyondXApiError";
  }
}

export class BeyondXThemeClient {
  readonly content: {
    list: <TData extends Record<string, unknown> = Record<string, unknown>>(apiId: string, options?: ContentListOptions) => Promise<BeyondXPage<ContentEntry<TData>>>;
    get: <TData extends Record<string, unknown> = Record<string, unknown>>(apiId: string, slug: string, locale?: string) => Promise<ContentEntry<TData>>;
  };

  readonly data: {
    list: <TValues extends Record<string, unknown> = Record<string, unknown>>(schemaKey: string, options?: PaginationOptions) => Promise<BeyondXPage<DynamicRecord<TValues>>>;
    get: <TValues extends Record<string, unknown> = Record<string, unknown>>(schemaKey: string, id: string) => Promise<DynamicRecord<TValues>>;
  };

  readonly catalog: {
    listProducts: <TCustomFields extends Record<string, unknown> = Record<string, unknown>>(options?: CatalogListOptions) => Promise<BeyondXPage<CatalogProduct<TCustomFields>>>;
    getProduct: <TCustomFields extends Record<string, unknown> = Record<string, unknown>>(slug: string) => Promise<CatalogProduct<TCustomFields>>;
    listBrands: () => Promise<CatalogBrand[]>;
    listCategories: () => Promise<CatalogCategory[]>;
  };

  readonly discussions: {
    list: (sourceType: DiscussionSourceType, sourceId: string, options?: DiscussionListOptions) => Promise<DiscussionThread>;
    submit: (input: DiscussionSubmission) => Promise<{ entry: DiscussionEntry }>;
  };

  private readonly baseUrl: string;
  private readonly requestFetch: BeyondXFetch;
  private readonly defaultHeaders: HeadersInit | undefined;

  constructor(options: BeyondXThemeClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.requestFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.headers;

    this.content = {
      list: <TData extends Record<string, unknown> = Record<string, unknown>>(apiId: string, listOptions: ContentListOptions = {}) =>
        this.get<BeyondXPage<ContentEntry<TData>>>(`/api/v1/content/${segment(apiId)}`, contentListQuery(listOptions)),
      get: async <TData extends Record<string, unknown> = Record<string, unknown>>(apiId: string, slug: string, locale = "en") => {
        const response = await this.get<{ entry: ContentEntry<TData> }>(`/api/v1/content/${segment(apiId)}/${segment(slug)}`, { locale });
        return response.entry;
      },
    };

    this.data = {
      list: <TValues extends Record<string, unknown> = Record<string, unknown>>(schemaKey: string, listOptions: PaginationOptions = {}) =>
        this.get<BeyondXPage<DynamicRecord<TValues>>>(`/api/v1/data/${segment(schemaKey)}`, paginationQuery(listOptions)),
      get: async <TValues extends Record<string, unknown> = Record<string, unknown>>(schemaKey: string, id: string) => {
        const response = await this.get<{ record: DynamicRecord<TValues> }>(`/api/v1/data/${segment(schemaKey)}/${segment(id)}`);
        return response.record;
      },
    };

    this.catalog = {
      listProducts: <TCustomFields extends Record<string, unknown> = Record<string, unknown>>(listOptions: CatalogListOptions = {}) =>
        this.get<BeyondXPage<CatalogProduct<TCustomFields>>>("/api/v1/catalog/products", catalogListQuery(listOptions)),
      getProduct: async <TCustomFields extends Record<string, unknown> = Record<string, unknown>>(slug: string) => {
        const response = await this.get<{ product: CatalogProduct<TCustomFields> }>(`/api/v1/catalog/products/${segment(slug)}`);
        return response.product;
      },
      listBrands: async () => (await this.get<{ items: CatalogBrand[] }>("/api/v1/catalog/brands")).items,
      listCategories: async () => (await this.get<{ items: CatalogCategory[] }>("/api/v1/catalog/categories")).items,
    };

    this.discussions = {
      list: (sourceType, sourceId, listOptions = {}) =>
        this.get<DiscussionThread>(`/api/v1/discussions/${segment(sourceType)}/${segment(sourceId)}`, discussionListQuery(listOptions)),
      submit: (input) => this.request<{ entry: DiscussionEntry }>("/api/v1/discussions", { method: "POST", body: JSON.stringify(input) }),
    };
  }

  manifest(): Promise<ThemeDeliveryManifest> {
    return this.get<ThemeDeliveryManifest>("/api/v1/theme/manifest");
  }

  private get<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = this.url(path, query);
    return this.request<T>(url.pathname + url.search, { method: "GET" });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(this.defaultHeaders);
    headers.set("accept", "application/json");
    if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");

    const response = await this.requestFetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    const payload: unknown = await response.json();
    return payload as T;
  }

  private url(path: string, query?: Record<string, string>): URL {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    }
    return url;
  }
}

export function createBeyondXThemeClient(options: BeyondXThemeClientOptions): BeyondXThemeClient {
  return new BeyondXThemeClient(options);
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) throw new Error("BeyondX theme SDK baseUrl must be an absolute http(s) URL");
  return trimmed;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

function paginationQuery(options: PaginationOptions): Record<string, string> {
  return compactQuery({
    page: options.page === undefined ? undefined : String(options.page),
    pageSize: options.pageSize === undefined ? undefined : String(options.pageSize),
  });
}

function contentListQuery(options: ContentListOptions): Record<string, string> {
  return compactQuery({ ...paginationQuery(options), locale: options.locale });
}

function catalogListQuery(options: CatalogListOptions): Record<string, string> {
  return compactQuery({ ...paginationQuery(options), search: options.search, brand: options.brand, category: options.category });
}

function discussionListQuery(options: DiscussionListOptions): Record<string, string> {
  return compactQuery({ ...paginationQuery(options), kind: options.kind });
}

function compactQuery(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

async function toApiError(response: Response): Promise<BeyondXApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const envelope = asRecord(asRecord(payload)?.error);
  const message = typeof envelope?.message === "string" ? envelope.message : `BeyondX API request failed with HTTP ${response.status}`;
  const code = typeof envelope?.code === "string" ? envelope.code : null;
  return new BeyondXApiError(message, response.status, code, envelope?.details ?? payload);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
