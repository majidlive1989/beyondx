"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  createDynamicRecord,
  deleteDynamicRecord,
  listRuntimeDataSchemas,
  listDynamicRecords,
  listMedia,
  updateDynamicRecord,
} from "@/lib/api";
import type {
  DataFieldDefinition,
  DataRecordStatus,
  DataSchemaDefinition,
  DynamicDataRecord,
  MediaAsset,
} from "@/lib/types";

type RelationOptions = Record<string, { schema: DataSchemaDefinition; records: DynamicDataRecord[] }>;

interface ZoneItem {
  component: string;
  data: Record<string, unknown>;
}

export default function DynamicDataPage() {
  const params = useParams<{ schemaKey: string }>();
  const schemaKey = decodeURIComponent(params.schemaKey);
  const [schemas, setSchemas] = useState<DataSchemaDefinition[]>([]);
  const [schema, setSchema] = useState<DataSchemaDefinition | null>(null);
  const [records, setRecords] = useState<DynamicDataRecord[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [relations, setRelations] = useState<RelationOptions>({});
  const [selected, setSelected] = useState<DynamicDataRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(preferredId?: string) {
    try {
      const schemaResult = await listRuntimeDataSchemas();
      setSchemas(schemaResult.items);
      const current = schemaResult.items.find((item) => item.key === schemaKey) ?? null;
      setSchema(current);
      if (!current || current.kind === "SYSTEM_EXTENSION" || current.kind === "COMPONENT") {
        setRecords([]);
        return;
      }

      const effectiveFields = collectFields(current, schemaResult.items);
      const relationSchemas = [...new Set(effectiveFields
        .filter((field) => field.type === "RELATION" && field.relationTargetSchemaId)
        .map((field) => field.relationTargetSchemaId as string))]
        .map((targetId) => schemaResult.items.find((item) => item.id === targetId))
        .filter((item): item is DataSchemaDefinition => item !== undefined && (item.kind === "COLLECTION" || item.kind === "SINGLE"));

      const [page, mediaPage, ...relationPages] = await Promise.all([
        listDynamicRecords(schemaKey, { pageSize: 100 }),
        effectiveFields.some((field) => field.type === "MEDIA") ? listMedia({ pageSize: 100 }) : Promise.resolve(null),
        ...relationSchemas.map((target) => listDynamicRecords(target.key, { pageSize: 100 })),
      ]);
      setRecords(page.items);
      setMedia(mediaPage?.items ?? []);
      setRelations(Object.fromEntries(relationSchemas.map((target, index) => [
        target.id,
        { schema: target, records: relationPages[index]?.items ?? [] },
      ])));
      const target = preferredId ?? selected?.id;
      setSelected(target ? page.items.find((item) => item.id === target) ?? null : null);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load records");
    }
  }

  useEffect(() => { void load(); }, [schemaKey]);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    try {
      const id = await action();
      await load(id || selected?.id);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Record operation failed");
    } finally {
      setBusy(false);
    }
  }

  return <AdminShell>
    <header className="page-header">
      <div>
        <span className="eyebrow">Content</span>
        <h1>{schema?.pluralName ?? schemaKey}</h1>
        <p>{schema ? `Create and manage ${schema.pluralName.toLowerCase()} from one simple workspace.` : "Loading content…"}</p>
      </div>
      {schema?.kind === "COLLECTION" ? <button className="primary-button" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Close" : `New ${schema.displayName}`}</button> : null}
    </header>
    {error ? <div className="error-banner">{error}</div> : null}
    {!schema ? <section className="panel"><div className="empty-state">Schema not found.</div></section>
      : schema.kind === "SYSTEM_EXTENSION" ? <section className="panel"><div className="empty-state">System extension schemas are edited through their owning module.</div></section>
        : schema.kind === "COMPONENT" ? <section className="panel"><div className="empty-state">Components are reusable field groups. Add this component to a collection, single type or system extension in Builder.</div></section>
          : <>
            {(showCreate || (schema.kind === "SINGLE" && records.length === 0)) ? <section className="panel form-panel"><GeneratedRecordForm
              schema={schema}
              schemas={schemas}
              record={null}
              media={media}
              relations={relations}
              busy={busy}
              onSubmit={(input) => run(async () => (await createDynamicRecord(schema.key, input)).id)}
            /></section> : null}
            <section className="panel"><div className="catalog-layout">
              <div className="catalog-product-list">{records.length === 0 ? <div className="empty-state">No records yet.</div> : records.map((record) => <button className={`catalog-product-card ${selected?.id === record.id ? "active" : ""}`} type="button" key={record.id} onClick={() => setSelected(record)}><div><strong>{recordTitle(schema, record)}</strong><small>{record.id}</small></div><span className={`status status-${record.status.toLowerCase()}`}>{record.status}</span></button>)}</div>
              <div className="detail-card catalog-editor">{selected ? <GeneratedRecordForm
                key={selected.id}
                schema={schema}
                schemas={schemas}
                record={selected}
                media={media}
                relations={relations}
                busy={busy}
                onSubmit={(input) => run(async () => (await updateDynamicRecord(schema.key, selected.id, input)).id)}
                onDelete={() => run(async () => {
                  if (window.confirm("Delete this record?")) {
                    await deleteDynamicRecord(schema.key, selected.id);
                    setSelected(null);
                  }
                })}
              /> : <div className="empty-state">Select a record.</div>}</div>
            </div></section>
          </>}
  </AdminShell>;
}

function GeneratedRecordForm({ schema, schemas, record, media, relations, busy, onSubmit, onDelete }: {
  schema: DataSchemaDefinition;
  schemas: DataSchemaDefinition[];
  record: DynamicDataRecord | null;
  media: MediaAsset[];
  relations: RelationOptions;
  busy: boolean;
  onSubmit: (input: { status?: DataRecordStatus; values: Record<string, unknown> }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [status, setStatus] = useState<DataRecordStatus>(record?.status ?? "DRAFT");
  const [values, setValues] = useState<Record<string, unknown>>(record?.values ?? {});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ status, values });
  }

  return <form onSubmit={(event) => void submit(event)}>
    <div className="section-title">
      <div><span className="eyebrow">Generated form</span><h2>{record ? `Edit ${schema.displayName}` : `New ${schema.displayName}`}</h2></div>
      {record && onDelete ? <button className="danger-button" type="button" disabled={busy} onClick={() => void onDelete()}>Delete</button> : null}
    </div>
    <div className="form-grid">
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as DataRecordStatus)}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select></label>
      {schema.fields.map((field) => <DynamicInput
        key={field.id}
        field={field}
        value={values[field.key]}
        schemas={schemas}
        media={media}
        relations={relations}
        onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
      />)}
    </div>
    <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
  </form>;
}

function DynamicInput({ field, value, schemas, media, relations, onChange }: {
  field: DataFieldDefinition;
  value: unknown;
  schemas: DataSchemaDefinition[];
  media: MediaAsset[];
  relations: RelationOptions;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "COMPONENT") {
    const componentId = typeof field.settings?.componentSchemaId === "string" ? field.settings.componentSchemaId : "";
    const component = schemas.find((item) => item.id === componentId && item.kind === "COMPONENT");
    if (!component) return <label className="full">{field.label}<small>Component configuration is missing.</small></label>;
    if (field.repeatable) {
      const items = asRecordArray(value);
      return <fieldset className="full dynamic-component-field"><legend>{field.label}{field.required ? " *" : ""}</legend>
        {items.map((item, index) => <div className="dynamic-block" key={`${field.id}-${index}`}>
          <div className="dynamic-block-head"><strong>{component.displayName} #{index + 1}</strong><button type="button" className="danger-button compact-button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>
          <ComponentInputs component={component} value={item} schemas={schemas} media={media} relations={relations} onChange={(next) => onChange(items.map((current, itemIndex) => itemIndex === index ? next : current))} />
        </div>)}
        <button type="button" className="secondary-button" onClick={() => onChange([...items, {}])}>Add {component.displayName}</button>
      </fieldset>;
    }
    const data = asRecord(value) ?? {};
    return <fieldset className="full dynamic-component-field"><legend>{field.label}{field.required ? " *" : ""}</legend><ComponentInputs component={component} value={data} schemas={schemas} media={media} relations={relations} onChange={onChange} /></fieldset>;
  }

  if (field.type === "DYNAMIC_ZONE") {
    const allowedIds = asStringArray(field.settings?.componentSchemaIds);
    const components = allowedIds.map((id) => schemas.find((item) => item.id === id && item.kind === "COMPONENT")).filter((item): item is DataSchemaDefinition => item !== undefined);
    const items = asZoneArray(value);
    return <fieldset className="full dynamic-zone-field"><legend>{field.label}{field.required ? " *" : ""}</legend>
      {items.map((item, index) => {
        const component = components.find((candidate) => candidate.key === item.component) ?? null;
        return <div className="dynamic-block" key={`${field.id}-zone-${index}`}>
          <div className="dynamic-block-head">
            <select value={item.component} onChange={(event) => {
              const nextKey = event.target.value;
              onChange(items.map((current, itemIndex) => itemIndex === index ? { component: nextKey, data: {} } : current));
            }}>{components.map((candidate) => <option key={candidate.id} value={candidate.key}>{candidate.displayName}</option>)}</select>
            <button type="button" className="danger-button compact-button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
          </div>
          {component ? <ComponentInputs component={component} value={item.data} schemas={schemas} media={media} relations={relations} onChange={(next) => onChange(items.map((current, itemIndex) => itemIndex === index ? { ...current, data: next } : current))} /> : <small>Choose a component.</small>}
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
    const selected = field.repeatable ? asStringArray(value) : typeof value === "string" ? value : "";
    return <label>{field.label}<select multiple={field.repeatable} required={field.required} value={selected} onChange={(event) => onChange(field.repeatable ? Array.from(event.currentTarget.selectedOptions, (option) => option.value) : event.currentTarget.value || null)}><option value="">Select media</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.title || asset.originalName} · {asset.kind}</option>)}</select><small>{field.repeatable ? "Multiple media assets" : "Media Library"}</small></label>;
  }

  if (field.type === "RELATION") {
    const relation = field.relationTargetSchemaId ? relations[field.relationTargetSchemaId] : undefined;
    const selected = field.repeatable ? asStringArray(value) : typeof value === "string" ? value : "";
    return <label>{field.label}<select multiple={field.repeatable} required={field.required} value={selected} onChange={(event) => onChange(field.repeatable ? Array.from(event.currentTarget.selectedOptions, (option) => option.value) : event.currentTarget.value || null)}><option value="">Select related record</option>{relation?.records.map((record) => <option key={record.id} value={record.id}>{recordTitle(relation.schema, record)}</option>)}</select><small>{relation ? relation.schema.displayName : "Relation target unavailable"}</small></label>;
  }

  if (field.repeatable) {
    const text = Array.isArray(value) ? value.join(", ") : "";
    return <label className={["LONG_TEXT", "RICH_TEXT", "JSON"].includes(field.type) ? "full" : ""}>{field.label}<input required={field.required} value={text} onChange={(event) => onChange(parseRepeatable(field, event.target.value))} placeholder="comma separated values" /><small>{field.type}[]</small></label>;
  }

  switch (field.type) {
    case "LONG_TEXT":
    case "RICH_TEXT":
      return <label className="full">{field.label}<textarea required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} /><small>{field.type === "RICH_TEXT" ? "Rich text source (rendering layer can attach an editor plugin later)" : "Long text"}</small></label>;
    case "UID":
      return <label>{field.label}<input required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} placeholder="auto-generated-on-save" /><small>URL-safe and unique. Leave blank to generate from the configured source field.</small></label>;
    case "NUMBER":
      return <label>{field.label}<input type="number" required={field.required} value={typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /></label>;
    case "BOOLEAN":
      return <label className="checkbox-label"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /> {field.label}</label>;
    case "DATE":
      return <label>{field.label}<input type="datetime-local" required={field.required} value={typeof value === "string" ? toLocalDateTime(value) : ""} onChange={(event) => onChange(event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>;
    case "ENUM": {
      const options = Array.isArray(field.settings?.options) ? field.settings.options.filter((item): item is string => typeof item === "string") : [];
      return <label>{field.label}<select required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}><option value="">Select</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
    }
    case "JSON":
      return <JsonInput field={field} value={value} onChange={onChange} />;
    default:
      return <label>{field.label}<input required={field.required} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} /></label>;
  }
}

function ComponentInputs({ component, value, schemas, media, relations, onChange }: {
  component: DataSchemaDefinition;
  value: Record<string, unknown>;
  schemas: DataSchemaDefinition[];
  media: MediaAsset[];
  relations: RelationOptions;
  onChange: (value: Record<string, unknown>) => void;
}) {
  return <div className="form-grid dynamic-component-grid">{component.fields.map((field) => <DynamicInput
    key={field.id}
    field={field}
    value={value[field.key]}
    schemas={schemas}
    media={media}
    relations={relations}
    onChange={(next) => onChange({ ...value, [field.key]: next })}
  />)}</div>;
}

function collectFields(schema: DataSchemaDefinition, schemas: DataSchemaDefinition[], visited = new Set<string>()): DataFieldDefinition[] {
  if (visited.has(schema.id)) return [];
  visited.add(schema.id);
  const result = [...schema.fields];
  for (const field of schema.fields) {
    const targetIds = field.type === "COMPONENT"
      ? (typeof field.settings?.componentSchemaId === "string" ? [field.settings.componentSchemaId] : [])
      : field.type === "DYNAMIC_ZONE"
        ? asStringArray(field.settings?.componentSchemaIds)
        : [];
    for (const targetId of targetIds) {
      const component = schemas.find((item) => item.id === targetId && item.kind === "COMPONENT");
      if (component) result.push(...collectFields(component, schemas, visited));
    }
  }
  return result;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null) : [];
}

function asZoneArray(value: unknown): ZoneItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const item = asRecord(raw);
    if (!item || typeof item.component !== "string") return [];
    const data = asRecord(item.data);
    return data ? [{ component: item.component, data }] : [];
  });
}

function JsonInput({ field, value, onChange }: { field: DataFieldDefinition; value: unknown; onChange: (value: unknown) => void }) {
  const initial = useMemo(() => value === undefined ? "{}" : JSON.stringify(value, null, 2), [value]);
  const [text, setText] = useState(initial);
  return <label className="full">{field.label}<textarea value={text} onChange={(event) => {
    const next = event.target.value;
    setText(next);
    try { onChange(JSON.parse(next)); } catch { /* keep editing until valid JSON */ }
  }} /><small>JSON</small></label>;
}

function parseRepeatable(field: DataFieldDefinition, text: string): unknown[] {
  const items = text.split(",").map((item) => item.trim()).filter(Boolean);
  if (field.type === "NUMBER") return items.map(Number).filter(Number.isFinite);
  if (field.type === "BOOLEAN") return items.map((item) => item === "true");
  return items;
}

function recordTitle(schema: DataSchemaDefinition, record: DynamicDataRecord): string {
  const firstText = schema.fields.find((field) => ["TEXT", "UID", "ENUM"].includes(field.type));
  const value = firstText ? record.values[firstText.key] : null;
  return typeof value === "string" && value ? value : `${schema.displayName} · ${record.id.slice(-6)}`;
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
