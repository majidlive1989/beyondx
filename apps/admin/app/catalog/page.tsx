"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  createCatalogProduct,
  createCatalogVariant,
  deleteCatalogProduct,
  deleteCatalogVariant,
  listCatalogAttributes,
  listCatalogBrands,
  listCatalogCategories,
  listCatalogProducts,
  getCatalogCustomFieldSchemas,
  listMedia,
  updateCatalogProduct,
  updateCatalogVariant,
} from "@/lib/api";
import { createSlug } from "@/lib/slug";
import type {
  CatalogAttribute,
  CatalogBrand,
  CatalogCategory,
  CatalogProduct,
  CatalogProductStatus,
  CatalogProductVariant,
  DataFieldDefinition,
  DataSchemaDefinition,
  MediaAsset,
} from "@/lib/types";

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [attributes, setAttributes] = useState<CatalogAttribute[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [schemas, setSchemas] = useState<DataSchemaDefinition[]>([]);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | CatalogProductStatus>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load(preferredId?: string) {
    try {
      const [productPage, brandData, categoryData, attributeData, mediaPage, schemaData] = await Promise.all([
        listCatalogProducts({
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          pageSize: 100,
        }),
        listCatalogBrands(),
        listCatalogCategories(),
        listCatalogAttributes(),
        listMedia({ pageSize: 100 }),
        getCatalogCustomFieldSchemas(),
      ]);
      setProducts(productPage.items);
      setBrands(brandData.items);
      setCategories(categoryData.items);
      setAttributes(attributeData.items);
      setMedia(mediaPage.items);
      const ensured = [schemaData.productSchema, schemaData.variantSchema].filter((item): item is DataSchemaDefinition => item !== null);
      const mergedSchemas = [...schemaData.componentSchemas, ...ensured];
      setSchemas(mergedSchemas);
      const targetId = preferredId ?? selected?.id;
      setSelected(targetId ? productPage.items.find((item) => item.id === targetId) ?? null : null);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load catalog");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const productSchema = schemas.find((schema) => schema.key === "catalog.product") ?? null;
  const variantSchema = schemas.find((schema) => schema.key === "catalog.variant") ?? null;

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Catalog</span>
          <h1>Products</h1>
          <p>Create products, manage variants and reuse images from the Media Library.</p>
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/catalog/taxonomy">Catalog setup</Link>
          <button className="primary-button" type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Close" : "New product"}
          </button>
        </div>
      </header>

      {showCreate ? (
        <CreateProductPanel
          brands={brands}
          categories={categories}
          media={media}
          customSchema={productSchema}
          schemas={schemas}
          busy={busy}
          onCreate={async (input) => {
            setBusy(true);
            try {
              const created = await createCatalogProduct(input);
              setShowCreate(false);
              await load(created.id);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to create product");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      <section className="panel">
        <div className="toolbar catalog-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name, slug or SKU" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | CatalogProductStatus)}>
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button className="secondary-button" type="button" onClick={() => void load()}>Filter</button>
        </div>
        {error ? <div className="error-banner">{error}</div> : null}

        <div className="catalog-layout">
          <div className="catalog-product-list">
            {products.length === 0 ? <div className="empty-state">No products match this filter.</div> : products.map((product) => (
              <button
                type="button"
                key={product.id}
                className={`catalog-product-card ${selected?.id === product.id ? "active" : ""}`}
                onClick={() => setSelected(product)}
              >
                <div>
                  <strong>{product.name}</strong>
                  <small>{product.slug}</small>
                </div>
                <span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span>
                <div className="catalog-card-meta">
                  <span>{product.variants.length} variant{product.variants.length === 1 ? "" : "s"}</span>
                  <span>{product.brand?.name ?? "No brand"}</span>
                  <span>{product.media.length} image{product.media.length === 1 ? "" : "s"}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="detail-card catalog-editor">
            {selected ? (
              <ProductEditor
                key={selected.id}
                product={selected}
                brands={brands}
                categories={categories}
                attributes={attributes}
                media={media}
                productSchema={productSchema}
                variantSchema={variantSchema}
                schemas={schemas}
                busy={busy}
                onError={setError}
                onBusy={setBusy}
                onReload={(id) => load(id)}
                onDeleted={() => {
                  setSelected(null);
                  return load();
                }}
              />
            ) : <div className="empty-state">Select a product to edit its catalog data and variants.</div>}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function CreateProductPanel({
  brands,
  categories,
  media,
  customSchema,
  schemas,
  busy,
  onCreate,
}: {
  brands: CatalogBrand[];
  categories: CatalogCategory[];
  media: MediaAsset[];
  customSchema: DataSchemaDefinition | null;
  schemas: DataSchemaDefinition[];
  busy: boolean;
  onCreate: (input: { name: string; slug: string; description?: string | null; brandId?: string | null; categoryIds?: string[]; mediaAssetIds?: string[]; customFields?: Record<string, unknown> }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [mediaAssetIds, setMediaAssetIds] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  return (
    <section className="panel form-panel">
      <form onSubmit={(event) => {
        event.preventDefault();
        void onCreate({
          name,
          slug: createSlug(name),
          description: description.trim() || null,
          brandId: brandId || null,
          categoryIds,
          mediaAssetIds,
          customFields,
        });
      }}>
        <div className="form-grid">
          <label>Product name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={180} /></label>
          <div className="upload-note">Slug: <strong>{createSlug(name) || "generated automatically"}</strong></div>
          <label>Brand<select value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className="full">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10_000} /></label>
        </div>
        <SelectionGrid title="Categories" items={categories.map((category) => ({ id: category.id, label: category.name, hint: category.slug }))} selected={categoryIds} onChange={setCategoryIds} />
        <SelectionGrid title="Product images" items={media.filter((asset) => asset.kind === "IMAGE").map((asset) => ({ id: asset.id, label: asset.title || asset.originalName, hint: asset.originalName }))} selected={mediaAssetIds} onChange={setMediaAssetIds} />
        {customSchema && customSchema.fields.length > 0 ? <CustomFieldsEditor title="Custom product fields" fields={customSchema.fields} values={customFields} media={media} schemas={schemas} onChange={setCustomFields} /> : null}
        <div className="upload-note">New products are created as DRAFT. Add at least one active variant/SKU before switching the product to ACTIVE.</div>
        <button className="primary-button" disabled={busy}>{busy ? "Creating…" : "Create draft product"}</button>
      </form>
    </section>
  );
}

function ProductEditor({
  product,
  brands,
  categories,
  attributes,
  media,
  productSchema,
  variantSchema,
  schemas,
  busy,
  onBusy,
  onError,
  onReload,
  onDeleted,
}: {
  product: CatalogProduct;
  brands: CatalogBrand[];
  categories: CatalogCategory[];
  attributes: CatalogAttribute[];
  media: MediaAsset[];
  productSchema: DataSchemaDefinition | null;
  variantSchema: DataSchemaDefinition | null;
  schemas: DataSchemaDefinition[];
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (value: string) => void;
  onReload: (id: string) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [status, setStatus] = useState<CatalogProductStatus>(product.status);
  const [brandId, setBrandId] = useState(product.brandId ?? "");
  const [categoryIds, setCategoryIds] = useState(product.categories.map((category) => category.id));
  const [mediaAssetIds, setMediaAssetIds] = useState(product.media.map((asset) => asset.id));
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(product.customFields ?? {});

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onBusy(true);
    try {
      await updateCatalogProduct(product.id, {
        name,
        description: description.trim() || null,
        status,
        brandId: brandId || null,
        categoryIds,
        mediaAssetIds,
        customFields,
      });
      await onReload(product.id);
      onError("");
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Unable to update product");
    } finally {
      onBusy(false);
    }
  }

  async function removeProduct() {
    if (!window.confirm(`Delete ${product.name} and all of its variants?`)) return;
    onBusy(true);
    try {
      await deleteCatalogProduct(product.id);
      await onDeleted();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Unable to delete product");
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="section-stack">
      <form onSubmit={(event) => void saveProduct(event)}>
        <div className="section-title"><div><span className="eyebrow">Product</span><h2>{product.name}</h2></div><span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span></div>
        <div className="form-grid">
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <div className="upload-note">Slug: <strong>{product.slug}</strong> · generated when the product is created</div>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as CatalogProductStatus)}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select></label>
          <label>Brand<select value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label className="full">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        </div>
        <SelectionGrid title="Categories" items={categories.map((category) => ({ id: category.id, label: category.name, hint: category.slug }))} selected={categoryIds} onChange={setCategoryIds} />
        <SelectionGrid title="Images from Media" items={media.filter((asset) => asset.kind === "IMAGE").map((asset) => ({ id: asset.id, label: asset.title || asset.originalName, hint: asset.originalName }))} selected={mediaAssetIds} onChange={setMediaAssetIds} />
        {productSchema && productSchema.fields.length > 0 ? <CustomFieldsEditor title="Additional product fields" fields={productSchema.fields} values={customFields} media={media} schemas={schemas} onChange={setCustomFields} /> : <div className="upload-note">Additional fields can be configured by an administrator in Settings → Structure.</div>}
        <div className="action-row">
          <button className="primary-button" disabled={busy}>Save product</button>
          <button className="danger-button" type="button" disabled={busy} onClick={() => void removeProduct()}>Delete product</button>
        </div>
      </form>

      <VariantManager product={product} attributes={attributes} customSchema={variantSchema} media={media} schemas={schemas} busy={busy} onBusy={onBusy} onError={onError} onReload={() => onReload(product.id)} />
    </div>
  );
}

function VariantManager({
  product,
  attributes,
  customSchema,
  media,
  schemas,
  busy,
  onBusy,
  onError,
  onReload,
}: {
  product: CatalogProduct;
  attributes: CatalogAttribute[];
  customSchema: DataSchemaDefinition | null;
  media: MediaAsset[];
  schemas: DataSchemaDefinition[];
  busy: boolean;
  onBusy: (value: boolean) => void;
  onError: (value: string) => void;
  onReload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<CatalogProductVariant | null>(null);
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [position, setPosition] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  const attributeValueIds = useMemo(() => Object.values(selections).filter(Boolean), [selections]);

  function reset() {
    setEditing(null);
    setTitle("");
    setSku("");
    setStatus("ACTIVE");
    setPosition(product.variants.length);
    setSelections({});
    setCustomFields({});
  }

  function edit(variant: CatalogProductVariant) {
    setEditing(variant);
    setTitle(variant.title);
    setSku(variant.sku);
    setStatus(variant.status);
    setPosition(variant.position);
    setSelections(Object.fromEntries(variant.attributes.map((selection) => [selection.attributeId, selection.valueId])));
    setCustomFields(variant.customFields ?? {});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onBusy(true);
    try {
      if (editing) {
        await updateCatalogVariant(editing.id, { title, sku, status, position, attributeValueIds, customFields });
      } else {
        await createCatalogVariant(product.id, { title, sku, status, position, attributeValueIds, customFields });
      }
      reset();
      await onReload();
      onError("");
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Unable to save variant");
    } finally {
      onBusy(false);
    }
  }

  async function remove(variant: CatalogProductVariant) {
    if (!window.confirm(`Delete SKU ${variant.sku}?`)) return;
    onBusy(true);
    try {
      await deleteCatalogVariant(variant.id);
      if (editing?.id === variant.id) reset();
      await onReload();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Unable to delete variant");
    } finally {
      onBusy(false);
    }
  }

  return (
    <section className="catalog-variant-panel">
      <div className="section-title"><div><span className="eyebrow">Variants & SKU</span><h3>{editing ? "Edit variant" : "Add variant"}</h3></div>{editing ? <button type="button" className="secondary-button" onClick={reset}>New variant</button> : null}</div>
      <div className="variant-list">
        {product.variants.length === 0 ? <div className="empty-state">No variants yet. Create one before activating the product.</div> : product.variants.map((variant) => (
          <div className="variant-row" key={variant.id}>
            <button type="button" className="variant-main" onClick={() => edit(variant)}>
              <strong>{variant.title}</strong><small>{variant.sku}</small><span>{variant.attributes.map((item) => `${item.attributeName}: ${item.value}`).join(" · ") || "No attributes"}</span>
            </button>
            <span className={`status status-${variant.status.toLowerCase()}`}>{variant.status}</span>
            <button type="button" className="danger-button compact-button" disabled={busy} onClick={() => void remove(variant)}>Delete</button>
          </div>
        ))}
      </div>
      <form onSubmit={(event) => void submit(event)} className="variant-form">
        <div className="form-grid">
          <label>Variant title<input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Neon Pink / 30mg" /></label>
          <label>Unique SKU<input value={sku} onChange={(event) => setSku(event.target.value)} required placeholder="LOOP-P2-PINK-30" /></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "DISABLED")}><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select></label>
          <label>Position<input type="number" min={0} value={position} onChange={(event) => setPosition(Number(event.target.value))} /></label>
        </div>
        {attributes.length > 0 ? <div className="attribute-picker">{attributes.map((attribute) => (
          <label key={attribute.id}>{attribute.name}<select value={selections[attribute.id] ?? ""} onChange={(event) => setSelections((current) => ({ ...current, [attribute.id]: event.target.value }))}><option value="">Not used</option>{attribute.values.map((value) => <option key={value.id} value={value.id}>{value.value}</option>)}</select></label>
        ))}</div> : <div className="upload-note">Create attributes such as Color, Size or Nicotine from Brands & attributes when needed.</div>}
        {customSchema && customSchema.fields.length > 0 ? <CustomFieldsEditor title="Custom variant fields" fields={customSchema.fields} values={customFields} media={media} schemas={schemas} onChange={setCustomFields} /> : null}
        <button className="primary-button" disabled={busy}>{editing ? "Update variant" : "Create variant"}</button>
      </form>
    </section>
  );
}


function CustomFieldsEditor({ title, fields, values, media, schemas, onChange }: {
  title: string;
  fields: DataFieldDefinition[];
  values: Record<string, unknown>;
  media: MediaAsset[];
  schemas: DataSchemaDefinition[];
  onChange: (values: Record<string, unknown>) => void;
}) {
  return <fieldset className="catalog-selection-grid schema-custom-fields"><legend>{title}</legend><div className="form-grid">{fields.map((field) => <CatalogDynamicInput
    key={field.id}
    field={field}
    value={values[field.key]}
    media={media}
    schemas={schemas}
    onChange={(value) => onChange({ ...values, [field.key]: value })}
  />)}</div></fieldset>;
}

function CatalogDynamicInput({ field, value, media, schemas, onChange }: {
  field: DataFieldDefinition;
  value: unknown;
  media: MediaAsset[];
  schemas: DataSchemaDefinition[];
  onChange: (value: unknown) => void;
}) {
  if (field.type === "COMPONENT") {
    const componentId = typeof field.settings?.componentSchemaId === "string" ? field.settings.componentSchemaId : "";
    const component = schemas.find((item) => item.id === componentId && item.kind === "COMPONENT");
    if (!component) return <label className="full">{field.label}<small>Component configuration is missing.</small></label>;
    if (field.repeatable) {
      const items = asCatalogRecordArray(value);
      return <fieldset className="full dynamic-component-field"><legend>{field.label}</legend>
        {items.map((item, index) => <div className="dynamic-block" key={`${field.id}-${index}`}>
          <div className="dynamic-block-head"><strong>{component.displayName} #{index + 1}</strong><button type="button" className="danger-button compact-button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>
          <CatalogComponentInputs component={component} value={item} media={media} schemas={schemas} onChange={(next) => onChange(items.map((current, itemIndex) => itemIndex === index ? next : current))} />
        </div>)}
        <button type="button" className="secondary-button" onClick={() => onChange([...items, {}])}>Add {component.displayName}</button>
      </fieldset>;
    }
    return <fieldset className="full dynamic-component-field"><legend>{field.label}</legend><CatalogComponentInputs component={component} value={asCatalogRecord(value) ?? {}} media={media} schemas={schemas} onChange={onChange} /></fieldset>;
  }

  if (field.type === "DYNAMIC_ZONE") {
    const allowedIds = asCustomStringArray(field.settings?.componentSchemaIds);
    const components = allowedIds.map((id) => schemas.find((item) => item.id === id && item.kind === "COMPONENT")).filter((item): item is DataSchemaDefinition => item !== undefined);
    const items = asCatalogZoneArray(value);
    return <fieldset className="full dynamic-zone-field"><legend>{field.label}</legend>
      {items.map((item, index) => {
        const component = components.find((candidate) => candidate.key === item.component) ?? null;
        return <div className="dynamic-block" key={`${field.id}-zone-${index}`}>
          <div className="dynamic-block-head">
            <select value={item.component} onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? { component: event.target.value, data: {} } : current))}>{components.map((candidate) => <option key={candidate.id} value={candidate.key}>{candidate.displayName}</option>)}</select>
            <button type="button" className="danger-button compact-button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
          </div>
          {component ? <CatalogComponentInputs component={component} value={item.data} media={media} schemas={schemas} onChange={(next) => onChange(items.map((current, itemIndex) => itemIndex === index ? { ...current, data: next } : current))} /> : null}
        </div>;
      })}
      {(() => {
        const firstComponent = components.at(0);
        return firstComponent ? (
          <button type="button" className="secondary-button" onClick={() => onChange([...items, { component: firstComponent.key, data: {} }])}>Add block</button>
        ) : (
          <small>No allowed components configured.</small>
        );
      })()}
    </fieldset>;
  }

  if (field.type === "MEDIA") {
    const selected = field.repeatable ? asCustomStringArray(value) : typeof value === "string" ? value : "";
    return <label>{field.label}<select multiple={field.repeatable} required={field.required} value={selected} onChange={(event) => onChange(field.repeatable ? Array.from(event.currentTarget.selectedOptions, (option) => option.value) : event.currentTarget.value || null)}><option value="">Select media</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.title || asset.originalName} · {asset.kind}</option>)}</select><small>Media Library</small></label>;
  }
  if (field.repeatable) {
    const text = Array.isArray(value) ? value.join(", ") : "";
    return <label className={["LONG_TEXT", "RICH_TEXT", "JSON"].includes(field.type) ? "full" : ""}>{field.label}<input required={field.required} value={text} onChange={(event) => onChange(parseCustomRepeatable(field, event.target.value))} placeholder="comma separated" /><small>{field.type}[]</small></label>;
  }
  if (field.type === "LONG_TEXT" || field.type === "RICH_TEXT") return <label className="full">{field.label}<textarea required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} /><small>{field.type}</small></label>;
  if (field.type === "UID") return <label>{field.label}<input required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} placeholder="auto-generated-on-save" /><small>Unique URL-safe UID</small></label>;
  if (field.type === "NUMBER") return <label>{field.label}<input type="number" required={field.required} value={typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /></label>;
  if (field.type === "BOOLEAN") return <label className="checkbox-label"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /> {field.label}</label>;
  if (field.type === "DATE") return <label>{field.label}<input type="datetime-local" required={field.required} value={typeof value === "string" ? customLocalDateTime(value) : ""} onChange={(event) => onChange(event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>;
  if (field.type === "ENUM") {
    const options = Array.isArray(field.settings?.options) ? field.settings.options.filter((item): item is string => typeof item === "string") : [];
    return <label>{field.label}<select required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}><option value="">Select</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  }
  if (field.type === "JSON") return <label className="full">{field.label}<textarea defaultValue={value === undefined ? "{}" : JSON.stringify(value, null, 2)} onBlur={(event) => { try { onChange(JSON.parse(event.target.value)); } catch { /* invalid JSON stays unsaved */ } }} /><small>JSON</small></label>;
  return <label>{field.label}<input required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} placeholder={field.type === "RELATION" ? "Related dynamic record ID" : ""} /><small>{field.type}</small></label>;
}

function CatalogComponentInputs({ component, value, media, schemas, onChange }: {
  component: DataSchemaDefinition;
  value: Record<string, unknown>;
  media: MediaAsset[];
  schemas: DataSchemaDefinition[];
  onChange: (value: Record<string, unknown>) => void;
}) {
  return <div className="form-grid dynamic-component-grid">{component.fields.map((field) => <CatalogDynamicInput
    key={field.id}
    field={field}
    value={value[field.key]}
    media={media}
    schemas={schemas}
    onChange={(next) => onChange({ ...value, [field.key]: next })}
  />)}</div>;
}

function asCustomStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asCatalogRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asCatalogRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asCatalogRecord).filter((item): item is Record<string, unknown> => item !== null) : [];
}

function asCatalogZoneArray(value: unknown): Array<{ component: string; data: Record<string, unknown> }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const item = asCatalogRecord(raw);
    if (!item || typeof item.component !== "string") return [];
    const data = asCatalogRecord(item.data);
    return data ? [{ component: item.component, data }] : [];
  });
}

function parseCustomRepeatable(field: DataFieldDefinition, text: string): unknown[] {
  const items = text.split(",").map((item) => item.trim()).filter(Boolean);
  return field.type === "NUMBER" ? items.map(Number).filter(Number.isFinite) : field.type === "BOOLEAN" ? items.map((item) => item === "true") : items;
}

function customLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function SelectionGrid({ title, items, selected, onChange }: { title: string; items: Array<{ id: string; label: string; hint: string }>; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <fieldset className="catalog-selection-grid">
      <legend>{title}</legend>
      {items.length === 0 ? <small className="muted">No options available.</small> : items.map((item) => {
        const checked = selected.includes(item.id);
        return <label className="check-row" key={item.id}><input type="checkbox" checked={checked} onChange={() => onChange(checked ? selected.filter((id) => id !== item.id) : [...selected, item.id])} /><span><strong>{item.label}</strong><small>{item.hint}</small></span></label>;
      })}
    </fieldset>
  );
}
