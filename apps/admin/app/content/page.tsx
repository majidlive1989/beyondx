"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  archiveContentEntry,
  createContentEntry,
  deleteContentEntry,
  listContentEntries,
  listContentRevisions,
  listContentTypes,
  publishContentEntry,
  scheduleContentEntry,
  unpublishContentEntry,
  updateContentEntry,
} from "@/lib/api";
import type {
  ContentEntry,
  ContentEntryStatus,
  ContentFieldDefinition,
  ContentRevision,
  ContentType,
} from "@/lib/types";

export default function ContentPage() {
  const [types, setTypes] = useState<ContentType[]>([]);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [selected, setSelected] = useState<ContentEntry | null>(null);
  const [contentTypeId, setContentTypeId] = useState("");
  const [slug, setSlug] = useState("");
  const [locale, setLocale] = useState("en");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [relationDrafts, setRelationDrafts] = useState<Record<string, string>>({});
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentEntryStatus | "">("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedType = types.find((item) => item.id === contentTypeId) ?? null;

  async function loadTypes() {
    const result = await listContentTypes();
    setTypes(result);
    return result;
  }

  async function loadEntries() {
    try {
      const page = await listContentEntries({
        ...(search ? { search } : {}),
        ...(typeFilter ? { contentTypeId: typeFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        pageSize: 50,
      });
      setEntries(page.items);
      if (selected) {
        const fresh = page.items.find((entry) => entry.id === selected.id);
        if (fresh) chooseEntry(fresh);
      }
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load content entries");
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const loadedTypes = await loadTypes();
        if (loadedTypes[0]) setContentTypeId(loadedTypes[0].id);
        await loadEntries();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load CMS");
      }
    })();
  }, []);

  function resetEditor(nextTypeId?: string) {
    setSelected(null);
    setRevisions([]);
    setContentTypeId(nextTypeId ?? types[0]?.id ?? "");
    setSlug("");
    setLocale("en");
    setData({});
    setJsonDrafts({});
    setRelationDrafts({});
    setSeoTitle("");
    setSeoDescription("");
    setScheduleAt("");
    setError("");
  }

  function chooseEntry(entry: ContentEntry) {
    setSelected(entry);
    setContentTypeId(entry.contentTypeId);
    setSlug(entry.slug);
    setLocale(entry.locale);
    setData(entry.data);
    const type = types.find((item) => item.id === entry.contentTypeId);
    const nextJson: Record<string, string> = {};
    for (const field of type?.fields ?? []) {
      if (field.type === "JSON") nextJson[field.key] = JSON.stringify(entry.data[field.key] ?? {}, null, 2);
    }
    setJsonDrafts(nextJson);
    const nextRelations: Record<string, string> = {};
    for (const relation of entry.relations) {
      nextRelations[relation.fieldKey] = [nextRelations[relation.fieldKey], relation.targetEntryId].filter(Boolean).join("\n");
    }
    setRelationDrafts(nextRelations);
    setSeoTitle(entry.seoTitle ?? "");
    setSeoDescription(entry.seoDescription ?? "");
    setScheduleAt(entry.scheduledPublishAt ? toLocalDateTime(entry.scheduledPublishAt) : "");
    void listContentRevisions(entry.id).then(setRevisions).catch(() => setRevisions([]));
  }

  function setFieldValue(field: ContentFieldDefinition, value: unknown) {
    setData((current) => ({ ...current, [field.key]: value }));
  }

  function buildPayloadData(): Record<string, unknown> {
    const result = { ...data };
    for (const field of selectedType?.fields ?? []) {
      if (field.type === "RELATION") delete result[field.key];
      if (field.type === "JSON") {
        const raw = jsonDrafts[field.key] ?? "{}";
        try {
          result[field.key] = JSON.parse(raw) as unknown;
        } catch {
          throw new Error(`Invalid JSON in ${field.label}`);
        }
      }
    }
    return result;
  }

  function buildRelations() {
    return (selectedType?.fields ?? []).filter((field) => field.type === "RELATION").flatMap((field) =>
      (relationDrafts[field.key] ?? "").split(/[\n,]/).map((value) => value.trim()).filter(Boolean).map((targetEntryId) => ({ fieldKey: field.key, targetEntryId })),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contentTypeId) return;
    setSaving(true);
    setError("");
    try {
      const payloadData = buildPayloadData();
      const relations = buildRelations();
      const result = selected
        ? await updateContentEntry(selected.id, { slug, locale, data: payloadData, seoTitle: seoTitle || null, seoDescription: seoDescription || null, relations })
        : await createContentEntry({ contentTypeId, slug, locale, data: payloadData, seoTitle: seoTitle || null, seoDescription: seoDescription || null, relations });
      await loadEntries();
      chooseEntry(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save content entry");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: "publish" | "unpublish" | "archive" | "delete") {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      if (action === "delete") {
        await deleteContentEntry(selected.id);
        resetEditor(selected.contentTypeId);
      } else {
        const result = action === "publish"
          ? await publishContentEntry(selected.id)
          : action === "unpublish"
            ? await unpublishContentEntry(selected.id)
            : await archiveContentEntry(selected.id);
        chooseEntry(result);
      }
      await loadEntries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to ${action} entry`);
    } finally {
      setSaving(false);
    }
  }

  async function schedule() {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await scheduleContentEntry(selected.id, scheduleAt ? new Date(scheduleAt).toISOString() : null);
      chooseEntry(result);
      await loadEntries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to schedule entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div><span className="eyebrow">CMS workspace</span><h1>Content</h1><p>Create localized drafts, publish immediately or schedule publication while retaining revision history.</p></div>
        <button type="button" className="secondary-button" onClick={() => resetEditor()}>New entry</button>
      </header>

      <section className="panel">
        <div className="toolbar">
          <input placeholder="Search slug or SEO title" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All content types</option>{types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ContentEntryStatus | "")}><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select>
          <button type="button" className="secondary-button" onClick={() => void loadEntries()}>Filter</button>
        </div>
        {error ? <div className="error-banner">{error}</div> : null}

        <div className="cms-layout">
          <div>
            <div className="mobile-list">
              {entries.map((entry) => (
                <button type="button" className={`mobile-card ${selected?.id === entry.id ? "active" : ""}`} key={entry.id} onClick={() => chooseEntry(entry)}>
                  <div className="mobile-card-head"><strong>{entry.slug}</strong><span className={`status status-${entry.status.toLowerCase()}`}>{entry.status}</span></div>
                  <p>{types.find((type) => type.id === entry.contentTypeId)?.name ?? entry.contentTypeApiId}</p>
                  <div className="mobile-card-meta"><span>{entry.locale}</span><span>Revision {entry.currentRevision}</span><span>{new Date(entry.updatedAt).toLocaleString()}</span></div>
                </button>
              ))}
              {entries.length === 0 ? <div className="empty-state">No entries match this filter.</div> : null}
            </div>
          </div>

          <form className="detail-card section-stack" onSubmit={(event) => void save(event)}>
            <div className="section-title">
              <div><span className="eyebrow">{selected ? `Revision ${selected.currentRevision}` : "New draft"}</span><h2>{selected ? selected.slug : "Create entry"}</h2></div>
              {selected ? <span className={`status status-${selected.status.toLowerCase()}`}>{selected.status}</span> : null}
            </div>

            <div className="form-grid">
              <label>Content type<select value={contentTypeId} onChange={(event) => { setContentTypeId(event.target.value); setData({}); setJsonDrafts({}); setRelationDrafts({}); }} disabled={selected !== null} required><option value="">Select type</option>{types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Locale<input value={locale} onChange={(event) => setLocale(event.target.value)} placeholder="en" required /></label>
              <label className="full">Slug<input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="my-content-entry" required /></label>
            </div>

            {selectedType ? <div className="section-stack"><div><span className="eyebrow">Content fields</span><h3>{selectedType.name}</h3></div>{selectedType.fields.map((field) => <FieldEditor key={field.id} field={field} value={data[field.key]} jsonDraft={jsonDrafts[field.key] ?? ""} relationDraft={relationDrafts[field.key] ?? ""} onValue={(value) => setFieldValue(field, value)} onJson={(value) => setJsonDrafts((current) => ({ ...current, [field.key]: value }))} onRelation={(value) => setRelationDrafts((current) => ({ ...current, [field.key]: value }))} />)}</div> : <div className="empty-state">Create a content type first, then select it here.</div>}

            <div className="section-stack"><div><span className="eyebrow">Search metadata</span><h3>SEO</h3></div><label>SEO title<input value={seoTitle} maxLength={120} onChange={(event) => setSeoTitle(event.target.value)} /></label><label>SEO description<textarea value={seoDescription} maxLength={320} onChange={(event) => setSeoDescription(event.target.value)} /></label></div>

            {selected ? <div className="section-stack"><div><span className="eyebrow">Publish scheduling</span><h3>Schedule</h3></div><div className="form-grid"><label>Publish at<input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /></label><div className="field-row-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => void schedule()}>{scheduleAt ? "Schedule" : "Clear schedule"}</button></div></div>{selected.scheduledPublishAt ? <div className="success-banner">Scheduled for {new Date(selected.scheduledPublishAt).toLocaleString()}</div> : null}</div> : null}

            {selected ? <div className="section-stack"><div><span className="eyebrow">History</span><h3>Revisions</h3></div><div className="revision-list">{revisions.slice(0, 10).map((revision) => <div className="revision-item" key={revision.id}><span><strong>Revision {revision.revision}</strong><small className="muted">{new Date(revision.createdAt).toLocaleString()}</small></span><span className={`status status-${revision.status.toLowerCase()}`}>{revision.status}</span></div>)}</div></div> : null}

            <div className="sticky-actions button-row">
              <button className="primary-button" disabled={saving || !selectedType}>{saving ? "Working…" : selected ? "Save revision" : "Create draft"}</button>
              {selected?.status !== "PUBLISHED" ? <button type="button" className="secondary-button" disabled={saving} onClick={() => void runAction("publish")}>Publish</button> : <button type="button" className="secondary-button" disabled={saving} onClick={() => void runAction("unpublish")}>Unpublish</button>}
              {selected && selected.status !== "ARCHIVED" ? <button type="button" className="secondary-button" disabled={saving} onClick={() => void runAction("archive")}>Archive</button> : null}
              {selected ? <button type="button" className="danger-button" disabled={saving} onClick={() => void runAction("delete")}>Delete</button> : null}
            </div>
          </form>
        </div>
      </section>
    </AdminShell>
  );
}

function FieldEditor({ field, value, jsonDraft, relationDraft, onValue, onJson, onRelation }: {
  field: ContentFieldDefinition;
  value: unknown;
  jsonDraft: string;
  relationDraft: string;
  onValue: (value: unknown) => void;
  onJson: (value: string) => void;
  onRelation: (value: string) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  if (field.type === "RICH_TEXT") return <label>{label}<textarea value={typeof value === "string" ? value : ""} onChange={(event) => onValue(event.target.value)} required={field.required} /></label>;
  if (field.type === "BOOLEAN") return <label className="inline-check"><input type="checkbox" checked={value === true} onChange={(event) => onValue(event.target.checked)} />{label}</label>;
  if (field.type === "NUMBER") return <label>{label}<input type="number" value={typeof value === "number" ? value : ""} onChange={(event) => onValue(event.target.value === "" ? undefined : Number(event.target.value))} required={field.required} /></label>;
  if (field.type === "DATE") return <label>{label}<input type="datetime-local" value={typeof value === "string" ? toLocalDateTime(value) : ""} onChange={(event) => onValue(event.target.value)} required={field.required} /></label>;
  if (field.type === "JSON") return <label>{label}<textarea value={jsonDraft || JSON.stringify(value ?? {}, null, 2)} onChange={(event) => onJson(event.target.value)} /><span className="json-hint">Valid JSON object or value.</span></label>;
  if (field.type === "RELATION") return <label>{label}<textarea value={relationDraft} onChange={(event) => onRelation(event.target.value)} placeholder="One target entry ID per line" /><span className="json-hint">Relations are stored separately from entry JSON.</span></label>;
  return <label>{label}<input value={typeof value === "string" ? value : ""} onChange={(event) => onValue(event.target.value)} required={field.required} /></label>;
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
