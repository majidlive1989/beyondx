"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  createDataField,
  createDataSchema,
  deleteDataField,
  deleteDataSchema,
  listDataSchemas,
  updateDataSchema,
} from "@/lib/api";
import type { DataFieldType, DataSchemaDefinition, DataSchemaKind } from "@/lib/types";

const fieldTypes: DataFieldType[] = [
  "TEXT",
  "LONG_TEXT",
  "RICH_TEXT",
  "UID",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "JSON",
  "ENUM",
  "MEDIA",
  "RELATION",
  "COMPONENT",
  "DYNAMIC_ZONE",
];

export default function BuilderPage() {
  const [schemas, setSchemas] = useState<DataSchemaDefinition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => schemas.find((schema) => schema.id === selectedId) ?? schemas[0] ?? null,
    [schemas, selectedId],
  );

  async function load(preferredId?: string) {
    try {
      const result = await listDataSchemas();
      setSchemas(result.items);
      if (preferredId) setSelectedId(preferredId);
      else if (!selectedId && result.items[0]) setSelectedId(result.items[0].id);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load schemas");
    }
  }

  useEffect(() => { void load(); }, []);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    try {
      const preferred = await action();
      await load(preferred || selected?.id);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Schema operation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Settings · Advanced</span>
          <h1>Structure builder</h1>
          <p>Define the structure behind your content and custom fields. Everyday editors do not need to use this screen.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? "Close" : "Create structure"}
        </button>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {showCreate ? <CreateSchemaPanel busy={busy} onCreate={(input) => run(async () => {
        const created = await createDataSchema(input);
        setShowCreate(false);
        return created.id;
      })} /> : null}

      <section className="builder-layout">
        <aside className="panel builder-schema-list">
          <div className="section-title"><div><span className="eyebrow">Structures</span><h2>Models & components</h2></div></div>
          {schemas.length === 0 ? <div className="empty-state">No structures yet.</div> : schemas.map((schema) => (
            <button
              key={schema.id}
              type="button"
              className={`builder-schema-item ${selected?.id === schema.id ? "active" : ""}`}
              onClick={() => setSelectedId(schema.id)}
            >
              <div><strong>{schema.displayName}</strong><small>{schema.key}</small></div>
              <span className="schema-kind">{kindLabel(schema.kind)}</span>
            </button>
          ))}
        </aside>

        <div className="panel builder-detail">
          {selected ? (
            <SchemaEditor
              schema={selected}
              schemas={schemas}
              busy={busy}
              run={run}
              onDelete={async () => {
                await run(async () => { await deleteDataSchema(selected.id); setSelectedId(""); });
              }}
            />
          ) : <div className="empty-state">Create or select a structure.</div>}
        </div>
      </section>
    </AdminShell>
  );
}

function CreateSchemaPanel({ busy, onCreate }: {
  busy: boolean;
  onCreate: (input: {
    key: string;
    displayName: string;
    pluralName: string;
    description?: string | null;
    kind?: Exclude<DataSchemaKind, "SYSTEM_EXTENSION">;
    publicRead?: boolean;
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [pluralName, setPluralName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"COLLECTION" | "SINGLE" | "COMPONENT">("COLLECTION");
  const [publicRead, setPublicRead] = useState(false);

  return <section className="panel form-panel"><form onSubmit={(event) => {
    event.preventDefault();
    void onCreate({
      key,
      displayName,
      pluralName,
      description: description.trim() || null,
      kind,
      publicRead: kind === "COMPONENT" ? false : publicRead,
    });
  }}>
    <div className="form-grid">
      <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required placeholder="FAQ" /></label>
      <label>Plural name<input value={pluralName} onChange={(event) => setPluralName(event.target.value)} required placeholder="FAQs" /></label>
      <label>API key<input value={key} onChange={(event) => setKey(event.target.value)} required placeholder="faq" /><small>lowercase; dots and hyphens are allowed</small></label>
      <label>Model type<select value={kind} onChange={(event) => setKind(event.target.value as "COLLECTION" | "SINGLE" | "COMPONENT")}>
        <option value="COLLECTION">Collection type</option>
        <option value="SINGLE">Single type</option>
        <option value="COMPONENT">Reusable component</option>
      </select></label>
      <label className="full">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      {kind !== "COMPONENT" ? <label className="checkbox-label"><input type="checkbox" checked={publicRead} onChange={(event) => setPublicRead(event.target.checked)} /> Public read API</label> : null}
    </div>
    <button className="primary-button" disabled={busy}>{busy ? "Creating…" : "Create model"}</button>
  </form></section>;
}

function SchemaEditor({ schema, schemas, busy, run, onDelete }: {
  schema: DataSchemaDefinition;
  schemas: DataSchemaDefinition[];
  busy: boolean;
  run: (action: () => Promise<string | void>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const canManageRecords = schema.kind === "COLLECTION" || schema.kind === "SINGLE";
  return <>
    <div className="section-title builder-schema-header">
      <div><span className="eyebrow">{kindLabel(schema.kind)}</span><h2>{schema.displayName}</h2><p>{schema.description ?? schema.key}</p></div>
      <div className="button-row">
        {canManageRecords ? <Link className="secondary-button" href={`/data/${encodeURIComponent(schema.key)}`}>Open content</Link> : null}
        {!schema.system ? <button className="danger-button" type="button" disabled={busy} onClick={() => {
          if (window.confirm(`Delete ${schema.displayName}?`)) void onDelete();
        }}>Delete model</button> : null}
      </div>
    </div>

    <div className="schema-settings-row">
      {schema.kind !== "COMPONENT" ? <label className="checkbox-label"><input
        type="checkbox"
        checked={schema.publicRead}
        disabled={schema.kind === "SYSTEM_EXTENSION" || busy}
        onChange={(event) => void run(async () => { await updateDataSchema(schema.id, { publicRead: event.target.checked }); })}
      /> Public API</label> : <span className="system-badge">Reusable component · embedded in other models</span>}
      {schema.system ? <span className="system-badge">Protected system schema · fields are extendable</span> : null}
    </div>

    <AddFieldPanel schema={schema} schemas={schemas} busy={busy} run={run} />

    <div className="field-definition-list">
      {schema.fields.length === 0 ? <div className="empty-state">No fields yet. Add fields above; generated forms and APIs will follow this definition.</div> : schema.fields.map((field) => (
        <div className="field-definition-row" key={field.id}>
          <div><strong>{field.label}</strong><small>{field.key} · {field.type}{field.repeatable ? "[]" : ""}{field.required ? " · required" : ""}{fieldSummary(field, schemas)}</small></div>
          <button className="danger-button compact-button" type="button" disabled={busy} onClick={() => void run(async () => {
            if (window.confirm(`Delete field ${field.label}?`)) await deleteDataField(field.id);
          })}>Delete</button>
        </div>
      ))}
    </div>
  </>;
}

function AddFieldPanel({ schema, schemas, busy, run }: {
  schema: DataSchemaDefinition;
  schemas: DataSchemaDefinition[];
  busy: boolean;
  run: (action: () => Promise<string | void>) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<DataFieldType>("TEXT");
  const [required, setRequired] = useState(false);
  const [repeatable, setRepeatable] = useState(false);
  const [enumOptions, setEnumOptions] = useState("");
  const [relationTargetSchemaId, setRelationTargetSchemaId] = useState("");
  const [componentSchemaId, setComponentSchemaId] = useState("");
  const [dynamicZoneSchemaIds, setDynamicZoneSchemaIds] = useState<string[]>([]);
  const [uidTargetField, setUidTargetField] = useState("");
  const [minLength, setMinLength] = useState("");
  const [maxLength, setMaxLength] = useState("");

  const components = schemas.filter((item) => item.kind === "COMPONENT" && item.id !== schema.id);
  const relationTargets = schemas.filter((item) => item.kind === "COLLECTION" || item.kind === "SINGLE");
  const uidTargets = schema.fields.filter((field) => ["TEXT", "LONG_TEXT", "RICH_TEXT", "UID"].includes(field.type));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const settings: Record<string, unknown> = {};
      if (type === "ENUM") settings.options = enumOptions.split(",").map((item) => item.trim()).filter(Boolean);
      if (type === "COMPONENT") settings.componentSchemaId = componentSchemaId;
      if (type === "DYNAMIC_ZONE") settings.componentSchemaIds = dynamicZoneSchemaIds;
      if (type === "UID" && uidTargetField) settings.targetField = uidTargetField;

      const validation: Record<string, unknown> = {};
      if (minLength !== "") validation.minLength = Number(minLength);
      if (maxLength !== "") validation.maxLength = Number(maxLength);

      await createDataField(schema.id, {
        key,
        label,
        type,
        required,
        repeatable: type === "DYNAMIC_ZONE" ? false : repeatable,
        position: schema.fields.length,
        ...(Object.keys(settings).length === 0 ? {} : { settings }),
        ...(Object.keys(validation).length === 0 ? {} : { validation }),
        ...(type === "RELATION" ? { relationTargetSchemaId } : {}),
      });
      setKey("");
      setLabel("");
      setType("TEXT");
      setRequired(false);
      setRepeatable(false);
      setEnumOptions("");
      setRelationTargetSchemaId("");
      setComponentSchemaId("");
      setDynamicZoneSchemaIds([]);
      setUidTargetField("");
      setMinLength("");
      setMaxLength("");
    });
  }

  return <form className="schema-field-form" onSubmit={(event) => void submit(event)}>
    <div className="form-grid">
      <label>Field label<input value={label} onChange={(event) => setLabel(event.target.value)} required placeholder="Hero blocks" /></label>
      <label>Field key<input value={key} onChange={(event) => setKey(event.target.value)} required placeholder="heroBlocks" /></label>
      <label>Field type<select value={type} onChange={(event) => setType(event.target.value as DataFieldType)}>{fieldTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      {type === "ENUM" ? <label>Options<input value={enumOptions} onChange={(event) => setEnumOptions(event.target.value)} required placeholder="draft, review, approved" /></label> : null}
      {type === "RELATION" ? <label>Relation target<select required value={relationTargetSchemaId} onChange={(event) => setRelationTargetSchemaId(event.target.value)}><option value="">Select model</option>{relationTargets.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label> : null}
      {type === "COMPONENT" ? <label>Component<select required value={componentSchemaId} onChange={(event) => setComponentSchemaId(event.target.value)}><option value="">Select component</option>{components.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label> : null}
      {type === "DYNAMIC_ZONE" ? <label className="full">Allowed components<select multiple required value={dynamicZoneSchemaIds} onChange={(event) => setDynamicZoneSchemaIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>{components.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><small>Ctrl/Cmd-click to choose multiple components.</small></label> : null}
      {type === "UID" ? <label>Generate from<select value={uidTargetField} onChange={(event) => setUidTargetField(event.target.value)}><option value="">Manual UID</option>{uidTargets.map((item) => <option key={item.id} value={item.key}>{item.label}</option>)}</select></label> : null}
      {["TEXT", "LONG_TEXT", "RICH_TEXT", "UID"].includes(type) ? <>
        <label>Min length<input type="number" min="0" value={minLength} onChange={(event) => setMinLength(event.target.value)} /></label>
        <label>Max length<input type="number" min="1" value={maxLength} onChange={(event) => setMaxLength(event.target.value)} /></label>
      </> : null}
      <label className="checkbox-label"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /> Required</label>
      {type !== "DYNAMIC_ZONE" ? <label className="checkbox-label"><input type="checkbox" checked={repeatable} onChange={(event) => setRepeatable(event.target.checked)} /> Repeatable</label> : null}
    </div>
    <button className="primary-button" disabled={busy}>Add field</button>
  </form>;
}

function kindLabel(kind: DataSchemaKind): string {
  if (kind === "SYSTEM_EXTENSION") return "System extension";
  if (kind === "COMPONENT") return "Component";
  if (kind === "SINGLE") return "Single type";
  return "Collection";
}

function fieldSummary(field: DataSchemaDefinition["fields"][number], schemas: DataSchemaDefinition[]): string {
  if (field.type === "RELATION" && field.relationTargetSchemaId) {
    return ` · → ${schemas.find((item) => item.id === field.relationTargetSchemaId)?.displayName ?? "model"}`;
  }
  if (field.type === "COMPONENT") {
    const target = typeof field.settings?.componentSchemaId === "string" ? field.settings.componentSchemaId : "";
    return ` · ${schemas.find((item) => item.id === target)?.displayName ?? "component"}`;
  }
  if (field.type === "DYNAMIC_ZONE") {
    const ids = Array.isArray(field.settings?.componentSchemaIds) ? field.settings.componentSchemaIds : [];
    return ` · ${ids.length} component${ids.length === 1 ? "" : "s"}`;
  }
  return "";
}
