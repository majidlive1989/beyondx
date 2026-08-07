"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createContentType, deleteContentType, listContentTypes, updateContentType } from "@/lib/api";
import type { ContentFieldInput, ContentFieldType, ContentType } from "@/lib/types";

const fieldTypes: ContentFieldType[] = ["TEXT", "RICH_TEXT", "NUMBER", "BOOLEAN", "DATE", "JSON", "RELATION"];

function emptyField(position: number): ContentFieldInput {
  return { key: "", label: "", type: "TEXT", required: false, localized: false, position, validation: null, settings: null };
}

export default function ContentTypesPage() {
  const [items, setItems] = useState<ContentType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [apiId, setApiId] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<ContentFieldInput[]>([emptyField(0)]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const result = await listContentTypes();
      setItems(result);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load content types");
    }
  }

  useEffect(() => { void load(); }, []);

  function choose(item: ContentType | null) {
    setSelectedId(item?.id ?? null);
    setName(item?.name ?? "");
    setApiId(item?.apiId ?? "");
    setDescription(item?.description ?? "");
    setFields(item ? item.fields.map((field, position) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      localized: field.localized,
      position,
      validation: field.validation,
      settings: field.settings,
    })) : [emptyField(0)]);
    setError("");
  }

  function patchField(index: number, patch: Partial<ContentFieldInput>) {
    setFields((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field));
  }

  function removeField(index: number) {
    setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index).map((field, position) => ({ ...field, position })));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const normalizedFields = fields.filter((field) => field.key.trim() || field.label.trim()).map((field, position) => ({ ...field, key: field.key.trim(), label: field.label.trim(), position }));
    try {
      if (selectedId) {
        await updateContentType(selectedId, { name, description: description || null, fields: normalizedFields });
      } else {
        await createContentType({ name, apiId, description: description || null, fields: normalizedFields });
      }
      await load();
      choose(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save content type");
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await deleteContentType(selectedId);
      await load();
      choose(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete content type");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div><span className="eyebrow">CMS schema</span><h1>Content types</h1><p>Define reusable content models and field rules without changing application code.</p></div>
        <button type="button" className="secondary-button" onClick={() => choose(null)}>New type</button>
      </header>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="cms-layout">
        <section className="panel role-list">
          <div className="section-title"><h2>Models</h2><span className="status-pill">{items.length}</span></div>
          <div className="mobile-list">
            {items.map((item) => (
              <button type="button" key={item.id} className={`mobile-card ${selectedId === item.id ? "active" : ""}`} onClick={() => choose(item)}>
                <div className="mobile-card-head"><strong>{item.name}</strong><span className="status status-draft">{item.fields.length} fields</span></div>
                <p>/{item.apiId}</p>
                <div className="mobile-card-meta"><span>{item.description || "No description"}</span></div>
              </button>
            ))}
            {items.length === 0 ? <div className="empty-state">No content types yet. Create the first model.</div> : null}
          </div>
        </section>

        <section className="panel form-panel">
          <form onSubmit={(event) => void save(event)}>
            <div className="section-title"><div><span className="eyebrow">{selectedId ? "Edit schema" : "New schema"}</span><h2>{selectedId ? name : "Create content type"}</h2></div></div>
            <div className="form-grid">
              <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Article" required /></label>
              <label>API ID<input value={apiId} onChange={(event) => setApiId(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="articles" disabled={selectedId !== null} required /></label>
              <label className="full">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Editorial articles and news" /></label>
            </div>

            <div className="section-stack">
              <div className="section-title"><div><span className="eyebrow">Field definitions</span><h3>Fields</h3></div><button type="button" className="secondary-button" onClick={() => setFields((current) => [...current, emptyField(current.length)])}>Add field</button></div>
              {fields.map((field, index) => (
                <div className="field-row" key={`field-${index}`}>
                  <div className="field-grid">
                    <label>Label<input value={field.label} onChange={(event) => patchField(index, { label: event.target.value })} placeholder="Title" /></label>
                    <label>Key<input value={field.key} onChange={(event) => patchField(index, { key: event.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="title" /></label>
                    <label>Type<select value={field.type} onChange={(event) => patchField(index, { type: event.target.value as ContentFieldType })}>{fieldTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                    <div className="field-row-actions"><label className="inline-check"><input type="checkbox" checked={field.required} onChange={(event) => patchField(index, { required: event.target.checked })} />Required</label><label className="inline-check"><input type="checkbox" checked={field.localized} onChange={(event) => patchField(index, { localized: event.target.checked })} />Localized</label></div>
                  </div>
                  <button type="button" className="danger-button" onClick={() => removeField(index)}>Remove field</button>
                </div>
              ))}
            </div>

            <div className="sticky-actions button-row">
              <button className="primary-button" disabled={saving}>{saving ? "Saving…" : selectedId ? "Save schema" : "Create type"}</button>
              {selectedId ? <button type="button" className="danger-button" disabled={saving} onClick={() => void removeSelected()}>Delete type</button> : null}
            </div>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
